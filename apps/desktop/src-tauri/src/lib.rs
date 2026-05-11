use serde::Serialize;
use stay_core::{FocusGuard, GuardCommand, GuardView, MeetingClassifier, WindowSnapshot};
use stay_platform::{ActiveWinFocusProvider, FocusProvider};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalRect, PhysicalSize, State, WebviewWindow};

const WINDOW_MARGIN_LOGICAL: f64 = 24.0;
const POLL_INTERVAL: Duration = Duration::from_millis(750);

pub struct AppState {
    guard: Mutex<FocusGuard>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            guard: Mutex::new(FocusGuard::new(MeetingClassifier::default())),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct CommandResponse {
    pub view: GuardView,
    pub commands: Vec<GuardCommand>,
}

#[tauri::command]
fn current_state(state: State<'_, AppState>) -> Result<GuardView, String> {
    current_state_inner(&state)
}

#[tauri::command]
fn set_pin(pin: String, state: State<'_, AppState>) -> Result<CommandResponse, String> {
    set_pin_inner(&state, &pin)
}

#[tauri::command]
fn accept_stay(state: State<'_, AppState>) -> Result<CommandResponse, String> {
    accept_stay_inner(&state)
}

#[tauri::command]
fn dismiss_candidate(state: State<'_, AppState>) -> Result<CommandResponse, String> {
    dismiss_candidate_inner(&state)
}

#[tauri::command]
fn stop_guarding(state: State<'_, AppState>) -> Result<CommandResponse, String> {
    stop_guarding_inner(&state)
}

#[tauri::command]
fn submit_pin(pin: String, state: State<'_, AppState>) -> Result<CommandResponse, String> {
    submit_pin_inner(&state, &pin)
}

#[tauri::command]
fn observe_focus_for_test(
    app_name: String,
    title: String,
    state: State<'_, AppState>,
) -> Result<CommandResponse, String> {
    observe_focus_inner(&state, Some(WindowSnapshot::new(app_name, title)))
}

pub fn current_state_inner(state: &AppState) -> Result<GuardView, String> {
    let guard = state
        .guard
        .lock()
        .map_err(|_| "Stay state is unavailable")?;
    Ok(guard.view())
}

pub fn set_pin_inner(state: &AppState, pin: &str) -> Result<CommandResponse, String> {
    let mut guard = state
        .guard
        .lock()
        .map_err(|_| "Stay state is unavailable")?;
    guard.set_pin(pin).map_err(|error| error.to_string())?;
    Ok(CommandResponse {
        view: guard.view(),
        commands: Vec::new(),
    })
}

pub fn accept_stay_inner(state: &AppState) -> Result<CommandResponse, String> {
    let mut guard = state
        .guard
        .lock()
        .map_err(|_| "Stay state is unavailable")?;
    let commands = guard.accept_stay().map_err(|error| error.to_string())?;
    Ok(CommandResponse {
        view: guard.view(),
        commands,
    })
}

pub fn dismiss_candidate_inner(state: &AppState) -> Result<CommandResponse, String> {
    let mut guard = state
        .guard
        .lock()
        .map_err(|_| "Stay state is unavailable")?;
    let commands = guard.dismiss_candidate();
    Ok(CommandResponse {
        view: guard.view(),
        commands,
    })
}

pub fn stop_guarding_inner(state: &AppState) -> Result<CommandResponse, String> {
    let mut guard = state
        .guard
        .lock()
        .map_err(|_| "Stay state is unavailable")?;
    let commands = guard.stop_guarding();
    Ok(CommandResponse {
        view: guard.view(),
        commands,
    })
}

pub fn submit_pin_inner(state: &AppState, pin: &str) -> Result<CommandResponse, String> {
    let mut guard = state
        .guard
        .lock()
        .map_err(|_| "Stay state is unavailable")?;
    let submission = guard.submit_pin(pin).map_err(|error| error.to_string())?;
    Ok(CommandResponse {
        view: submission.view,
        commands: submission.commands,
    })
}

pub fn observe_focus_inner(
    state: &AppState,
    window: Option<WindowSnapshot>,
) -> Result<CommandResponse, String> {
    let mut guard = state
        .guard
        .lock()
        .map_err(|_| "Stay state is unavailable")?;
    let commands = guard.observe_focus(window);
    Ok(CommandResponse {
        view: guard.view(),
        commands,
    })
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = position_top_right(&window);
            }
            spawn_focus_loop(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            current_state,
            set_pin,
            accept_stay,
            dismiss_candidate,
            stop_guarding,
            submit_pin,
            observe_focus_for_test
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Stay desktop application");
}

fn spawn_focus_loop(app: tauri::AppHandle) {
    thread::spawn(move || {
        let provider = ActiveWinFocusProvider;
        loop {
            let window = provider.active_window().ok().flatten();
            let state = app.state::<AppState>();
            if let Ok(response) = observe_focus_inner(&state, window)
                && !response.commands.is_empty()
            {
                let _ = app.emit("stay-state-changed", response);
            }
            thread::sleep(POLL_INTERVAL);
        }
    });
}

fn position_top_right(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };

    let margin = logical_margin_to_physical(monitor.scale_factor());
    let position = top_right_position(*monitor.work_area(), window.outer_size()?, margin);
    window.set_position(tauri::Position::Physical(position))?;
    Ok(())
}

fn logical_margin_to_physical(scale_factor: f64) -> i32 {
    (WINDOW_MARGIN_LOGICAL * scale_factor).round() as i32
}

fn top_right_position(
    work_area: PhysicalRect<i32, u32>,
    window_size: PhysicalSize<u32>,
    margin: i32,
) -> PhysicalPosition<i32> {
    let x = clamp_axis_to_work_area(
        work_area.position.x + work_area.size.width as i32 - window_size.width as i32 - margin,
        work_area.position.x,
        work_area.size.width,
        window_size.width,
        margin,
    );
    let y = clamp_axis_to_work_area(
        work_area.position.y + margin,
        work_area.position.y,
        work_area.size.height,
        window_size.height,
        margin,
    );

    PhysicalPosition { x, y }
}

fn clamp_axis_to_work_area(
    preferred_start: i32,
    area_start: i32,
    area_length: u32,
    item_length: u32,
    margin: i32,
) -> i32 {
    let min_start = area_start + margin;
    let max_start = area_start + area_length as i32 - item_length as i32 - margin;

    if max_start < min_start {
        area_start
    } else {
        preferred_start.clamp(min_start, max_start)
    }
}

#[cfg(test)]
mod window_position_tests {
    use super::*;

    #[test]
    fn positions_window_inside_scaled_work_area() {
        let work_area = PhysicalRect {
            position: PhysicalPosition { x: 0, y: 48 },
            size: PhysicalSize {
                width: 1512,
                height: 934,
            },
        };

        let position = top_right_position(
            work_area,
            PhysicalSize {
                width: 720,
                height: 640,
            },
            48,
        );

        assert_eq!(position, PhysicalPosition { x: 744, y: 96 });
    }

    #[test]
    fn clamps_position_when_window_is_larger_than_the_work_area() {
        let work_area = PhysicalRect {
            position: PhysicalPosition { x: 120, y: 80 },
            size: PhysicalSize {
                width: 500,
                height: 300,
            },
        };

        let position = top_right_position(
            work_area,
            PhysicalSize {
                width: 640,
                height: 360,
            },
            24,
        );

        assert_eq!(position, PhysicalPosition { x: 120, y: 80 });
    }
}
