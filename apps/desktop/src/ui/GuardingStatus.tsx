import type { MeetingCandidate } from "../types";
import { meetingAppLabel, windowLabel } from "../types";

type GuardingStatusProps = {
  meeting: MeetingCandidate;
  error: string | null;
  onStop(): void;
};

export function GuardingStatus({ meeting, error, onStop }: GuardingStatusProps) {
  return (
    <section className="mode-panel mode-panel-active">
      <p className="kicker">Stay is on</p>
      <h2>{windowLabel(meeting.window) || `${meetingAppLabel(meeting.app)} is protected.`}</h2>
      <p className="muted">Keep the hour you agreed to.</p>
      <div className="action-row">
        <button type="button" className="ghost strong-ghost" onClick={onStop}>
          Stop
        </button>
      </div>
      <p className="error-line" role="status">
        {error}
      </p>
    </section>
  );
}
