export type MeetingApp =
  | "zoom"
  | "google_meet"
  | "microsoft_teams"
  | "facetime"
  | "webex"
  | "slack_huddle";

export type WindowSnapshot = {
  app_name: string;
  title: string;
  process_id: number | null;
  window_id: string | null;
  process_path: string | null;
};

export type MeetingCandidate = {
  app: MeetingApp;
  window: WindowSnapshot;
  reason: string;
};

export type LockedFocus = {
  app_name: string;
  title: string;
};

export type GuardView =
  | {
      mode: "idle";
      pin_configured: boolean;
    }
  | {
      mode: "meeting_candidate";
      candidate: MeetingCandidate;
      pin_configured: boolean;
    }
  | {
      mode: "guarding";
      meeting: MeetingCandidate;
      pin_configured: boolean;
    }
  | {
      mode: "locked";
      meeting: MeetingCandidate;
      focused: LockedFocus;
      failed_attempts: number;
      pin_configured: boolean;
      last_error: string | null;
    };

export type GuardCommand =
  | {
      type: "show_prompt";
      candidate: MeetingCandidate;
    }
  | {
      type: "hide_prompt";
    }
  | {
      type: "begin_guarding";
      meeting: MeetingCandidate;
    }
  | {
      type: "show_lock";
      meeting: MeetingCandidate;
      focused: LockedFocus;
    }
  | {
      type: "stay_locked";
      failed_attempts: number;
    }
  | {
      type: "unlock";
    }
  | {
      type: "stop_guarding";
    };

export type CommandResponse = {
  view: GuardView;
  commands: GuardCommand[];
};

export function meetingAppLabel(app: MeetingApp): string {
  const labels: Record<MeetingApp, string> = {
    zoom: "Zoom",
    google_meet: "Google Meet",
    microsoft_teams: "Microsoft Teams",
    facetime: "FaceTime",
    webex: "Webex",
    slack_huddle: "Slack huddle",
  };

  return labels[app];
}

export function windowLabel(window: Pick<WindowSnapshot, "app_name" | "title">): string {
  return window.title || window.app_name;
}
