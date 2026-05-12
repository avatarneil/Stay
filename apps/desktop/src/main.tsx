import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createMockStayClient } from "./mockStayClient";
import type { MockStayClient } from "./mockStayClient";
import type { StayClient } from "./stayClient";
import { createTauriStayClient } from "./stayClient";
import "./styles.css";

declare global {
  interface Window {
    __STAY_CLIENT__?: StayClient;
    __stayMock?: MockStayClient;
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

const root = document.querySelector("#root");

if (!root) {
  throw new Error("Stay root element is missing");
}

createRoot(root).render(
  <StrictMode>
    {currentSurface() === "guard-border" ? <GuardBorder /> : <App client={clientFromEnvironment()} />}
  </StrictMode>,
);

function GuardBorder() {
  return (
    <div className="guard-border-surface" aria-hidden="true">
      <div className="guard-border-frame" />
    </div>
  );
}

function currentSurface(): "main" | "guard-border" {
  if (new URLSearchParams(window.location.search).get("surface") === "guard-border") {
    return "guard-border";
  }

  if (!isTauri()) {
    return "main";
  }

  try {
    return getCurrentWindow().label === "guard-border" ? "guard-border" : "main";
  } catch {
    return "main";
  }
}

function clientFromEnvironment(): StayClient {
  if (window.__STAY_CLIENT__) {
    return window.__STAY_CLIENT__;
  }

  if (isTauri() || window.__TAURI__ || window.__TAURI_INTERNALS__) {
    return createTauriStayClient();
  }

  const mockClient = createMockStayClient();
  window.__STAY_CLIENT__ = mockClient;
  window.__stayMock = mockClient;
  return mockClient;
}
