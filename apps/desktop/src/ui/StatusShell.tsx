import type { ReactNode } from "react";

type StatusShellProps = {
  mode: string;
  children: ReactNode;
  status?: string;
};

export function StatusShell({ mode, children, status }: StatusShellProps) {
  return (
    <main className={`stay-shell stay-shell-${mode}`} aria-live="polite">
      <header className="brand-strip">
        <div>
          <p className="eyebrow">Stay</p>
          <h1>Stay focused.</h1>
        </div>
        {status ? <span className="status-pill">{status}</span> : null}
      </header>
      {children}
    </main>
  );
}
