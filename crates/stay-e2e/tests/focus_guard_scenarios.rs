use std::process::Command;

#[test]
fn default_scenario_runs_focus_guard_flow() {
    let output = Command::new(env!("CARGO_BIN_EXE_stay-e2e"))
        .output()
        .expect("stay-e2e binary runs");

    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).expect("scenario emits utf8");

    assert!(stdout.contains("\"label\": \"meeting-candidate\""));
    assert!(stdout.contains("\"mode\": \"locked\""));
    assert!(stdout.contains("\"label\": \"rejected-pin\""));
    assert!(stdout.contains("\"label\": \"unlocked\""));
}
