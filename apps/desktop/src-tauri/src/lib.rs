use serde::Serialize;
use stay_core::{
    FocusGuard, GuardCommand, GuardView, LockedFocus, MeetingClassifier, WindowBounds,
    WindowSnapshot,
};
use stay_platform::{ActiveWinFocusProvider, FocusProvider};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

#[cfg(target_os = "macos")]
use tauri::{LogicalPosition, LogicalSize};

const COMPACT_WINDOW_MIN_WIDTH: u32 = 420;
const COMPACT_WINDOW_MAX_WIDTH: u32 = 960;
const COMPACT_WINDOW_MIN_HEIGHT: u32 = 220;
const COMPACT_WINDOW_MAX_HEIGHT: u32 = 480;
const COMPACT_WINDOW_WIDTH_RATIO: f64 = 0.25;
const COMPACT_WINDOW_ASPECT_RATIO: f64 = 2.0;
const GUARDING_HANDLE_MIN_WIDTH: u32 = 96;
const GUARDING_HANDLE_MAX_WIDTH: u32 = 168;
const GUARDING_HANDLE_MIN_HEIGHT: u32 = 34;
const GUARDING_HANDLE_MAX_HEIGHT: u32 = 48;
const GUARD_BORDER_LABEL: &str = "guard-border";
const WINDOW_MARGIN: i32 = 24;
const POLL_INTERVAL: Duration = Duration::from_millis(750);

pub struct AppState {
    guard: Mutex<FocusGuard>,
}

#[derive(Clone, Debug, PartialEq)]
enum OverlayGeometry {
    #[cfg(not(target_os = "macos"))]
    Physical {
        position: PhysicalPosition<i32>,
        size: PhysicalSize<u32>,
    },
    #[cfg(target_os = "macos")]
    Logical {
        position: LogicalPosition<f64>,
        size: LogicalSize<f64>,
    },
}

#[derive(Clone, Debug, PartialEq)]
struct WindowGeometry {
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
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
fn set_guarding_panel_expanded(
    expanded: bool,
    state: State<'_, AppState>,
    window: WebviewWindow,
) -> Result<(), String> {
    let is_guarding = {
        let guard = state
            .guard
            .lock()
            .map_err(|_| "Stay state is unavailable")?;
        matches!(guard.view(), GuardView::Guarding { .. })
    };

    if !is_guarding {
        return Ok(());
    }

    let result = if expanded {
        position_top_right(&window)
    } else {
        position_guarding_handle(&window)
    };

    result.map_err(|error| error.to_string())
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
            set_guarding_panel_expanded,
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

    let geometry = compact_window_geometry(*monitor.position(), *monitor.size());
    window.set_size(tauri::Size::Physical(geometry.size))?;
    window.set_position(tauri::Position::Physical(geometry.position))?;
    window.show()?;
    Ok(())
}

fn position_guarding_handle(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };

    let geometry = guarding_handle_geometry(*monitor.position(), *monitor.size());
    window.set_size(tauri::Size::Physical(geometry.size))?;
    window.set_position(tauri::Position::Physical(geometry.position))?;
    window.show()?;
    Ok(())
}

fn compact_window_geometry(
    monitor_position: PhysicalPosition<i32>,
    monitor_size: PhysicalSize<u32>,
) -> WindowGeometry {
    let available_width = available_monitor_axis(monitor_size.width);
    let available_height = available_monitor_axis(monitor_size.height);

    let width = ((monitor_size.width as f64) * COMPACT_WINDOW_WIDTH_RATIO)
        .round()
        .clamp(
            COMPACT_WINDOW_MIN_WIDTH as f64,
            COMPACT_WINDOW_MAX_WIDTH as f64,
        ) as u32;
    let width = width.min(available_width);

    let height = ((width as f64) / COMPACT_WINDOW_ASPECT_RATIO)
        .round()
        .clamp(
            COMPACT_WINDOW_MIN_HEIGHT as f64,
            COMPACT_WINDOW_MAX_HEIGHT as f64,
        ) as u32;
    let height = height.min(available_height);

    top_right_geometry(monitor_position, monitor_size, width, height)
}

fn guarding_handle_geometry(
    monitor_position: PhysicalPosition<i32>,
    monitor_size: PhysicalSize<u32>,
) -> WindowGeometry {
    let compact = compact_window_geometry(monitor_position, monitor_size);
    let available_width = available_monitor_axis(monitor_size.width);
    let available_height = available_monitor_axis(monitor_size.height);

    let width = ((compact.size.width as f64) * 0.18).round().clamp(
        GUARDING_HANDLE_MIN_WIDTH as f64,
        GUARDING_HANDLE_MAX_WIDTH as f64,
    ) as u32;
    let height = ((compact.size.height as f64) * 0.16).round().clamp(
        GUARDING_HANDLE_MIN_HEIGHT as f64,
        GUARDING_HANDLE_MAX_HEIGHT as f64,
    ) as u32;

    top_right_geometry(
        monitor_position,
        monitor_size,
        width.min(available_width),
        height.min(available_height),
    )
}

fn top_right_geometry(
    monitor_position: PhysicalPosition<i32>,
    monitor_size: PhysicalSize<u32>,
    width: u32,
    height: u32,
) -> WindowGeometry {
    let margin = WINDOW_MARGIN.max(0) as u32;
    let x = monitor_position.x + monitor_size.width.saturating_sub(width + margin) as i32;
    let y = monitor_position.y + margin as i32;

    WindowGeometry {
        position: PhysicalPosition { x, y },
        size: PhysicalSize { width, height },
    }
}

fn available_monitor_axis(length: u32) -> u32 {
    let margin = WINDOW_MARGIN.max(0) as u32;
    length.saturating_sub(margin * 2).max(1)
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
    window.show()?;
    Ok(())
}

fn apply_window_commands(window: &WebviewWindow, commands: &[GuardCommand]) -> tauri::Result<()> {
    if let Some(focused) = commands.iter().find_map(|command| {
        if let GuardCommand::ShowLock { focused, .. } = command {
            Some(focused)
        } else {
            None
        }
    }) {
        hide_guard_border(&window.app_handle())?;
        return position_focused_window_overlay(window, focused);
    }

    if commands.iter().any(|command| {
        matches!(
            command,
            GuardCommand::BeginGuarding { .. } | GuardCommand::Unlock
        )
    }) {
        show_guard_border(&window.app_handle(), window)?;
        position_guarding_handle(window)?;
        return Ok(());
    }

    if commands.iter().any(|command| {
        matches!(
            command,
            GuardCommand::ShowPrompt { .. } | GuardCommand::HidePrompt | GuardCommand::StopGuarding
        )
    }) {
        hide_guard_border(&window.app_handle())?;
        position_top_right(window)?;
    }

    Ok(())
}

fn show_guard_border(app: &AppHandle, anchor: &WebviewWindow) -> tauri::Result<()> {
    let border = match app.get_webview_window(GUARD_BORDER_LABEL) {
        Some(border) => border,
        None => WebviewWindowBuilder::new(
            app,
            GUARD_BORDER_LABEL,
            WebviewUrl::App("index.html".into()),
        )
        .title("Stay Guard Border")
        .decorations(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .focusable(false)
        .focused(false)
        .visible(false)
        .build()?,
    };

    let Some(monitor) = anchor.current_monitor()? else {
        return Ok(());
    };

    border.set_ignore_cursor_events(true)?;
    border.set_position(tauri::Position::Physical(*monitor.position()))?;
    border.set_size(tauri::Size::Physical(*monitor.size()))?;
    border.show()?;
    Ok(())
}

fn hide_guard_border(app: &AppHandle) -> tauri::Result<()> {
    if let Some(border) = app.get_webview_window(GUARD_BORDER_LABEL) {
        border.hide()?;
    }

    Ok(())
}

fn position_focused_window_overlay(
    window: &WebviewWindow,
    focused: &LockedFocus,
) -> tauri::Result<()> {
    let Some(geometry) = focused_overlay_geometry(focused) else {
        return position_monitor_overlay(window);
    };

    match geometry {
        #[cfg(not(target_os = "macos"))]
        OverlayGeometry::Physical { position, size } => {
            window.set_position(tauri::Position::Physical(position))?;
            window.set_size(tauri::Size::Physical(size))?;
        }
        #[cfg(target_os = "macos")]
        OverlayGeometry::Logical { position, size } => {
            window.set_position(tauri::Position::Logical(position))?;
            window.set_size(tauri::Size::Logical(size))?;
        }
    };

    window.show()?;
    Ok(())
}

fn focused_overlay_geometry(focused: &LockedFocus) -> Option<OverlayGeometry> {
    let bounds = focused.bounds.as_ref()?;
    if bounds.width == 0 || bounds.height == 0 {
        return None;
    }

    Some(overlay_geometry_from_bounds(bounds))
}

fn overlay_geometry_from_bounds(bounds: &WindowBounds) -> OverlayGeometry {
    #[cfg(target_os = "macos")]
    {
        // active-win-pos-rs reads kCGWindowBounds on macOS, which are screen points.
        // Passing them as physical pixels lets Tao divide by the Stay window scale factor.
        OverlayGeometry::Logical {
            position: LogicalPosition {
                x: f64::from(bounds.x),
                y: f64::from(bounds.y),
            },
            size: LogicalSize {
                width: f64::from(bounds.width),
                height: f64::from(bounds.height),
            },
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        OverlayGeometry::Physical {
            position: PhysicalPosition {
                x: bounds.x,
                y: bounds.y,
            },
            size: PhysicalSize {
                width: bounds.width,
                height: bounds.height,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn locked_focus(bounds: Option<WindowBounds>) -> LockedFocus {
        LockedFocus {
            app_name: "Slack".to_string(),
            title: "Messages".to_string(),
            bounds,
        }
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn focused_overlay_geometry_uses_macos_logical_screen_points() {
        let focused = locked_focus(Some(WindowBounds {
            x: 3360,
            y: -323,
            width: 1440,
            height: 1265,
        }));

        assert_eq!(
            focused_overlay_geometry(&focused),
            Some(OverlayGeometry::Logical {
                position: LogicalPosition {
                    x: 3360.0,
                    y: -323.0
                },
                size: LogicalSize {
                    width: 1440.0,
                    height: 1265.0
                },
            })
        );
    }

    #[test]
    #[cfg(not(target_os = "macos"))]
    fn focused_overlay_geometry_uses_physical_pixels_off_macos() {
        let focused = locked_focus(Some(WindowBounds {
            x: 96,
            y: 88,
            width: 680,
            height: 420,
        }));

        assert_eq!(
            focused_overlay_geometry(&focused),
            Some(OverlayGeometry::Physical {
                position: PhysicalPosition { x: 96, y: 88 },
                size: PhysicalSize {
                    width: 680,
                    height: 420
                },
            })
        );
    }

    #[test]
    fn focused_overlay_geometry_rejects_missing_bounds() {
        let focused = locked_focus(None);

        assert_eq!(focused_overlay_geometry(&focused), None);
    }

    #[test]
    fn focused_overlay_geometry_rejects_empty_bounds() {
        let focused = locked_focus(Some(WindowBounds {
            x: 3360,
            y: -323,
            width: 0,
            height: 1265,
        }));

        assert_eq!(focused_overlay_geometry(&focused), None);
    }

    #[test]
    fn compact_window_geometry_scales_to_1080p() {
        assert_eq!(
            compact_window_geometry(
                PhysicalPosition { x: 0, y: 0 },
                PhysicalSize {
                    width: 1920,
                    height: 1080,
                },
            ),
            WindowGeometry {
                position: PhysicalPosition { x: 1416, y: 24 },
                size: PhysicalSize {
                    width: 480,
                    height: 240,
                },
            }
        );
    }

    #[test]
    fn compact_window_geometry_preserves_current_4k_size() {
        assert_eq!(
            compact_window_geometry(
                PhysicalPosition { x: 0, y: 0 },
                PhysicalSize {
                    width: 3840,
                    height: 2160,
                },
            ),
            WindowGeometry {
                position: PhysicalPosition { x: 2856, y: 24 },
                size: PhysicalSize {
                    width: 960,
                    height: 480,
                },
            }
        );
    }

    #[test]
    fn compact_window_geometry_keeps_a_usable_minimum() {
        assert_eq!(
            compact_window_geometry(
                PhysicalPosition { x: 100, y: 50 },
                PhysicalSize {
                    width: 1280,
                    height: 720,
                },
            ),
            WindowGeometry {
                position: PhysicalPosition { x: 936, y: 74 },
                size: PhysicalSize {
                    width: 420,
                    height: 220,
                },
            }
        );
    }

    #[test]
    fn guarding_handle_geometry_uses_top_right_hover_target() {
        assert_eq!(
            guarding_handle_geometry(
                PhysicalPosition { x: 0, y: 0 },
                PhysicalSize {
                    width: 1920,
                    height: 1080,
                },
            ),
            WindowGeometry {
                position: PhysicalPosition { x: 1800, y: 24 },
                size: PhysicalSize {
                    width: 96,
                    height: 38,
                },
            }
        );
    }
}
