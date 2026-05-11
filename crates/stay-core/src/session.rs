use crate::focus::{WindowBounds, WindowSnapshot};
use crate::meeting::{MeetingCandidate, MeetingClassifier};
use crate::pin::{PinError, PinHash};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use thiserror::Error;

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "snake_case")]
pub enum GuardView {
    Idle {
        pin_configured: bool,
    },
    MeetingCandidate {
        candidate: MeetingCandidate,
        pin_configured: bool,
    },
    Guarding {
        meeting: MeetingCandidate,
        pin_configured: bool,
    },
    Locked {
        meeting: MeetingCandidate,
        focused: LockedFocus,
        failed_attempts: u32,
        pin_configured: bool,
        last_error: Option<String>,
    },
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct LockedFocus {
    pub app_name: String,
    pub title: String,
    pub bounds: Option<WindowBounds>,
}

impl From<&WindowSnapshot> for LockedFocus {
    fn from(window: &WindowSnapshot) -> Self {
        Self {
            app_name: window.app_name.clone(),
            title: window.title.clone(),
            bounds: window.bounds.clone(),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GuardCommand {
    ShowPrompt {
        candidate: MeetingCandidate,
    },
    HidePrompt,
    BeginGuarding {
        meeting: MeetingCandidate,
    },
    ShowLock {
        meeting: MeetingCandidate,
        focused: LockedFocus,
    },
    StayLocked {
        failed_attempts: u32,
    },
    Unlock,
    StopGuarding,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct PinSubmission {
    pub accepted: bool,
    pub failed_attempts: u32,
    pub commands: Vec<GuardCommand>,
    pub view: GuardView,
}

#[derive(Clone, Debug, Error, Eq, PartialEq)]
pub enum GuardError {
    #[error("set a four digit PIN before turning on Stay")]
    PinNotConfigured,
    #[error("there is no meeting waiting to guard")]
    NoMeetingCandidate,
    #[error("Stay is not locked right now")]
    NotLocked,
    #[error(transparent)]
    Pin(#[from] PinError),
}

#[derive(Clone, Debug, Eq, PartialEq)]
enum GuardPhase {
    Idle,
    Candidate(MeetingCandidate),
    Guarding(GuardSession),
    Locked {
        session: GuardSession,
        focused: WindowSnapshot,
        failed_attempts: u32,
        last_error: Option<String>,
    },
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct GuardSession {
    meeting: MeetingCandidate,
    authorized_app_keys: HashSet<String>,
}

impl GuardSession {
    fn new(meeting: MeetingCandidate) -> Self {
        Self {
            meeting,
            authorized_app_keys: HashSet::new(),
        }
    }

    fn authorize_app(&mut self, window: &WindowSnapshot) {
        self.authorized_app_keys.insert(window.app_identity_key());
    }

    fn is_app_authorized(&self, window: &WindowSnapshot) -> bool {
        self.authorized_app_keys
            .contains(&window.app_identity_key())
    }
}

pub struct FocusGuard {
    classifier: MeetingClassifier,
    phase: GuardPhase,
    pin: Option<PinHash>,
    dismissed_candidates: HashSet<String>,
}

impl Default for FocusGuard {
    fn default() -> Self {
        Self::new(MeetingClassifier::default())
    }
}

impl FocusGuard {
    pub fn new(classifier: MeetingClassifier) -> Self {
        Self {
            classifier,
            phase: GuardPhase::Idle,
            pin: None,
            dismissed_candidates: HashSet::new(),
        }
    }

    pub fn set_pin(&mut self, pin: &str) -> Result<(), PinError> {
        self.pin = Some(PinHash::new(pin)?);
        Ok(())
    }

    pub fn set_pin_hash(&mut self, pin: PinHash) {
        self.pin = Some(pin);
    }

    pub fn pin_configured(&self) -> bool {
        self.pin.is_some()
    }

    pub fn view(&self) -> GuardView {
        let pin_configured = self.pin_configured();
        match &self.phase {
            GuardPhase::Idle => GuardView::Idle { pin_configured },
            GuardPhase::Candidate(candidate) => GuardView::MeetingCandidate {
                candidate: candidate.clone(),
                pin_configured,
            },
            GuardPhase::Guarding(session) => GuardView::Guarding {
                meeting: session.meeting.clone(),
                pin_configured,
            },
            GuardPhase::Locked {
                session,
                focused,
                failed_attempts,
                last_error,
            } => GuardView::Locked {
                meeting: session.meeting.clone(),
                focused: LockedFocus::from(focused),
                failed_attempts: *failed_attempts,
                pin_configured,
                last_error: last_error.clone(),
            },
        }
    }

    pub fn observe_focus(&mut self, window: Option<WindowSnapshot>) -> Vec<GuardCommand> {
        let Some(window) = window else {
            return Vec::new();
        };

        if self.classifier.is_stay_window(&window) {
            return Vec::new();
        }

        match self.phase.clone() {
            GuardPhase::Idle => self.observe_from_idle(window),
            GuardPhase::Candidate(candidate) => self.observe_from_candidate(candidate, window),
            GuardPhase::Guarding(session) => self.observe_from_guarding(session, window),
            GuardPhase::Locked {
                session,
                focused,
                failed_attempts,
                last_error,
            } => self.observe_from_locked(session, focused, failed_attempts, last_error, window),
        }
    }

    pub fn accept_stay(&mut self) -> Result<Vec<GuardCommand>, GuardError> {
        if self.pin.is_none() {
            return Err(GuardError::PinNotConfigured);
        }

        let GuardPhase::Candidate(candidate) = &self.phase else {
            return Err(GuardError::NoMeetingCandidate);
        };

        let meeting = candidate.clone();
        self.phase = GuardPhase::Guarding(GuardSession::new(meeting.clone()));
        Ok(vec![GuardCommand::BeginGuarding { meeting }])
    }

    pub fn dismiss_candidate(&mut self) -> Vec<GuardCommand> {
        if let GuardPhase::Candidate(candidate) = &self.phase {
            self.dismissed_candidates.insert(candidate.identity_key());
        }
        self.phase = GuardPhase::Idle;
        vec![GuardCommand::HidePrompt]
    }

    pub fn stop_guarding(&mut self) -> Vec<GuardCommand> {
        self.phase = GuardPhase::Idle;
        vec![GuardCommand::StopGuarding]
    }

    pub fn submit_pin(&mut self, pin: &str) -> Result<PinSubmission, GuardError> {
        let GuardPhase::Locked {
            mut session,
            focused,
            failed_attempts,
            ..
        } = self.phase.clone()
        else {
            return Err(GuardError::NotLocked);
        };

        let Some(pin_hash) = &self.pin else {
            return Err(GuardError::PinNotConfigured);
        };

        match pin_hash.verify(pin) {
            Ok(()) => {
                session.authorize_app(&focused);
                self.phase = GuardPhase::Guarding(session);
                let commands = vec![GuardCommand::Unlock];
                Ok(PinSubmission {
                    accepted: true,
                    failed_attempts: 0,
                    commands,
                    view: self.view(),
                })
            }
            Err(PinError::InvalidFormat | PinError::VerificationFailed) => {
                let failed_attempts = failed_attempts + 1;
                self.phase = GuardPhase::Locked {
                    session,
                    focused,
                    failed_attempts,
                    last_error: Some("That PIN did not open Stay.".to_string()),
                };
                let commands = vec![GuardCommand::StayLocked { failed_attempts }];
                Ok(PinSubmission {
                    accepted: false,
                    failed_attempts,
                    commands,
                    view: self.view(),
                })
            }
        }
    }

    fn observe_from_idle(&mut self, window: WindowSnapshot) -> Vec<GuardCommand> {
        let Some(candidate) = self.classifier.classify(&window) else {
            return Vec::new();
        };

        if self
            .dismissed_candidates
            .contains(&candidate.identity_key())
        {
            return Vec::new();
        }

        self.phase = GuardPhase::Candidate(candidate.clone());
        vec![GuardCommand::ShowPrompt { candidate }]
    }

    fn observe_from_candidate(
        &mut self,
        existing: MeetingCandidate,
        window: WindowSnapshot,
    ) -> Vec<GuardCommand> {
        if self.classifier.is_same_meeting_window(&existing, &window) {
            return Vec::new();
        }

        let Some(candidate) = self.classifier.classify(&window) else {
            self.phase = GuardPhase::Idle;
            return vec![GuardCommand::HidePrompt];
        };

        if self
            .dismissed_candidates
            .contains(&candidate.identity_key())
        {
            self.phase = GuardPhase::Idle;
            return vec![GuardCommand::HidePrompt];
        }

        self.phase = GuardPhase::Candidate(candidate.clone());
        vec![GuardCommand::ShowPrompt { candidate }]
    }

    fn observe_from_guarding(
        &mut self,
        session: GuardSession,
        window: WindowSnapshot,
    ) -> Vec<GuardCommand> {
        if self
            .classifier
            .is_same_meeting_window(&session.meeting, &window)
        {
            return Vec::new();
        }

        if session.is_app_authorized(&window) {
            return Vec::new();
        }

        self.phase = GuardPhase::Locked {
            session: session.clone(),
            focused: window.clone(),
            failed_attempts: 0,
            last_error: None,
        };
        vec![GuardCommand::ShowLock {
            meeting: session.meeting,
            focused: LockedFocus::from(&window),
        }]
    }

    fn observe_from_locked(
        &mut self,
        session: GuardSession,
        focused: WindowSnapshot,
        failed_attempts: u32,
        last_error: Option<String>,
        window: WindowSnapshot,
    ) -> Vec<GuardCommand> {
        if self
            .classifier
            .is_same_meeting_window(&session.meeting, &window)
        {
            self.phase = GuardPhase::Locked {
                session,
                focused,
                failed_attempts,
                last_error,
            };
            return Vec::new();
        }

        if focused == window {
            self.phase = GuardPhase::Locked {
                session,
                focused,
                failed_attempts,
                last_error,
            };
            return Vec::new();
        }

        let command = GuardCommand::ShowLock {
            meeting: session.meeting.clone(),
            focused: LockedFocus::from(&window),
        };
        self.phase = GuardPhase::Locked {
            session,
            focused: window,
            failed_attempts,
            last_error,
        };
        vec![command]
    }
}
