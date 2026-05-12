use stay_core::{
    FocusGuard, GuardCommand, GuardView, MeetingApp, MeetingClassifier, PinHash, WindowBounds,
    WindowSnapshot,
};

fn window(app: &str, title: &str) -> WindowSnapshot {
    WindowSnapshot::new(app, title)
}

fn guard_with_pin() -> FocusGuard {
    let mut guard = FocusGuard::new(MeetingClassifier::default());
    guard.set_pin_hash(PinHash::with_salt("4821", [1; 16]).unwrap());
    guard
}

#[test]
fn detects_zoom_and_guards_after_user_accepts() {
    let mut guard = guard_with_pin();

    let commands = guard.observe_focus(Some(window("zoom.us", "Weekly Team Sync")));

    assert!(matches!(
        commands.as_slice(),
        [GuardCommand::ShowPrompt { candidate }] if candidate.app == MeetingApp::Zoom
    ));
    assert!(matches!(
        guard.view(),
        GuardView::MeetingCandidate {
            pin_configured: true,
            ..
        }
    ));

    let commands = guard.accept_stay().unwrap();
    assert!(matches!(
        commands.as_slice(),
        [GuardCommand::BeginGuarding { meeting }] if meeting.app == MeetingApp::Zoom
    ));
    assert!(matches!(guard.view(), GuardView::Guarding { .. }));
}

#[test]
fn locks_when_focus_leaves_guarded_meeting_and_unlocks_with_pin() {
    let mut guard = guard_with_pin();
    guard.observe_focus(Some(window("zoom.us", "Weekly Team Sync")));
    guard.accept_stay().unwrap();

    let commands = guard.observe_focus(Some(window("Safari", "Quarterly planning notes")));

    assert!(matches!(
        commands.as_slice(),
        [GuardCommand::ShowLock { focused, .. }] if focused.app_name == "Safari"
    ));
    assert!(matches!(
        guard.view(),
        GuardView::Locked {
            failed_attempts: 0,
            ..
        }
    ));

    let rejected = guard.submit_pin("1111").unwrap();
    assert!(!rejected.accepted);
    assert_eq!(rejected.failed_attempts, 1);
    assert!(matches!(
        guard.view(),
        GuardView::Locked {
            failed_attempts: 1,
            ..
        }
    ));

    let accepted = guard.submit_pin("4821").unwrap();
    assert!(accepted.accepted);
    assert!(matches!(guard.view(), GuardView::Guarding { .. }));
}

#[test]
fn successful_pin_authorizes_app_for_current_meeting() {
    let mut guard = guard_with_pin();
    guard.observe_focus(Some(window("zoom.us", "Weekly Team Sync")));
    guard.accept_stay().unwrap();

    guard.observe_focus(Some(window("Safari", "Quarterly planning notes")));
    let accepted = guard.submit_pin("4821").unwrap();
    assert!(accepted.accepted);

    assert!(
        guard
            .observe_focus(Some(window("zoom.us", "Weekly Team Sync")))
            .is_empty()
    );
    let commands = guard.observe_focus(Some(window("Safari", "Different document")));

    assert!(commands.is_empty());
    assert!(matches!(guard.view(), GuardView::Guarding { .. }));
}

#[test]
fn authorized_app_does_not_authorize_other_apps() {
    let mut guard = guard_with_pin();
    guard.observe_focus(Some(window("zoom.us", "Weekly Team Sync")));
    guard.accept_stay().unwrap();

    guard.observe_focus(Some(window("Safari", "Quarterly planning notes")));
    guard.submit_pin("4821").unwrap();

    let commands = guard.observe_focus(Some(window("Slack", "Messages")));

    assert!(matches!(
        commands.as_slice(),
        [GuardCommand::ShowLock { focused, .. }] if focused.app_name == "Slack"
    ));
    assert!(matches!(guard.view(), GuardView::Locked { .. }));
}

#[test]
fn app_authorization_clears_when_guarding_stops() {
    let mut guard = guard_with_pin();
    guard.observe_focus(Some(window("zoom.us", "Weekly Team Sync")));
    guard.accept_stay().unwrap();
    guard.observe_focus(Some(window("Safari", "Quarterly planning notes")));
    guard.submit_pin("4821").unwrap();

    guard.stop_guarding();
    guard.observe_focus(Some(window("zoom.us", "Weekly Team Sync")));
    guard.accept_stay().unwrap();
    let commands = guard.observe_focus(Some(window("Safari", "Quarterly planning notes")));

    assert!(matches!(
        commands.as_slice(),
        [GuardCommand::ShowLock { focused, .. }] if focused.app_name == "Safari"
    ));
}

#[test]
fn stops_guarding_when_protected_meeting_window_stops_matching_meeting() {
    let mut guard = guard_with_pin();
    let meeting = window("Arc", "Design Review - Google Meet").with_window_id("arc-meet");

    guard.observe_focus(Some(meeting));
    guard.accept_stay().unwrap();

    let commands = guard.observe_focus(Some(window("Arc", "New Tab").with_window_id("arc-meet")));

    assert!(matches!(commands.as_slice(), [GuardCommand::StopGuarding]));
    assert!(matches!(guard.view(), GuardView::Idle { .. }));
}

#[test]
fn stops_locked_session_when_protected_meeting_window_stops_matching_meeting() {
    let mut guard = guard_with_pin();
    let meeting = window("Arc", "Design Review - Google Meet").with_window_id("arc-meet");

    guard.observe_focus(Some(meeting));
    guard.accept_stay().unwrap();
    guard.observe_focus(Some(window("Slack", "Messages")));

    let commands = guard.observe_focus(Some(window("Arc", "New Tab").with_window_id("arc-meet")));

    assert!(matches!(commands.as_slice(), [GuardCommand::StopGuarding]));
    assert!(matches!(guard.view(), GuardView::Idle { .. }));
}

#[test]
fn switching_to_another_browser_window_still_locks_guarded_meeting() {
    let mut guard = guard_with_pin();
    let meeting = window("Arc", "Design Review - Google Meet").with_window_id("arc-meet");

    guard.observe_focus(Some(meeting));
    guard.accept_stay().unwrap();

    let commands = guard.observe_focus(Some(
        window("Arc", "Project notes").with_window_id("arc-notes"),
    ));

    assert!(matches!(
        commands.as_slice(),
        [GuardCommand::ShowLock { focused, .. }] if focused.title == "Project notes"
    ));
    assert!(matches!(guard.view(), GuardView::Locked { .. }));
}

#[test]
fn carries_focused_window_bounds_into_lock_state() {
    let mut guard = guard_with_pin();
    guard.observe_focus(Some(window("zoom.us", "Weekly Team Sync")));
    guard.accept_stay().unwrap();

    let focused_bounds = WindowBounds {
        x: 96,
        y: 88,
        width: 680,
        height: 420,
    };
    let commands = guard.observe_focus(Some(
        window("Safari", "Quarterly planning notes").with_bounds(focused_bounds.clone()),
    ));

    let [GuardCommand::ShowLock { focused, .. }] = commands.as_slice() else {
        panic!("expected one ShowLock command");
    };
    assert_eq!(focused.bounds.as_ref(), Some(&focused_bounds));

    let GuardView::Locked { focused, .. } = guard.view() else {
        panic!("expected locked view");
    };
    assert_eq!(focused.bounds.as_ref(), Some(&focused_bounds));
}

#[test]
fn emits_lock_command_when_focus_changes_while_locked() {
    let mut guard = guard_with_pin();
    guard.observe_focus(Some(window("zoom.us", "Weekly Team Sync")));
    guard.accept_stay().unwrap();

    guard.observe_focus(Some(
        window("Safari", "Quarterly planning notes").with_bounds(WindowBounds {
            x: 96,
            y: 88,
            width: 680,
            height: 420,
        }),
    ));

    let slack_bounds = WindowBounds {
        x: 820,
        y: 110,
        width: 720,
        height: 512,
    };
    let commands = guard.observe_focus(Some(
        window("Slack", "Messages").with_bounds(slack_bounds.clone()),
    ));

    let [GuardCommand::ShowLock { focused, .. }] = commands.as_slice() else {
        panic!("expected one ShowLock command");
    };
    assert_eq!(focused.app_name, "Slack");
    assert_eq!(focused.bounds.as_ref(), Some(&slack_bounds));

    let GuardView::Locked { focused, .. } = guard.view() else {
        panic!("expected locked view");
    };
    assert_eq!(focused.app_name, "Slack");
    assert_eq!(focused.bounds.as_ref(), Some(&slack_bounds));
}

#[test]
fn does_not_emit_duplicate_lock_command_for_same_locked_focus() {
    let mut guard = guard_with_pin();
    guard.observe_focus(Some(window("zoom.us", "Weekly Team Sync")));
    guard.accept_stay().unwrap();

    let safari = window("Safari", "Quarterly planning notes")
        .with_window_id("safari-1")
        .with_bounds(WindowBounds {
            x: 96,
            y: 88,
            width: 680,
            height: 420,
        });
    guard.observe_focus(Some(safari.clone()));

    let commands = guard.observe_focus(Some(safari));

    assert!(commands.is_empty());
}

#[test]
fn rejects_invalid_pin_shape_while_locked_without_unlocking() {
    let mut guard = guard_with_pin();
    guard.observe_focus(Some(window("zoom.us", "Weekly Team Sync")));
    guard.accept_stay().unwrap();
    guard.observe_focus(Some(window("Safari", "Quarterly planning notes")));

    let rejected = guard.submit_pin("48a1").unwrap();

    assert!(!rejected.accepted);
    assert_eq!(rejected.failed_attempts, 1);
    assert!(matches!(guard.view(), GuardView::Locked { .. }));
}

#[test]
fn ignores_stay_window_as_meeting_or_distraction() {
    let mut guard = guard_with_pin();

    assert!(guard.observe_focus(Some(window("Stay", "Stay"))).is_empty());
    assert!(matches!(guard.view(), GuardView::Idle { .. }));

    guard.observe_focus(Some(window("zoom.us", "Weekly Team Sync")));
    guard.accept_stay().unwrap();

    assert!(guard.observe_focus(Some(window("Stay", "Stay"))).is_empty());
    assert!(matches!(guard.view(), GuardView::Guarding { .. }));
}

#[test]
fn detects_google_meet_inside_browser_title() {
    let classifier = MeetingClassifier::default();
    let candidate = classifier
        .classify(&window("Arc", "Design Review - Google Meet"))
        .unwrap();

    assert_eq!(candidate.app, MeetingApp::GoogleMeet);
}

#[test]
fn dismissing_candidate_suppresses_that_window_until_it_changes() {
    let mut guard = guard_with_pin();
    let meeting = window("zoom.us", "Weekly Team Sync").with_window_id("zoom-1");

    guard.observe_focus(Some(meeting.clone()));
    guard.dismiss_candidate();
    assert!(matches!(guard.view(), GuardView::Idle { .. }));

    assert!(guard.observe_focus(Some(meeting)).is_empty());

    let commands = guard.observe_focus(Some(
        window("zoom.us", "Customer Call").with_window_id("zoom-2"),
    ));
    assert!(matches!(
        commands.as_slice(),
        [GuardCommand::ShowPrompt { .. }]
    ));
}
