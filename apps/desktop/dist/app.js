const app = document.querySelector("#app");
const setupPin = document.querySelector("#setup-pin");
const savePin = document.querySelector("#save-pin");
const setupError = document.querySelector("#setup-error");
const candidate = document.querySelector("#candidate");
const candidateApp = document.querySelector("#candidate-app");
const candidateTitle = document.querySelector("#candidate-title");
const acceptStay = document.querySelector("#accept-stay");
const dismissStay = document.querySelector("#dismiss-stay");
const guarding = document.querySelector("#guarding");
const guardingTitle = document.querySelector("#guarding-title");
const stopStay = document.querySelector("#stop-stay");
const locked = document.querySelector("#locked");
const lockedTitle = document.querySelector("#locked-title");
const lockedApp = document.querySelector("#locked-app");
const unlockPin = document.querySelector("#unlock-pin");
const unlockStay = document.querySelector("#unlock-stay");
const pinError = document.querySelector("#pin-error");

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

function onlyDigits(value) {
  return value.replace(/\D/g, "").slice(0, 4);
}

function setHidden(node, hidden) {
  node.hidden = hidden;
}

function render(view) {
  const mode = view.mode;
  const pinConfigured = Boolean(view.pin_configured);

  app.className = `panel panel-${mode}`;
  setHidden(document.querySelector("#pin-setup"), pinConfigured);
  setHidden(candidate, mode !== "meeting_candidate");
  setHidden(guarding, mode !== "guarding");
  setHidden(locked, mode !== "locked");

  if (mode === "meeting_candidate") {
    candidateApp.textContent = view.candidate.app.replaceAll("_", " ");
    candidateTitle.textContent = view.candidate.window.title || view.candidate.reason;
  }

  if (mode === "guarding") {
    guardingTitle.textContent =
      view.meeting.window.title || `${view.meeting.app.replaceAll("_", " ")} is protected.`;
  }

  if (mode === "locked") {
    lockedTitle.textContent = "Enter your PIN.";
    lockedApp.textContent = `${view.focused.app_name}: ${view.focused.title}`;
    pinError.textContent = view.last_error || "";
    unlockPin.focus();
  }
}

async function refresh() {
  render(await invoke("current_state"));
}

async function command(name, args = {}, errorTarget = pinError) {
  try {
    if (errorTarget) {
      errorTarget.textContent = "";
    }
    const response = await invoke(name, args);
    render(response.view || response);
  } catch (error) {
    if (errorTarget) {
      errorTarget.textContent = String(error);
    }
  }
}

[setupPin, unlockPin].forEach((input) => {
  input.addEventListener("input", () => {
    input.value = onlyDigits(input.value);
  });
});

savePin.addEventListener("click", async () => {
  await command("set_pin", { pin: setupPin.value }, setupError);
  setupPin.value = "";
});

acceptStay.addEventListener("click", () => command("accept_stay"));
dismissStay.addEventListener("click", () => command("dismiss_candidate"));
stopStay.addEventListener("click", () => command("stop_guarding"));
unlockStay.addEventListener("click", async () => {
  await command("submit_pin", { pin: unlockPin.value });
  unlockPin.value = "";
});

unlockPin.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    unlockStay.click();
  }
});

listen("stay-state-changed", (event) => {
  render(event.payload.view);
});

refresh();
