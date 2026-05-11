# Stay

> Their hour deserves your hour. Stay in it.

Stay is a small desktop app for staying with the meeting you chose to attend.
When a likely meeting window is active, Stay can ask whether you want to stay
present. If you opt in, switching to another app brings up a four digit PIN
friction step.

Stay is local-only in this first slice. It does not record audio, transcribe,
capture the screen, phone home, score attention, or give managers a dashboard.

## What is here

- Rust workspace with `stay-core`, `stay-platform`, and `stay-e2e` crates.
- Tauri v2 desktop shell in `apps/desktop`.
- Modern React and TypeScript GUI source with deterministic frontend tests.
- Foreground-window meeting detection heuristics for Zoom, Google Meet,
  Microsoft Teams, FaceTime, Webex, and Slack huddles.
- Four digit PIN guard driven by the Rust state machine.
- Scripted E2E scenario that exercises the core meeting focus loop without
  requiring a human to switch apps.

## Run

```sh
cargo test --workspace
cargo run -p stay-e2e
```

For the desktop shell:

```sh
cd apps/desktop
bun install
bun run dev
```

For the GUI test/build loop without launching the native desktop shell:

```sh
cd apps/desktop
bun run typecheck
bun run test
bun run frontend:build
```

See `docs/development.md` and `docs/platform-permissions.md` for the working
notes that future implementation agents should read first.
