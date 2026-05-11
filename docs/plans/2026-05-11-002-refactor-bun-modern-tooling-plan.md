---
title: "refactor: Use Bun and Modern Tooling"
type: refactor
status: completed
date: 2026-05-11
---

# refactor: Use Bun and Modern Tooling

## Summary

Move Stay's desktop JavaScript tooling from npm-shaped setup to Bun-first setup, pin the current stable toolchain choices in lockfiles and metadata, and make CI prove those choices stay reproducible.

---

## Assumptions

*This plan was authored without synchronous user confirmation. The items below are agent inferences that fill gaps in the input -- un-validated bets that should be reviewed before implementation proceeds.*

- "Use Bun instead of npm" means the `apps/desktop` package should install and run through Bun, with npm commands removed from project documentation.
- "Most modern tooling possible" means current stable releases and reproducible package management, not local-version drift, release candidates, or adding a frontend framework that the static Tauri UI does not need.
- Rust remains managed by Cargo; the Bun migration applies to the desktop package manager and JavaScript-side Tauri CLI workflow.

---

## Requirements

- R1. Replace npm-based desktop setup instructions with Bun-first commands.
- R2. Declare and lock the Bun package-manager choice so installs are reproducible for local agents and CI.
- R3. Update the desktop Tauri JavaScript CLI and matching Rust Tauri crates to current stable compatible versions.
- R4. Add CI coverage that installs the desktop package with Bun using the committed lockfile.
- R5. Preserve the existing static `apps/desktop/dist` UI shape; do not introduce an unnecessary bundler, framework, or generated frontend build pipeline.

---

## Scope Boundaries

- No UI redesign or behavior changes to the meeting focus guard.
- No migration away from Cargo for Rust dependencies.
- No Tauri mobile workflow or app-store packaging changes.
- No adoption of release-candidate dependencies unless a stable path is unavailable.

---

## Context & Research

### Relevant Code and Patterns

- `apps/desktop/package.json` is the only JavaScript package and currently depends on `@tauri-apps/cli`.
- `README.md` and `docs/development.md` are the only project docs that mention npm.
- `.github/workflows/ci.yml` currently verifies Rust formatting, linting, tests, and scripted E2E, but does not verify JavaScript package installation.
- `Cargo.toml` centralizes workspace dependency versions for Tauri, `tauri-build`, and other Rust crates.

### Institutional Learnings

- No `docs/solutions/` entries exist yet.

### External References

- Bun install docs: https://bun.sh/docs/pm/cli/install
- Bun lockfile docs: https://bun.com/docs/pm/lockfile
- Bun GitHub Actions guide: https://bun.sh/guides/runtime/cicd
- Tauri desktop development docs: https://v2.tauri.app/develop/
- Bun GitHub release metadata showed latest stable Bun `1.3.13`.
- Crates.io package discovery showed current stable `tauri` `2.11.1`, `tauri-build` `2.6.1`, and `thiserror` `2.0.18`.
- npm package metadata showed current stable `@tauri-apps/cli` `2.11.1`.

---

## Key Technical Decisions

- Use Bun's text lockfile: commit `apps/desktop/bun.lock` rather than npm, pnpm, or Yarn lockfiles because Bun now defaults to text `bun.lock` and expects it to be committed.
- Pin package-manager intent in `package.json` and `.bun-version`: add a `packageManager` field and Bun version file so humans, editors, agents, and CI all converge on the same Bun release.
- Keep package scripts stable: keep `dev` and `build` script entry points so existing muscle memory still works through `bun run`.
- Update Tauri in both ecosystems together: align `@tauri-apps/cli`, `tauri`, and `tauri-build` to current stable versions to avoid CLI/runtime skew.
- Verify Bun in CI separately from Rust checks: add an install-only Bun step that proves the lockfile is fresh without turning the static UI into a full frontend build project.

---

## Open Questions

### Resolved During Planning

- Should this add a new frontend framework or bundler? No. The current Tauri shell serves static files from `apps/desktop/dist`, and adding build tooling would expand scope without serving the request.
- Should CI use the latest Bun action or pin a specific Bun version? Use the official setup action with a repo-owned Bun version file so CI stays current by intentional edits rather than runner drift.

### Deferred to Implementation

- Exact Bun version string in `packageManager`: use the latest stable Bun release discovered during implementation unless installation reveals a compatibility constraint.
- Whether `bun run build` is practical in local verification: attempt lightweight package and Rust checks first, then report any platform-specific Tauri build constraints rather than weakening CI.

---

## Implementation Units

### U1. Bun Package Metadata and Lockfile

**Goal:** Make `apps/desktop` explicitly Bun-managed and reproducible.

**Requirements:** R1, R2, R5

**Dependencies:** None

**Files:**
- Modify: `apps/desktop/package.json`
- Create: `.bun-version`
- Create: `apps/desktop/bun.lock`

**Approach:**
- Add Bun package-manager metadata to `apps/desktop/package.json` and a root `.bun-version`.
- Generate the Bun lockfile from the desktop package and commit the text lockfile.
- Keep existing script names so `bun run dev` and `bun run build` remain obvious.

**Patterns to follow:**
- Existing minimal package shape in `apps/desktop/package.json`.
- Bun lockfile and package-manager docs.

**Test scenarios:**
- Happy path: installing from `apps/desktop/package.json` produces a stable `bun.lock` that does not change on a second frozen install.
- Edge case: no npm lockfile is introduced or required after the migration.

**Verification:**
- Desktop package dependencies resolve through Bun with the committed lockfile.

---

### U2. Current Stable Tauri and Rust Tooling Versions

**Goal:** Bring Tauri-related tooling and obvious stale workspace dependencies to current stable versions without broad dependency churn.

**Requirements:** R3, R5

**Dependencies:** U1

**Files:**
- Modify: `Cargo.toml`
- Modify: `Cargo.lock`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/bun.lock`

**Approach:**
- Align the Rust `tauri` and `tauri-build` workspace dependencies with the stable Tauri CLI version used by `apps/desktop`.
- Refresh stale direct workspace dependency versions only where package discovery shows a newer stable patch release and the update is low-risk.
- Refresh lockfiles through the native package managers instead of manual lockfile edits.

**Patterns to follow:**
- Existing workspace dependency centralization in `Cargo.toml`.
- Existing Tauri v2 configuration in `apps/desktop/src-tauri/tauri.conf.json`.

**Test scenarios:**
- Happy path: Rust workspace resolves and tests with the updated dependency graph.
- Integration: the Tauri desktop crate still compiles through Cargo after the CLI/runtime version alignment.

**Verification:**
- Cargo checks and tests complete with the updated dependency graph.

---

### U3. Bun-First Documentation and CI

**Goal:** Make the repo tell developers and CI to use Bun instead of npm.

**Requirements:** R1, R2, R4

**Dependencies:** U1

**Files:**
- Modify: `README.md`
- Modify: `docs/development.md`
- Modify: `.github/workflows/ci.yml`

**Approach:**
- Replace npm desktop setup commands in docs with Bun install/run commands.
- Add a CI step that installs Bun from the repo-owned version file with the official action and verifies the desktop package against the committed lockfile.
- Include the new branch family in push CI triggers if the implementation branch uses `refactor/**`.

**Patterns to follow:**
- Existing concise development docs in `docs/development.md`.
- Existing GitHub Actions workflow style in `.github/workflows/ci.yml`.

**Test scenarios:**
- Happy path: following the README desktop setup uses Bun only.
- Integration: CI validates the Bun lockfile before the existing Rust checks run.

**Verification:**
- Documentation contains no npm desktop setup commands.
- CI configuration has a Bun install verification path for `apps/desktop`.

---

## System-Wide Impact

- **Interaction graph:** Developer setup and CI become Bun-aware; runtime app behavior is unchanged.
- **Error propagation:** Package install failures should fail CI early before Rust checks consume time.
- **State lifecycle risks:** Lockfile drift is the main risk; the frozen Bun install check should catch it.
- **API surface parity:** Local docs, package metadata, and CI should all agree on Bun as the desktop package manager.
- **Integration coverage:** Rust workspace checks remain the primary proof for application behavior; Bun coverage proves package reproducibility.
- **Unchanged invariants:** Static desktop assets, Tauri config behavior, Rust core policy, and platform adapter behavior remain unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Tauri CLI and Rust crate versions drift apart | Update JavaScript CLI and Rust Tauri crates together and verify the workspace compiles. |
| Bun install behavior differs from npm for native CLI packages | Use the current Bun lockfile flow and verify installation locally and in CI. |
| CI runtime increases without adding value | Keep the Bun CI step install-focused rather than building the full desktop bundle unless implementation reveals a cheap reliable build path. |

---

## Documentation / Operational Notes

- `README.md` and `docs/development.md` should be the source of truth for local desktop commands after this change.
- Future JavaScript dependencies should be added with Bun so `apps/desktop/bun.lock` remains authoritative.

---

## Sources & References

- Bun install docs: https://bun.sh/docs/pm/cli/install
- Bun lockfile docs: https://bun.com/docs/pm/lockfile
- Bun GitHub Actions guide: https://bun.sh/guides/runtime/cicd
- Tauri desktop development docs: https://v2.tauri.app/develop/
- Related code: `apps/desktop/package.json`
- Related code: `.github/workflows/ci.yml`
- Related code: `Cargo.toml`
