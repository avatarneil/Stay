use active_win_pos_rs::{ActiveWindow, get_active_window};
use stay_core::{WindowBounds, WindowSnapshot};
use thiserror::Error;

pub trait FocusProvider {
    fn active_window(&self) -> Result<Option<WindowSnapshot>, FocusError>;
}

#[derive(Clone, Debug, Default)]
pub struct ActiveWinFocusProvider;

#[derive(Debug, Error, Eq, PartialEq)]
pub enum FocusError {
    #[error(
        "active foreground window is unavailable; the OS may require permissions or an X11 session"
    )]
    Unavailable,
}

impl FocusProvider for ActiveWinFocusProvider {
    fn active_window(&self) -> Result<Option<WindowSnapshot>, FocusError> {
        get_active_window()
            .map(active_window_to_snapshot)
            .map(Some)
            .map_err(|()| FocusError::Unavailable)
    }
}

pub fn active_window_to_snapshot(window: ActiveWindow) -> WindowSnapshot {
    WindowSnapshot {
        app_name: window.app_name,
        title: window.title,
        process_id: Some(window.process_id),
        window_id: Some(window.window_id),
        process_path: Some(window.process_path.display().to_string()),
        bounds: Some(WindowBounds {
            x: window.position.x.round() as i32,
            y: window.position.y.round() as i32,
            width: window.position.width.max(0.0).round() as u32,
            height: window.position.height.max(0.0).round() as u32,
        }),
    }
}
