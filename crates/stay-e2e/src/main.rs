use serde::Serialize;
use stay_core::{FocusGuard, GuardView, MeetingClassifier, PinHash, WindowSnapshot};

#[derive(Debug, Serialize)]
struct ScenarioStep {
    label: &'static str,
    view: GuardView,
}

fn main() {
    let steps = default_focus_guard_scenario();
    println!(
        "{}",
        serde_json::to_string_pretty(&steps).expect("scenario serializes")
    );
}

fn default_focus_guard_scenario() -> Vec<ScenarioStep> {
    let mut guard = FocusGuard::new(MeetingClassifier::default());
    guard.set_pin_hash(PinHash::with_salt("4821", [2; 16]).expect("valid test PIN"));

    let mut steps = Vec::new();
    steps.push(step("idle", guard.view()));

    guard.observe_focus(Some(WindowSnapshot::new("zoom.us", "Weekly Team Sync")));
    steps.push(step("meeting-candidate", guard.view()));

    guard
        .accept_stay()
        .expect("meeting candidate can be guarded");
    steps.push(step("guarding", guard.view()));

    guard.observe_focus(Some(WindowSnapshot::new(
        "Safari",
        "Quarterly planning notes",
    )));
    steps.push(step("locked", guard.view()));

    guard
        .submit_pin("1111")
        .expect("invalid PIN is handled as rejection");
    steps.push(step("rejected-pin", guard.view()));

    guard.submit_pin("4821").expect("valid PIN unlocks Stay");
    steps.push(step("unlocked", guard.view()));

    steps
}

fn step(label: &'static str, view: GuardView) -> ScenarioStep {
    ScenarioStep { label, view }
}
