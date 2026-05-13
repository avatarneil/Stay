export const pinLength = 4;

export function cleanPinInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, pinLength);
}

export function isCompletePin(value: string): boolean {
  return value.length === pinLength;
}
