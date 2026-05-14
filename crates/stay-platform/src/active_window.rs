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
            .map(enrich_active_window_snapshot)
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

#[cfg(target_os = "macos")]
fn enrich_active_window_snapshot(snapshot: WindowSnapshot) -> WindowSnapshot {
    enrich_active_window_snapshot_with(snapshot, macos_accessibility::focused_window_title)
}

#[cfg(target_os = "macos")]
fn enrich_active_window_snapshot_with(
    mut snapshot: WindowSnapshot,
    focused_window_title: impl FnOnce(i32) -> Option<String>,
) -> WindowSnapshot {
    if !snapshot.title.trim().is_empty() {
        return snapshot;
    }

    let Some(process_id) = snapshot
        .process_id
        .and_then(|value| i32::try_from(value).ok())
    else {
        return snapshot;
    };

    if let Some(title) = focused_window_title(process_id)
        && !title.trim().is_empty()
    {
        snapshot.title = title;
    }

    snapshot
}

#[cfg(not(target_os = "macos"))]
fn enrich_active_window_snapshot(snapshot: WindowSnapshot) -> WindowSnapshot {
    snapshot
}

#[cfg(target_os = "macos")]
mod macos_accessibility {
    use accessibility::{AXUIElement, AXUIElementAttributes};

    pub fn focused_window_title(process_id: i32) -> Option<String> {
        let app = AXUIElement::application(process_id);
        let window = app.focused_window().or_else(|_| app.main_window()).ok()?;

        window.title().ok().map(|title| title.to_string())
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn enriches_empty_macos_title_from_accessibility() {
        let snapshot = WindowSnapshot::new("zoom.us", "").with_process_id(1006);

        let snapshot =
            enrich_active_window_snapshot_with(snapshot, |process_id| match process_id {
                1006 => Some("Zoom Meeting".to_string()),
                _ => None,
            });

        assert_eq!(snapshot.title, "Zoom Meeting");
    }

    #[test]
    fn keeps_existing_macos_title_without_accessibility_lookup() {
        let snapshot = WindowSnapshot::new("zoom.us", "Home").with_process_id(1006);

        let snapshot = enrich_active_window_snapshot_with(snapshot, |_| {
            panic!("title lookup should not run when the provider already returned a title")
        });

        assert_eq!(snapshot.title, "Home");
    }
}
