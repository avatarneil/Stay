use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct WindowSnapshot {
    pub app_name: String,
    pub title: String,
    pub process_id: Option<u64>,
    pub window_id: Option<String>,
    pub process_path: Option<String>,
    pub bounds: Option<WindowBounds>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl WindowSnapshot {
    pub fn new(app_name: impl Into<String>, title: impl Into<String>) -> Self {
        Self {
            app_name: app_name.into(),
            title: title.into(),
            process_id: None,
            window_id: None,
            process_path: None,
            bounds: None,
        }
    }

    pub fn with_process_id(mut self, process_id: u64) -> Self {
        self.process_id = Some(process_id);
        self
    }

    pub fn with_window_id(mut self, window_id: impl Into<String>) -> Self {
        self.window_id = Some(window_id.into());
        self
    }

    pub fn with_bounds(mut self, bounds: WindowBounds) -> Self {
        self.bounds = Some(bounds);
        self
    }

    pub fn identity_key(&self) -> String {
        let app = normalize(&self.app_name);
        let title = normalize(&self.title);
        match (&self.window_id, self.process_id) {
            (Some(window_id), _) => format!("window:{app}:{window_id}"),
            (None, Some(process_id)) => format!("process:{app}:{process_id}:{title}"),
            (None, None) => format!("title:{app}:{title}"),
        }
    }

    pub fn app_name_normalized(&self) -> String {
        normalize(&self.app_name)
    }

    pub fn title_normalized(&self) -> String {
        normalize(&self.title)
    }
}

pub fn normalize(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
