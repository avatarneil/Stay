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

        if candidate.window.window_id.is_some()
            && window.window_id.is_some()
            && candidate.window.window_id == window.window_id
        {
            return true;
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
