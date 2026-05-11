import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { CommandResponse, GuardView } from "./types";

export type StateListener = (view: GuardView) => void;
export type Unsubscribe = () => void;

export type StayClient = {
  currentState(): Promise<GuardView>;
  setPin(pin: string): Promise<CommandResponse>;
  acceptStay(): Promise<CommandResponse>;
  dismissCandidate(): Promise<CommandResponse>;
  stopGuarding(): Promise<CommandResponse>;
  submitPin(pin: string): Promise<CommandResponse>;
  subscribe(listener: StateListener): Promise<Unsubscribe>;
};

export function createTauriStayClient(): StayClient {
  return {
    currentState() {
      return invoke<GuardView>("current_state");
    },
    setPin(pin) {
      return invoke<CommandResponse>("set_pin", { pin });
    },
    acceptStay() {
      return invoke<CommandResponse>("accept_stay");
    },
    dismissCandidate() {
      return invoke<CommandResponse>("dismiss_candidate");
    },
    stopGuarding() {
      return invoke<CommandResponse>("stop_guarding");
    },
    submitPin(pin) {
      return invoke<CommandResponse>("submit_pin", { pin });
    },
    async subscribe(listener) {
      const unlisten = await listen<CommandResponse>("stay-state-changed", (event) => {
        listener(event.payload.view);
      });

      return () => {
        unlisten();
      };
    },
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Stay could not complete that action.";
}
