use stay_core::{GuardView, WindowSnapshot};
use stay_desktop_lib::{
    AppState, accept_stay_inner, current_state_inner, observe_focus_inner, set_pin_inner,
    submit_pin_inner,
};

#[test]
fn command_helpers_drive_prompt_guard_and_lock_flow() {
    let state = AppState::default();

    assert!(matches!(
        current_state_inner(&state).unwrap(),
        GuardView::Idle {
            pin_configured: false
        }
    ));

    set_pin_inner(&state, "4821").unwrap();
    observe_focus_inner(
        &state,
        Some(WindowSnapshot::new("zoom.us", "Weekly Team Sync")),
    )
    .unwrap();

    assert!(matches!(
        current_state_inner(&state).unwrap(),
        GuardView::MeetingCandidate {
            pin_configured: true,
            ..
        }
    ));

    accept_stay_inner(&state).unwrap();
    observe_focus_inner(
        &state,
        Some(WindowSnapshot::new("Safari", "Quarterly planning notes")),
    )
    .unwrap();

    assert!(matches!(
        current_state_inner(&state).unwrap(),
        GuardView::Locked {
            failed_attempts: 0,
            ..
        }
    ));

    let rejected = submit_pin_inner(&state, "1111").unwrap();
    assert!(matches!(
        rejected.view,
        GuardView::Locked {
            failed_attempts: 1,
            ..
        }
    ));

    let accepted = submit_pin_inner(&state, "4821").unwrap();
    assert!(matches!(accepted.view, GuardView::Guarding { .. }));
}

#[test]
fn command_helpers_reject_pin_before_configuration() {
    let state = AppState::default();
    let error = set_pin_inner(&state, "48a1").unwrap_err();

    assert!(error.contains("four digits"));
}
