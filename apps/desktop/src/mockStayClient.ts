import type { CommandResponse, GuardView, MeetingCandidate, WindowSnapshot } from "./types";
import type { StateListener, StayClient, Unsubscribe } from "./stayClient";

const meeting: MeetingCandidate = {
  app: "zoom",
  window: windowSnapshot("zoom.us", "Weekly Team Sync"),
  reason: "Zoom foreground window",
};

const awayWindow: WindowSnapshot = windowSnapshot("Safari", "Quarterly planning notes");

export type MockStayClient = StayClient & {
  commandLog: string[];
  emitView(view: GuardView): CommandResponse;
  focusMeeting(): CommandResponse;
  focusAway(): CommandResponse;
  view(): GuardView;
};

export function createMockStayClient(initialView?: GuardView): MockStayClient {
  const listeners = new Set<StateListener>();
  const commandLog: string[] = [];
  let configuredPin: string | null = initialView?.pin_configured ? "4821" : null;
  let view: GuardView = initialView ?? { mode: "idle", pin_configured: false };

  function setView(nextView: GuardView, commands: CommandResponse["commands"] = []): CommandResponse {
    view = nextView;
    const response = { view, commands };
    listeners.forEach((listener) => listener(view));
    return response;
  }

  const client: MockStayClient = {
    commandLog,
    async currentState() {
      commandLog.push("current_state");
      return view;
    },
    async setPin(pin) {
      commandLog.push("set_pin");
      if (!/^\d{4}$/.test(pin)) {
        throw new Error("PIN must be exactly four digits");
      }

      configuredPin = pin;
      return setView({ mode: "idle", pin_configured: true });
    },
    async acceptStay() {
      commandLog.push("accept_stay");
      if (!configuredPin) {
        throw new Error("set a four digit PIN before turning on Stay");
      }

      return setView(
        { mode: "guarding", meeting, pin_configured: true },
        [{ type: "begin_guarding", meeting }],
      );
    },
    async dismissCandidate() {
      commandLog.push("dismiss_candidate");
      return setView({ mode: "idle", pin_configured: Boolean(configuredPin) }, [{ type: "hide_prompt" }]);
    },
    async stopGuarding() {
      commandLog.push("stop_guarding");
      return setView({ mode: "idle", pin_configured: Boolean(configuredPin) }, [{ type: "stop_guarding" }]);
    },
    async submitPin(pin) {
      commandLog.push("submit_pin");
      if (view.mode !== "locked") {
        throw new Error("Stay is not locked right now");
      }

      if (pin === configuredPin) {
        return setView(
          { mode: "guarding", meeting: view.meeting, pin_configured: true },
          [{ type: "unlock" }],
        );
      }

      return setView(
        {
          ...view,
          failed_attempts: view.failed_attempts + 1,
          last_error: "That PIN did not open Stay.",
        },
        [{ type: "stay_locked", failed_attempts: view.failed_attempts + 1 }],
      );
    },
    async subscribe(listener): Promise<Unsubscribe> {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emitView(nextView) {
      return setView(nextView);
    },
    focusMeeting() {
      return setView(
        {
          mode: "meeting_candidate",
          candidate: meeting,
          pin_configured: Boolean(configuredPin),
        },
        [{ type: "show_prompt", candidate: meeting }],
      );
    },
    focusAway() {
      return setView(
        {
          mode: "locked",
          meeting,
          focused: {
            app_name: awayWindow.app_name,
            title: awayWindow.title,
            bounds: awayWindow.bounds,
          },
          failed_attempts: 0,
          pin_configured: Boolean(configuredPin),
          last_error: null,
        },
        [
          {
            type: "show_lock",
            meeting,
            focused: {
              app_name: awayWindow.app_name,
              title: awayWindow.title,
              bounds: awayWindow.bounds,
            },
          },
        ],
      );
    },
    view() {
      return view;
    },
  };

  return client;
}

function windowSnapshot(appName: string, title: string): WindowSnapshot {
  return {
    app_name: appName,
    title,
    process_id: null,
    window_id: null,
    process_path: null,
    bounds: {
      x: 96,
      y: 88,
      width: 680,
      height: 420,
    },
  };
}
