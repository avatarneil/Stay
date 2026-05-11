# Platform Permissions

Stay detects meetings from foreground-window metadata: app name, window title,
process id, window id, and process path when available. This happens locally.
Stay does not record audio, read meeting content, capture the screen, or send
activity data anywhere.

## macOS

macOS may require Accessibility permission before foreground-window metadata is
available consistently. Fullscreen spaces can also affect whether the always-on-
top Stay window appears above a meeting. The first slice reports unavailable
focus data quietly rather than forcing permissions.

## Windows

Windows foreground-window metadata is expected to work through the native
adapter, but protected or elevated apps may not expose complete titles or process
paths. Stay should continue to run when metadata is partial.

## Linux

Linux support depends on desktop environment and session type. X11 sessions are
more likely to expose active-window metadata. Wayland compositors may restrict
foreground-window access by design. In restricted sessions, Stay should report
that focus detection is unavailable rather than pretending the meeting loop is
protected.

## Current Limit

The lock window is an always-on-top app window. It creates a deliberate pause
when attention leaves the protected meeting, but it is not a hardened operating
system lock. Stronger per-platform enforcement belongs in a future hardening
track after the first product loop is proven.
