#![forbid(unsafe_code)]

pub mod active_window;

pub use active_window::{
    ActiveWinFocusProvider, FocusError, FocusProvider, active_window_to_snapshot,
};
