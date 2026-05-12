import { ChangeEvent, useId, useRef } from "react";
import { cleanPinInput, pinLength } from "./pinInput";

type PinCodeInputProps = {
  id?: string;
  label?: string;
  ariaLabel?: string;
  value: string;
  error: string | null;
  errorId?: string;
  onChange(value: string): void;
};

export function PinCodeInput({
  id,
  label,
  ariaLabel,
  value,
  error,
  errorId,
  onChange,
}: PinCodeInputProps) {
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = id ?? generatedId;
  const slots = Array.from({ length: pinLength }, (_, index) => value[index] ?? "");
  const activeSlotIndex = Math.min(value.length, pinLength - 1);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(cleanPinInput(event.currentTarget.value));
  }

  function focusInput() {
    inputRef.current?.focus();
  }

  return (
    <div className="pin-code-field">
      {label ? <label htmlFor={inputId}>{label}</label> : null}
      <div className="pin-code-input" data-invalid={Boolean(error)} onClick={focusInput}>
        <input
          ref={inputRef}
          id={inputId}
          className="pin-code-control"
          aria-label={ariaLabel}
          inputMode="numeric"
          maxLength={pinLength}
          pattern="[0-9]{4}"
          autoComplete="off"
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={handleChange}
        />
        <div className="pin-code-slots" aria-hidden="true">
          {slots.map((slot, index) => {
            const classes = [
              "pin-code-slot",
              slot ? "pin-code-slot-filled" : null,
              index === activeSlotIndex ? "pin-code-slot-active" : null,
            ]
              .filter(Boolean)
              .join(" ");

            return <span key={index} className={classes} />;
          })}
        </div>
      </div>
    </div>
  );
}
