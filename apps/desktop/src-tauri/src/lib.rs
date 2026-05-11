use serde::Serialize;
use stay_core::{FocusGuard, GuardCommand, GuardView, MeetingClassifier, WindowSnapshot};
use stay_platform::{ActiveWinFocusProvider, FocusProvider};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow};

const COMPACT_WINDOW_WIDTH: i32 = 420;
const COMPACT_WINDOW_HEIGHT: i32 = 300;
const WINDOW_MARGIN: i32 = 24;
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
fn accept_stay(
    state: State<'_, AppState>,
    window: WebviewWindow,
) -> Result<CommandResponse, String> {
    let response = accept_stay_inner(&state)?;
    apply_window_commands(&window, &response.commands).map_err(|error| error.to_string())?;
    Ok(response)
}

#[tauri::command]
fn dismiss_candidate(
    state: State<'_, AppState>,
    window: WebviewWindow,
) -> Result<CommandResponse, String> {
    let response = dismiss_candidate_inner(&state)?;
    apply_window_commands(&window, &response.commands).map_err(|error| error.to_string())?;
    Ok(response)
}

#[tauri::command]
fn stop_guarding(
    state: State<'_, AppState>,
    window: WebviewWindow,
) -> Result<CommandResponse, String> {
    let response = stop_guarding_inner(&state)?;
    apply_window_commands(&window, &response.commands).map_err(|error| error.to_string())?;
    Ok(response)
}

#[tauri::command]
fn submit_pin(
    pin: String,
    state: State<'_, AppState>,
    window: WebviewWindow,
) -> Result<CommandResponse, String> {
    let response = submit_pin_inner(&state, &pin)?;
    apply_window_commands(&window, &response.commands).map_err(|error| error.to_string())?;
    Ok(response)
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
                if let Some(window) = app.get_webview_window("main") {
                    let _ = apply_window_commands(&window, &response.commands);
                }
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

    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let x = monitor_position.x + monitor_size.width as i32 - COMPACT_WINDOW_WIDTH - WINDOW_MARGIN;
    let y = monitor_position.y + WINDOW_MARGIN;
    window.set_size(tauri::Size::Physical(PhysicalSize {
        width: COMPACT_WINDOW_WIDTH as u32,
        height: COMPACT_WINDOW_HEIGHT as u32,
    }))?;
    window.set_position(tauri::Position::Physical(PhysicalPosition { x, y }))?;
    Ok(())
}

fn position_monitor_overlay(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };

    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    window.set_position(tauri::Position::Physical(PhysicalPosition {
        x: monitor_position.x,
        y: monitor_position.y,
    }))?;
    window.set_size(tauri::Size::Physical(PhysicalSize {
        width: monitor_size.width,
        height: monitor_size.height,
    }))?;
    Ok(())
}

fn apply_window_commands(window: &WebviewWindow, commands: &[GuardCommand]) -> tauri::Result<()> {
    if commands
        .iter()
        .any(|command| matches!(command, GuardCommand::ShowLock { .. }))
    {
        return position_monitor_overlay(window);
    }

    if commands.iter().any(|command| {
        matches!(
            command,
            GuardCommand::ShowPrompt { .. }
                | GuardCommand::HidePrompt
                | GuardCommand::BeginGuarding { .. }
                | GuardCommand::Unlock
                | GuardCommand::StopGuarding
        )
    }) {
        position_top_right(window)?;
    }

    Ok(())
}
