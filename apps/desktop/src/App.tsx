import { useEffect, useMemo, useState } from "react";
import type { CommandResponse, GuardView } from "./types";
import type { StayClient } from "./stayClient";
import { errorMessage } from "./stayClient";
import { GuardingStatus } from "./ui/GuardingStatus";
import { LockScreen } from "./ui/LockScreen";
import { MeetingPrompt } from "./ui/MeetingPrompt";
import { PinSetup } from "./ui/PinSetup";
import { StatusShell } from "./ui/StatusShell";

const idleView: GuardView = {
  mode: "idle",
  pin_configured: false,
};

type AppProps = {
  client: StayClient;
};

type ActionError = {
  target: "setup" | "mode";
  message: string;
};

export function App({ client }: AppProps) {
  const [view, setView] = useState<GuardView>(idleView);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<ActionError | null>(null);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    client
      .currentState()
      .then((currentView) => {
        if (isMounted) {
          setView(currentView);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setActionError({ target: "mode", message: errorMessage(error) });
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    client
      .subscribe((nextView) => {
        setView(nextView);
        setActionError(null);
      })
      .then((unlisten) => {
        if (isMounted) {
          unsubscribe = unlisten;
        } else {
          unlisten();
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setActionError({ target: "mode", message: errorMessage(error) });
        }
      });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [client]);

  const status = useMemo(() => statusForView(view, isLoading), [isLoading, view]);

  async function runCommand(
    command: () => Promise<CommandResponse>,
    target: ActionError["target"] = "mode",
  ): Promise<boolean> {
    setActionError(null);
    try {
      const response = await command();
      setView(response.view);
      return response.view.mode !== "locked" || response.view.last_error === null;
    } catch (error: unknown) {
      setActionError({ target, message: errorMessage(error) });
      return false;
    }
  }

  const setupError = actionError?.target === "setup" ? actionError.message : null;
  const modeError = actionError?.target === "mode" ? actionError.message : null;

  return (
    <StatusShell mode={view.mode} status={status}>
      {isLoading ? (
        <section className="mode-panel quiet-state">
          <p className="kicker">Opening</p>
          <h2>Stay is opening.</h2>
        </section>
      ) : null}

      {!isLoading && !view.pin_configured ? (
        <PinSetup error={setupError} onSave={(pin) => runCommand(() => client.setPin(pin), "setup")} />
      ) : null}

      {!isLoading && view.mode === "idle" && view.pin_configured ? (
        <section className="mode-panel quiet-state">
          <p className="kicker">Ready</p>
          <h2>Stay is waiting.</h2>
        </section>
      ) : null}

      {!isLoading && view.mode === "meeting_candidate" ? (
        <MeetingPrompt
          candidate={view.candidate}
          canAccept={view.pin_configured}
          error={modeError}
          onAccept={() => {
            void runCommand(() => client.acceptStay());
          }}
          onDismiss={() => {
            void runCommand(() => client.dismissCandidate());
          }}
        />
      ) : null}

      {!isLoading && view.mode === "guarding" ? (
        <GuardingStatus
          meeting={view.meeting}
          error={modeError}
          onStop={() => {
            void runCommand(() => client.stopGuarding());
          }}
        />
      ) : null}

      {!isLoading && view.mode === "locked" ? (
        <LockScreen view={view} error={modeError} onSubmit={(pin) => runCommand(() => client.submitPin(pin))} />
      ) : null}
    </StatusShell>
  );
}

function statusForView(view: GuardView, isLoading: boolean): string {
  if (isLoading) {
    return "Opening";
  }

  if (!view.pin_configured) {
    return "PIN needed";
  }

  switch (view.mode) {
    case "idle":
      return "Ready";
    case "meeting_candidate":
      return "Meeting";
    case "guarding":
      return "On";
    case "locked":
      return "Locked";
  }
}
