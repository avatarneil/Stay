import { invoke, isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CommandResponse, GuardView } from "./types";
import type { StayClient } from "./stayClient";
import { errorMessage } from "./stayClient";
import { GuardingStatus } from "./ui/GuardingStatus";
import { LaunchIntro } from "./ui/LaunchIntro";
import { LockScreen } from "./ui/LockScreen";
import { MeetingPrompt } from "./ui/MeetingPrompt";
import { PinSetup } from "./ui/PinSetup";
import { StatusShell } from "./ui/StatusShell";

const launchIntroStorageKey = "stay.launchIntro.v1.seen";
const launchIntroPreviewParam = "launchIntro";
const forceLaunchIntroEnv = "1";

const idleView: GuardView = {
  mode: "idle",
  pin_configured: false,
};

type AppProps = {
  client: StayClient;
  showLaunchIntro?: boolean;
};

type ActionError = {
  target: "setup" | "mode";
  message: string;
};

export function App({ client, showLaunchIntro: showLaunchIntroOverride }: AppProps) {
  const [view, setView] = useState<GuardView>(idleView);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [showLaunchIntro, setShowLaunchIntro] = useState(() =>
    showLaunchIntroOverride ?? shouldShowLaunchIntro(),
  );

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

  useEffect(() => {
    if (!showLaunchIntro) {
      return;
    }

    void setLaunchAnimationActive(true);

    return () => {
      void setLaunchAnimationActive(false);
    };
  }, [showLaunchIntro]);

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
  const needsPinSetup = !isLoading && !view.pin_configured;
  const canShowModePanels = !isLoading && view.pin_configured;
  const shellMode = view.pin_configured ? view.mode : "idle";
  const completeLaunchIntro = useCallback(() => {
    markLaunchIntroSeen();
    setShowLaunchIntro(false);
  }, []);

  return (
    <>
      <StatusShell mode={shellMode} status={status}>
        {isLoading ? (
          <section className="mode-panel quiet-state">
            <p className="kicker">Opening</p>
            <h2>Stay is opening.</h2>
          </section>
        ) : null}

        {needsPinSetup ? (
          <PinSetup error={setupError} onSave={(pin) => runCommand(() => client.setPin(pin), "setup")} />
        ) : null}

        {canShowModePanels && view.mode === "idle" ? (
          <section className="mode-panel quiet-state">
            <p className="kicker">Ready</p>
            <h2>Stay is waiting.</h2>
          </section>
        ) : null}

        {canShowModePanels && view.mode === "meeting_candidate" ? (
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

        {canShowModePanels && view.mode === "guarding" ? (
          <GuardingStatus
            meeting={view.meeting}
            error={modeError}
            onStop={() => {
              void runCommand(() => client.stopGuarding());
            }}
          />
        ) : null}

        {canShowModePanels && view.mode === "locked" ? (
          <LockScreen view={view} error={modeError} onSubmit={(pin) => runCommand(() => client.submitPin(pin))} />
        ) : null}
      </StatusShell>

      {showLaunchIntro ? (
        <LaunchIntro onComplete={completeLaunchIntro} />
      ) : null}
    </>
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

function shouldShowLaunchIntro(): boolean {
  if (isLaunchIntroForced()) {
    return true;
  }

  if (new URLSearchParams(window.location.search).get(launchIntroPreviewParam) === "1") {
    return true;
  }

  try {
    return window.localStorage.getItem(launchIntroStorageKey) !== "true";
  } catch {
    return true;
  }
}

function isLaunchIntroForced(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_STAY_FORCE_LAUNCH_INTRO === forceLaunchIntroEnv;
}

function markLaunchIntroSeen(): void {
  try {
    window.localStorage.setItem(launchIntroStorageKey, "true");
  } catch {
    // Storage can be unavailable in locked-down webviews; the intro still finishes for this session.
  }
}

async function setLaunchAnimationActive(active: boolean): Promise<void> {
  if (!isTauri()) {
    return;
  }

  try {
    await invoke("set_launch_animation_active", { active });
  } catch {
    // The visual animation is still usable if the native window resize is unavailable.
  }
}
