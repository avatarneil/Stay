import { FormEvent, useState } from "react";
import type { GuardView } from "../types";
import { windowLabel } from "../types";
import { PinCodeInput } from "./PinCodeInput";
import { isCompletePin } from "./pinInput";

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
    if (!isCompletePin(pin)) {
      return;
    }

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
        <div className="control-row pin-entry-row">
          <PinCodeInput
            ariaLabel="Unlock PIN"
            value={pin}
            error={visibleError}
            errorId="unlock-error"
            onChange={setPin}
          />
          <button type="submit" disabled={!isCompletePin(pin)}>
            Open
          </button>
        </div>
      </form>
      <p id="unlock-error" className="error-line" role="status">
        {visibleError}
      </p>
    </section>
  );
}
