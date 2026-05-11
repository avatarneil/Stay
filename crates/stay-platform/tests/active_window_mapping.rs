use active_win_pos_rs::{ActiveWindow, WindowPosition};
use stay_platform::{FocusError, FocusProvider, active_window_to_snapshot};

#[test]
fn maps_native_active_window_to_core_snapshot() {
    let snapshot = active_window_to_snapshot(ActiveWindow {
        title: "Design Review - Google Meet".to_string(),
        process_path: "/Applications/Arc.app".into(),
        app_name: "Arc".to_string(),
        window_id: "abc-123".to_string(),
        process_id: 42,
        position: WindowPosition {
            x: 1.0,
            y: 2.0,
            width: 800.0,
            height: 600.0,
        },
    });

    assert_eq!(snapshot.app_name, "Arc");
    assert_eq!(snapshot.title, "Design Review - Google Meet");
    assert_eq!(snapshot.process_id, Some(42));
    assert_eq!(snapshot.window_id.as_deref(), Some("abc-123"));
    assert_eq!(
        snapshot.process_path.as_deref(),
        Some("/Applications/Arc.app")
    );
    assert_eq!(snapshot.bounds.as_ref().map(|bounds| bounds.x), Some(1));
    assert_eq!(
        snapshot.bounds.as_ref().map(|bounds| bounds.width),
        Some(800)
    );
}

#[derive(Default)]
struct FailingFocusProvider;

impl FocusProvider for FailingFocusProvider {
    fn active_window(&self) -> Result<Option<stay_core::WindowSnapshot>, FocusError> {
        Err(FocusError::Unavailable)
    }
}

#[test]
fn providers_surface_unavailable_errors() {
    let error = FailingFocusProvider.active_window().unwrap_err();
    assert_eq!(error, FocusError::Unavailable);
}
