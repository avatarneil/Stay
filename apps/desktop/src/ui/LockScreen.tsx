import { FormEvent, useState } from "react";
import type { GuardView } from "../types";
import { windowLabel } from "../types";
import { cleanPinInput } from "./pinInput";

type LockedView = Extract<GuardView, { mode: "locked" }>;

type LockScreenProps = {
  view: LockedView;
  error: string | null;
  onSubmit(pin: string): Promise<boolean>;
};

export function LockScreen({ view, error, onSubmit }: LockScreenProps) {
  const [pin, setPin] = useState("");
  const visibleError = error || view.last_error;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accepted = await onSubmit(pin);
    if (accepted) {
      setPin("");
    }
  }

  return (
    <section className="mode-panel mode-panel-active">
      <p className="kicker">Stay with the call</p>
      <h2>Enter your PIN.</h2>
      <p className="muted">
        {view.focused.app_name}
        {view.focused.title ? `: ${windowLabel(view.focused)}` : ""}
      </p>
      <form className="unlock-form" noValidate onSubmit={handleSubmit}>
        <div className="control-row">
          <input
            aria-label="Unlock PIN"
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]{4}"
            autoComplete="off"
            value={pin}
            aria-invalid={Boolean(visibleError)}
            aria-describedby={visibleError ? "unlock-error" : undefined}
            onChange={(event) => setPin(cleanPinInput(event.currentTarget.value))}
          />
          <button type="submit">Open</button>
        </div>
      </form>
      <p id="unlock-error" className="error-line" role="status">
        {visibleError}
      </p>
    </section>
  );
}
