# Stay Development

Stay is organized around a Rust core with thin adapters around it.

## Workspace

- `crates/stay-core`: meeting classification, PIN validation, and focus guard
  state transitions.
- `crates/stay-platform`: native active-window adapter.
- `crates/stay-e2e`: deterministic end-to-end scenario runner.
- `apps/desktop`: Tauri v2 shell and quiet React/TypeScript GUI.

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
cd apps/desktop && bun run typecheck
cd apps/desktop && bun run test
```

The scripted E2E runner is intentionally independent of the host desktop. It
feeds mock focus changes and PIN submissions into the same Rust state machine
used by the Tauri app.

## Desktop Shell

The Tauri shell renders generated files from `apps/desktop/dist` and calls Rust
commands through the Tauri bridge. Authored GUI source lives in
`apps/desktop/src`; do not edit generated `dist` files by hand.

The desktop package is Bun-managed. Use the repository `.bun-version` and the
committed `apps/desktop/bun.lock` when installing or updating JavaScript
tooling.

To run the native shell locally:

```sh
cd apps/desktop
bun install
bun run dev
```

To run multiple worktrees at the same time, launch each checkout through the
worktree dev sandbox. It gives that checkout a deterministic frontend port and
temporary Tauri identifier so concurrent shells do not fight over `1420` or the
same app identity:

```sh
cd apps/desktop
bun run dev:worktree
```

Pass an explicit port when you want fixed lanes:

```sh
cd apps/desktop
bun run dev:worktree -- 1431
```

The same helper can be run from the repository root:

```sh
scripts/stay-worktree-dev.sh 1431
```

To work on the GUI without launching Tauri, run the Vite dev server:

```sh
cd apps/desktop
bun run frontend:dev
```

Outside the Tauri runtime, the GUI uses the deterministic mock Stay client. This
lets agents inspect and test mode transitions in a browser without foreground
window permissions. Browser-mode agents can drive states through
`window.__stayMock.focusMeeting()`, `window.__stayMock.focusAway()`, and the
same command methods exposed by the typed Stay client.

Production GUI assets are generated with:

```sh
cd apps/desktop
bun run frontend:build
```

The current window is always-on-top and positioned near the top-right monitor
edge at startup. This is a friction layer, not an OS-level security boundary.

## Development Posture

- Keep policy in `stay-core`; UI code should render state and send user actions.
- Keep platform behavior behind traits so tests can stay deterministic.
- Keep Tauri calls behind the typed `apps/desktop/src/stayClient.ts` boundary so
  frontend tests can mock app state without duplicating Rust policy.
- Keep GUI components state-driven; `GuardView` is the rendering contract.
- Do not add telemetry, scoring, team enforcement, or remote activity reporting.
- Treat the PIN as voluntary friction, not strong authentication.
