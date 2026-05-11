use stay_core::{
    FocusGuard, GuardCommand, GuardView, MeetingApp, MeetingClassifier, PinHash, WindowSnapshot,
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
