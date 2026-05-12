#!/usr/bin/env bash
set -euo pipefail

root_dir="$(git rev-parse --show-toplevel)"
app_dir="$root_dir/apps/desktop"

requested_port="${STAY_FRONTEND_PORT:-}"
explicit_port=false
if [[ -n "$requested_port" ]]; then
  explicit_port=true
fi

if [[ -z "$requested_port" && "${1:-}" =~ ^[0-9]+$ ]]; then
  requested_port="$1"
  explicit_port=true
  shift
fi

if [[ -z "$requested_port" ]]; then
  checksum="$(printf '%s' "$root_dir" | cksum | awk '{print $1}')"
  requested_port="$((1420 + (checksum % 400)))"
fi

if ! [[ "$requested_port" =~ ^[0-9]+$ ]] || ((requested_port < 1 || requested_port > 65535)); then
  echo "STAY_FRONTEND_PORT must be a TCP port between 1 and 65535; got '$requested_port'." >&2
  exit 2
fi

port_is_available() {
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

if ! port_is_available "$requested_port" && [[ "$explicit_port" == true ]]; then
  echo "Port $requested_port is already in use. Set STAY_FRONTEND_PORT or pass a port as the first argument." >&2
  exit 2
fi

if ! port_is_available "$requested_port"; then
  for candidate_port in $(seq "$((requested_port + 1))" 1819); do
    if port_is_available "$candidate_port"; then
      requested_port="$candidate_port"
      break
    fi
  done
fi

if ! port_is_available "$requested_port"; then
  echo "No available Stay dev port found in the 1420-1819 range." >&2
  exit 2
fi

branch_name="$(git -C "$root_dir" branch --show-current 2>/dev/null || true)"
if [[ -z "$branch_name" ]]; then
  branch_name="$(basename "$root_dir")"
fi

sanitized_name="$(
  printf '%s' "$branch_name" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
)"
if [[ -z "$sanitized_name" ]]; then
  sanitized_name="worktree"
fi

identifier_hash="$(printf '%s' "$root_dir" | cksum | awk '{print $1}')"
config_file="$(mktemp "${TMPDIR:-/tmp}/stay-worktree-tauri.XXXXXX.json")"
cleanup() {
  rm -f "$config_file"
}
trap cleanup EXIT

cat >"$config_file" <<JSON
{
  "productName": "Stay ${sanitized_name}",
  "identifier": "com.stay.present.dev${identifier_hash}",
  "build": {
    "beforeDevCommand": "bun run frontend:dev -- --port ${requested_port}",
    "devUrl": "http://127.0.0.1:${requested_port}"
  }
}
JSON

echo "Starting Stay dev sandbox for '$branch_name' on http://127.0.0.1:${requested_port}" >&2
cd "$app_dir"
bunx tauri dev --config "$config_file" "$@"
