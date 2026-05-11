import { FormEvent, useState } from "react";
import { cleanPinInput } from "./pinInput";

type PinSetupProps = {
  error: string | null;
  onSave(pin: string): Promise<boolean>;
};

export function PinSetup({ error, onSave }: PinSetupProps) {
  const [pin, setPin] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSave(pin);
    if (saved) {
      setPin("");
    }
  }

  return (
    <form className="pin-setup mode-panel" noValidate onSubmit={handleSubmit}>
      <label htmlFor="setup-pin">Set a four digit PIN</label>
      <div className="control-row">
        <input
          id="setup-pin"
          inputMode="numeric"
          maxLength={4}
          pattern="[0-9]{4}"
          autoComplete="off"
          value={pin}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "setup-error" : undefined}
          onChange={(event) => setPin(cleanPinInput(event.currentTarget.value))}
        />
        <button type="submit">Keep</button>
      </div>
      <p id="setup-error" className="error-line" role="status">
        {error}
      </p>
    </form>
  );
}
