import { FormEvent, useState } from "react";
import { PinCodeInput } from "./PinCodeInput";
import { isCompletePin } from "./pinInput";

type PinSetupProps = {
  error: string | null;
  onSave(pin: string): Promise<boolean>;
};

export function PinSetup({ error, onSave }: PinSetupProps) {
  const [pin, setPin] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCompletePin(pin)) {
      return;
    }

    const saved = await onSave(pin);
    if (saved) {
      setPin("");
    }
  }

  return (
    <form className="pin-setup mode-panel" noValidate onSubmit={handleSubmit}>
      <div className="control-row pin-entry-row">
        <PinCodeInput
          id="setup-pin"
          label="Set a four digit PIN"
          value={pin}
          error={error}
          errorId="setup-error"
          onChange={setPin}
        />
        <button type="submit" disabled={!isCompletePin(pin)}>
          Keep
        </button>
      </div>
      <p id="setup-error" className="error-line" role="status">
        {error}
      </p>
    </form>
  );
}
