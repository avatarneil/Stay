import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import type { FocusEvent, ReactNode } from "react";

const guardPanelCollapseDelayMs = 60;

type StatusShellProps = {
  mode: string;
  children: ReactNode;
  status?: string;
};

export function StatusShell({ mode, children, status }: StatusShellProps) {
  const isGuarding = mode === "guarding";
  const [isGuardPanelExpanded, setIsGuardPanelExpanded] = useState(false);
  const collapseTimer = useRef<number | undefined>(undefined);
  const isGuardPanelExpandedRef = useRef(false);

  useEffect(() => {
    if (!isGuarding) {
      isGuardPanelExpandedRef.current = false;
      setIsGuardPanelExpanded(false);
    }

    return () => {
      clearCollapseTimer(collapseTimer.current);
    };
  }, [isGuarding]);

  function revealGuardPanel(): void {
    clearCollapseTimer(collapseTimer.current);
    collapseTimer.current = undefined;
    commitGuardPanelExpanded(true);
  }

  function scheduleGuardPanelCollapse(): void {
    clearCollapseTimer(collapseTimer.current);
    collapseTimer.current = window.setTimeout(() => {
      collapseTimer.current = undefined;
      commitGuardPanelExpanded(false);
    }, guardPanelCollapseDelayMs);
  }

  function commitGuardPanelExpanded(expanded: boolean): void {
    if (isGuardPanelExpandedRef.current === expanded) {
      return;
    }

    isGuardPanelExpandedRef.current = expanded;
    setIsGuardPanelExpanded(expanded);

    if (!isTauri()) {
      return;
    }

    void invoke("set_guarding_panel_expanded", { expanded }).catch(() => undefined);
  }

  function handleBlur(event: FocusEvent<HTMLElement>): void {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      scheduleGuardPanelCollapse();
    }
  }

  const classes = [
    "stay-shell",
    `stay-shell-${mode}`,
    isGuarding ? (isGuardPanelExpanded ? "stay-shell-revealed" : "stay-shell-collapsed") : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main
      className={classes}
      aria-live="polite"
      tabIndex={isGuarding ? 0 : undefined}
      onMouseEnter={isGuarding ? revealGuardPanel : undefined}
      onMouseLeave={isGuarding ? scheduleGuardPanelCollapse : undefined}
      onFocusCapture={isGuarding ? revealGuardPanel : undefined}
      onBlurCapture={isGuarding ? handleBlur : undefined}
    >
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

function clearCollapseTimer(timer: number | undefined): void {
  if (timer !== undefined) {
    window.clearTimeout(timer);
  }
}
