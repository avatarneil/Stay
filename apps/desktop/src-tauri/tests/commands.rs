use stay_core::{GuardCommand, GuardView, WindowBounds, WindowSnapshot};
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
fn command_helpers_emit_lock_command_when_locked_focus_changes() {
    let state = AppState::default();

    set_pin_inner(&state, "4821").unwrap();
    observe_focus_inner(
        &state,
        Some(WindowSnapshot::new("zoom.us", "Weekly Team Sync")),
    )
    .unwrap();
    accept_stay_inner(&state).unwrap();

    observe_focus_inner(
        &state,
        Some(
            WindowSnapshot::new("Safari", "Quarterly planning notes").with_bounds(WindowBounds {
                x: 96,
                y: 88,
                width: 680,
                height: 420,
            }),
        ),
    )
    .unwrap();

    let slack_bounds = WindowBounds {
        x: 820,
        y: 110,
        width: 720,
        height: 512,
    };
    let response = observe_focus_inner(
        &state,
        Some(WindowSnapshot::new("Slack", "Messages").with_bounds(slack_bounds.clone())),
    )
    .unwrap();

    let [GuardCommand::ShowLock { focused, .. }] = response.commands.as_slice() else {
        panic!("expected one ShowLock command");
    };
    assert_eq!(focused.app_name, "Slack");
    assert_eq!(focused.bounds.as_ref(), Some(&slack_bounds));
    assert!(matches!(response.view, GuardView::Locked { .. }));
}

#[test]
fn command_helpers_emit_stop_guarding_when_meeting_ends() {
    let state = AppState::default();

    set_pin_inner(&state, "4821").unwrap();
    observe_focus_inner(
        &state,
        Some(WindowSnapshot::new("Arc", "Design Review - Google Meet").with_window_id("arc-meet")),
    )
    .unwrap();
    accept_stay_inner(&state).unwrap();

    let response = observe_focus_inner(
        &state,
        Some(WindowSnapshot::new("Arc", "New Tab").with_window_id("arc-meet")),
    )
    .unwrap();

    assert!(matches!(
        response.commands.as_slice(),
        [GuardCommand::StopGuarding]
    ));
    assert!(matches!(response.view, GuardView::Idle { .. }));
}

#[test]
fn command_helpers_reject_pin_before_configuration() {
    let state = AppState::default();
    let error = set_pin_inner(&state, "48a1").unwrap_err();

    assert!(error.contains("four digits"));
}
