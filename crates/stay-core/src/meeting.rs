use crate::focus::{WindowSnapshot, normalize};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MeetingApp {
    Zoom,
    GoogleMeet,
    MicrosoftTeams,
    FaceTime,
    Webex,
    SlackHuddle,
}

impl MeetingApp {
    pub fn label(&self) -> &'static str {
        match self {
            Self::Zoom => "Zoom",
            Self::GoogleMeet => "Google Meet",
            Self::MicrosoftTeams => "Microsoft Teams",
            Self::FaceTime => "FaceTime",
            Self::Webex => "Webex",
            Self::SlackHuddle => "Slack huddle",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct MeetingCandidate {
    pub app: MeetingApp,
    pub window: WindowSnapshot,
    pub reason: String,
}

impl MeetingCandidate {
    pub fn identity_key(&self) -> String {
        format!("{:?}:{}", self.app, self.window.identity_key())
    }
}

#[derive(Clone, Debug)]
pub struct MeetingClassifier {
    stay_app_names: Vec<String>,
}

impl Default for MeetingClassifier {
    fn default() -> Self {
        Self {
            stay_app_names: vec!["stay".to_string()],
        }
    }
}

impl MeetingClassifier {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_stay_app_names(names: impl IntoIterator<Item = impl Into<String>>) -> Self {
        Self {
            stay_app_names: names
                .into_iter()
                .map(|name| normalize(&name.into()))
                .collect(),
        }
    }

    pub fn is_stay_window(&self, window: &WindowSnapshot) -> bool {
        let app = window.app_name_normalized();
        let title = window.title_normalized();

        self.stay_app_names
            .iter()
            .any(|stay_name| app == *stay_name || title == *stay_name || title.starts_with("stay "))
    }

    pub fn classify(&self, window: &WindowSnapshot) -> Option<MeetingCandidate> {
        if self.is_stay_window(window) {
            return None;
        }

        let app = window.app_name_normalized();
        let title = window.title_normalized();
        let combined = format!("{app} {title}");

        let (meeting_app, reason) = if app_contains(&app, &["zoom", "zoom.us"])
            || text_contains(&title, &["zoom meeting"])
        {
            (MeetingApp::Zoom, "Zoom foreground window")
        } else if text_contains(&combined, &["google meet", "meet.google.com"]) {
            (MeetingApp::GoogleMeet, "Google Meet browser window")
        } else if app_contains(&app, &["microsoft teams", "teams"])
            || text_contains(&title, &["microsoft teams", "teams meeting"])
        {
            (
                MeetingApp::MicrosoftTeams,
                "Microsoft Teams foreground window",
            )
        } else if app_contains(&app, &["facetime"]) || text_contains(&title, &["facetime"]) {
            (MeetingApp::FaceTime, "FaceTime foreground window")
        } else if app_contains(&app, &["webex"])
            || text_contains(&title, &["webex", "cisco meeting"])
        {
            (MeetingApp::Webex, "Webex foreground window")
        } else if app_contains(&app, &["slack"]) && text_contains(&title, &["huddle"]) {
            (MeetingApp::SlackHuddle, "Slack huddle foreground window")
        } else {
            return None;
        };

        if is_known_non_meeting_shell(&meeting_app, &title) {
            return None;
        }

        Some(MeetingCandidate {
            app: meeting_app,
            window: window.clone(),
            reason: reason.to_string(),
        })
    }

    pub fn is_same_meeting_window(
        &self,
        candidate: &MeetingCandidate,
        window: &WindowSnapshot,
    ) -> bool {
        if self.is_stay_window(window) {
            return false;
        }

        if is_same_observed_window(&candidate.window, window) {
            return matches!(self.classify(window), Some(current) if current.app == candidate.app);
        }

        let Some(current_candidate) = self.classify(window) else {
            return false;
        };

        if current_candidate.app != candidate.app {
            return false;
        }

        let same_app = candidate.window.app_name_normalized() == window.app_name_normalized();
        let same_title = candidate.window.title_normalized() == window.title_normalized();
        let same_process = candidate.window.process_id.is_some()
            && candidate.window.process_id == window.process_id;

        same_app && (same_title || same_process || !is_browser_app(&candidate.window.app_name))
    }

    pub(crate) fn has_meeting_ended(
        &self,
        candidate: &MeetingCandidate,
        window: &WindowSnapshot,
    ) -> bool {
        if self.is_stay_window(window) {
            return false;
        }

        let current_is_same_meeting_app =
            matches!(self.classify(window), Some(current) if current.app == candidate.app);

        if is_same_observed_window(&candidate.window, window) {
            return !current_is_same_meeting_app;
        }

        if is_browser_app(&candidate.window.app_name) {
            return false;
        }

        if candidate.window.app_name_normalized() != window.app_name_normalized() {
            return false;
        }

        if has_distinct_window_ids(&candidate.window, window) {
            return true;
        }

        !current_is_same_meeting_app
    }

    pub(crate) fn has_definitive_meeting_end(
        &self,
        candidate: &MeetingCandidate,
        window: &WindowSnapshot,
    ) -> bool {
        self.has_meeting_ended(candidate, window)
            && is_same_observed_window(&candidate.window, window)
    }
}

fn text_contains(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

fn app_contains(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| {
        value == *needle
            || value.contains(&format!("{needle}."))
            || value.contains(&format!("{needle} "))
    })
}

fn is_browser_app(app_name: &str) -> bool {
    let app = normalize(app_name);
    [
        "arc", "brave", "chrome", "chromium", "edge", "firefox", "safari",
    ]
    .iter()
    .any(|browser| app.contains(browser))
}

fn is_known_non_meeting_shell(app: &MeetingApp, title: &str) -> bool {
    if title.is_empty() {
        return true;
    }

    match app {
        MeetingApp::Zoom => {
            text_contains(title, &["zoom workplace"]) || title_matches(title, ZOOM_SHELL_TITLES)
        }
        MeetingApp::MicrosoftTeams => title_matches(title, TEAMS_SHELL_TITLES),
        MeetingApp::Webex => title_matches(title, WEBEX_SHELL_TITLES),
        MeetingApp::SlackHuddle => !text_contains(title, &["huddle"]),
        MeetingApp::FaceTime => title_matches(title, FACETIME_SHELL_TITLES),
        MeetingApp::GoogleMeet => false,
    }
}

const ZOOM_SHELL_TITLES: &[&str] = &[
    "home",
    "team chat",
    "meetings",
    "calendar",
    "mail",
    "whiteboards",
    "clips",
    "contacts",
    "settings",
];

const TEAMS_SHELL_TITLES: &[&str] = &[
    "microsoft teams",
    "teams",
    "activity",
    "chat",
    "calendar",
    "calls",
    "files",
    "apps",
];

const WEBEX_SHELL_TITLES: &[&str] = &["webex", "meetings", "messaging", "calling", "contacts"];

const FACETIME_SHELL_TITLES: &[&str] = &["facetime"];

fn title_matches(title: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| title == *needle)
}

fn is_same_observed_window(left: &WindowSnapshot, right: &WindowSnapshot) -> bool {
    left.window_id.is_some()
        && right.window_id.is_some()
        && left.window_id == right.window_id
        && left.app_name_normalized() == right.app_name_normalized()
}

fn has_distinct_window_ids(left: &WindowSnapshot, right: &WindowSnapshot) -> bool {
    left.window_id.is_some() && right.window_id.is_some() && left.window_id != right.window_id
}
