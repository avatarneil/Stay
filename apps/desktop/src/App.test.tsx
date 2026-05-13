import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createMockStayClient } from "./mockStayClient";

function renderApp(client = createMockStayClient()) {
  return render(<App client={client} showLaunchIntro={false} />);
}

describe("Stay GUI", () => {
  it("shows PIN setup in idle mode and constrains PIN input", async () => {
    const user = userEvent.setup();
    const client = createMockStayClient();

    renderApp(client);

    const pinInput = await screen.findByLabelText("Set a four digit PIN");
    const keepButton = screen.getByRole("button", { name: "Keep" });

    expect(keepButton).toBeDisabled();
    expect(pinInput.closest(".pin-code-input")?.querySelectorAll(".pin-code-slot")).toHaveLength(4);

    await user.type(pinInput, "12a345");

    expect(pinInput).toHaveValue("1234");
    expect(keepButton).toBeEnabled();

    await user.click(keepButton);

    expect(client.view()).toMatchObject({ mode: "idle", pin_configured: true });
    expect(screen.getByText("Stay is waiting.")).toBeInTheDocument();
  });

  it("renders a meeting prompt and accepts Stay", async () => {
    const user = userEvent.setup();
    const client = createMockStayClient();
    await client.setPin("4821");
    client.focusMeeting();

    renderApp(client);

    expect(await screen.findByText("Stay with this meeting?")).toBeInTheDocument();
    expect(screen.getByText("Weekly Team Sync")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stay" }));

    expect(client.commandLog).toContain("accept_stay");
    expect(await screen.findByText("Stay is on")).toBeInTheDocument();
  });

  it("collapses the guarding tool until the hover handle is used", async () => {
    const user = userEvent.setup();
    const client = createMockStayClient();
    await client.setPin("4821");
    client.focusMeeting();

    renderApp(client);

    await user.click(await screen.findByRole("button", { name: "Stay" }));

    const shell = screen.getByRole("main");
    expect(shell).toHaveClass("stay-shell-collapsed");

    await user.hover(shell);
    expect(shell).toHaveClass("stay-shell-revealed");

    await user.unhover(shell);
    await waitFor(() => expect(shell).toHaveClass("stay-shell-collapsed"));
  });

  it("submits the unlock PIN from the locked state", async () => {
    const user = userEvent.setup();
    const client = createMockStayClient();
    await client.setPin("4821");
    client.focusMeeting();
    await client.acceptStay();
    client.focusAway();

    renderApp(client);

    const unlockInput = await screen.findByLabelText("Unlock PIN");
    const openButton = screen.getByRole("button", { name: "Open" });

    expect(openButton).toBeDisabled();
    expect(unlockInput.closest(".pin-code-input")?.querySelectorAll(".pin-code-slot")).toHaveLength(4);

    await user.type(unlockInput, "48x21");
    expect(unlockInput).toHaveValue("4821");
    expect(openButton).toBeEnabled();

    await user.keyboard("{Enter}");

    expect(client.commandLog).toContain("submit_pin");
    expect(await screen.findByText("Keep the hour you agreed to.")).toBeInTheDocument();
  });

  it("rerenders when a client state-change event arrives", async () => {
    const client = createMockStayClient();
    await client.setPin("4821");

    renderApp(client);

    expect(await screen.findByText("Stay is waiting.")).toBeInTheDocument();

    act(() => {
      client.focusMeeting();
    });

    expect(await screen.findByText("Stay with this meeting?")).toBeInTheDocument();
  });

  it("waits for a complete setup PIN instead of submitting invalid input", async () => {
    const user = userEvent.setup();
    const client = createMockStayClient();
    client.focusMeeting();

    renderApp(client);

    expect(await screen.findByText("Stay with this meeting?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stay" })).toBeDisabled();

    const pinInput = screen.getByLabelText("Set a four digit PIN");
    const keepButton = screen.getByRole("button", { name: "Keep" });

    await user.type(pinInput, "12");
    expect(keepButton).toBeDisabled();
    await user.click(keepButton);

    expect(client.commandLog).not.toContain("set_pin");
    expect(screen.queryByText("PIN must be exactly four digits")).not.toBeInTheDocument();
    expect(screen.getByText("Stay with this meeting?")).toBeInTheDocument();
  });

  it("shows the first-launch intro when enabled and dismisses it", async () => {
    const user = userEvent.setup();

    render(<App client={createMockStayClient()} showLaunchIntro={true} />);

    expect(await screen.findByLabelText("Stay opening animation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(screen.queryByLabelText("Stay opening animation")).not.toBeInTheDocument();
  });

  it("can force the first-launch intro in dev with an env flag", async () => {
    vi.stubEnv("VITE_STAY_FORCE_LAUNCH_INTRO", "1");

    try {
      render(<App client={createMockStayClient()} />);

      expect(await screen.findByLabelText("Stay opening animation")).toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
