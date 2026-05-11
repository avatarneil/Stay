import type { MeetingCandidate } from "../types";
import { meetingAppLabel, windowLabel } from "../types";

type MeetingPromptProps = {
  candidate: MeetingCandidate;
  canAccept: boolean;
  error: string | null;
  onAccept(): void;
  onDismiss(): void;
};

export function MeetingPrompt({ candidate, canAccept, error, onAccept, onDismiss }: MeetingPromptProps) {
  return (
    <section className="mode-panel mode-panel-active">
      <p className="kicker">{meetingAppLabel(candidate.app)}</p>
      <h2>Stay with this meeting?</h2>
      <p className="muted">{windowLabel(candidate.window) || candidate.reason}</p>
      <div className="action-row">
        <button type="button" disabled={!canAccept} onClick={onAccept}>
          Stay
        </button>
        <button type="button" className="ghost" onClick={onDismiss}>
          Not now
        </button>
      </div>
      <p className="error-line" role="status">
        {error}
      </p>
    </section>
  );
}
