import { isTauri } from "@tauri-apps/api/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createMockStayClient } from "./mockStayClient";
import type { StayClient } from "./stayClient";
import { createTauriStayClient } from "./stayClient";
import "./styles.css";

declare global {
  interface Window {
    __STAY_CLIENT__?: StayClient;
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
    <App client={clientFromEnvironment()} />
  </StrictMode>,
);

function clientFromEnvironment(): StayClient {
  if (window.__STAY_CLIENT__) {
    return window.__STAY_CLIENT__;
  }

  if (isTauri() || window.__TAURI__ || window.__TAURI_INTERNALS__) {
    return createTauriStayClient();
  }

  return createMockStayClient();
}
