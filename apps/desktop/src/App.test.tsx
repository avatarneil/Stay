import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { createMockStayClient } from "./mockStayClient";

describe("Stay GUI", () => {
  it("shows PIN setup in idle mode and constrains PIN input", async () => {
    const user = userEvent.setup();
    const client = createMockStayClient();

    render(<App client={client} />);

    const pinInput = await screen.findByLabelText("Set a four digit PIN");
    await user.type(pinInput, "12a345");

    expect(pinInput).toHaveValue("1234");

    await user.click(screen.getByRole("button", { name: "Keep" }));

    expect(client.view()).toMatchObject({ mode: "idle", pin_configured: true });
    expect(screen.getByText("Stay is waiting.")).toBeInTheDocument();
  });

  it("renders a meeting prompt and accepts Stay", async () => {
    const user = userEvent.setup();
    const client = createMockStayClient();
    await client.setPin("4821");
    client.focusMeeting();

    render(<App client={client} />);

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

    render(<App client={client} />);

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

    render(<App client={client} />);

    const unlockInput = await screen.findByLabelText("Unlock PIN");
    await user.type(unlockInput, "48x21");
    expect(unlockInput).toHaveValue("4821");

    await user.keyboard("{Enter}");

    expect(client.commandLog).toContain("submit_pin");
    expect(await screen.findByText("Keep the hour you agreed to.")).toBeInTheDocument();
  });

  it("rerenders when a client state-change event arrives", async () => {
    const client = createMockStayClient();
    await client.setPin("4821");

    render(<App client={client} />);

    expect(await screen.findByText("Stay is waiting.")).toBeInTheDocument();

    act(() => {
      client.focusMeeting();
    });

    expect(await screen.findByText("Stay with this meeting?")).toBeInTheDocument();
  });

  it("shows only PIN setup when a meeting is focused before setup", async () => {
    const user = userEvent.setup();
    const client = createMockStayClient();
    client.focusMeeting();

    render(<App client={client} />);

    expect(await screen.findByLabelText("Set a four digit PIN")).toBeInTheDocument();
    expect(screen.getByText("PIN needed")).toBeInTheDocument();
    expect(screen.queryByText("Stay with this meeting?")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stay" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Set a four digit PIN"), "12");
    await user.click(screen.getByRole("button", { name: "Keep" }));

    expect(await screen.findByText("PIN must be exactly four digits")).toBeInTheDocument();
    expect(screen.queryByText("Stay with this meeting?")).not.toBeInTheDocument();
  });
});
