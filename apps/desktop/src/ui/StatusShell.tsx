import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ReactNode } from "react";

type StatusShellProps = {
  mode: string;
  children: ReactNode;
  status?: string;
};

export function StatusShell({ mode, children, status }: StatusShellProps) {
  return (
    <main className={`stay-shell stay-shell-${mode}`} aria-live="polite">
      <header className="brand-strip" data-tauri-drag-region>
        <div className="brand-label" data-tauri-drag-region>
          <p className="eyebrow" data-tauri-drag-region>
            Stay
          </p>
          <h1 data-tauri-drag-region>Stay focused.</h1>
        </div>
        <div className="brand-controls">
          {status ? <span className="status-pill">{status}</span> : null}
          <button
            type="button"
            className="window-close"
            aria-label="Hide Stay window"
            onClick={hideWindow}
          >
            <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
              <path
                d="M2 2L10 10M10 2L2 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>
      {children}
    </main>
  );
}

function hideWindow(): void {
  if (!isTauri()) {
    return;
  }
  void getCurrentWindow().hide().catch(() => undefined);
}
