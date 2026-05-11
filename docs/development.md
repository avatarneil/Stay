# Stay Development

Stay is organized around a Rust core with thin adapters around it.

## Workspace

- `crates/stay-core`: meeting classification, PIN validation, and focus guard
  state transitions.
- `crates/stay-platform`: native active-window adapter.
- `crates/stay-e2e`: deterministic end-to-end scenario runner.
- `apps/desktop`: Tauri v2 shell and quiet local UI.

## Verification

Run the full deterministic suite:

```sh
cargo test --workspace
cargo run -p stay-e2e
```

Run focused suites while working:

```sh
cargo test -p stay-core
cargo test -p stay-platform
cargo test -p stay-desktop
```

The scripted E2E runner is intentionally independent of the host desktop. It
feeds mock focus changes and PIN submissions into the same Rust state machine
used by the Tauri app.

## Desktop Shell

The Tauri shell renders static files from `apps/desktop/dist` and calls Rust
commands through the Tauri bridge. To run it locally:

```sh
cd apps/desktop
bun install
bun run dev
```

The desktop package is Bun-managed. Use the repository `.bun-version` and the
committed `apps/desktop/bun.lock` when installing or updating JavaScript
tooling.

The current window is always-on-top and positioned near the top-right monitor
edge at startup. This is a friction layer, not an OS-level security boundary.

## Development Posture

- Keep policy in `stay-core`; UI code should render state and send user actions.
- Keep platform behavior behind traits so tests can stay deterministic.
- Do not add telemetry, scoring, team enforcement, or remote activity reporting.
- Treat the PIN as voluntary friction, not strong authentication.
