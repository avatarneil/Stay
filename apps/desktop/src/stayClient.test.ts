import { describe, expect, it } from "vitest";
import { createMockStayClient } from "./mockStayClient";

describe("mock Stay client", () => {
  it("drives the core GUI state sequence without Tauri", async () => {
    const client = createMockStayClient();

    await client.setPin("4821");
    client.focusMeeting();
    await client.acceptStay();
    client.focusAway();

    expect(client.view().mode).toBe("locked");

    await client.submitPin("4821");

    expect(client.view().mode).toBe("guarding");
    expect(client.commandLog).toEqual(["set_pin", "accept_stay", "submit_pin"]);
  });

  it("unsubscribes state listeners", async () => {
    const client = createMockStayClient();
    const seen: string[] = [];
    const unsubscribe = await client.subscribe((view) => {
      seen.push(view.mode);
    });

    client.focusMeeting();
    unsubscribe();
    await client.dismissCandidate();

    expect(seen).toEqual(["meeting_candidate"]);
  });

  it("rejects invalid PIN setup with a UI-safe error", async () => {
    const client = createMockStayClient();

    await expect(client.setPin("48a1")).rejects.toThrow("PIN must be exactly four digits");
  });
});
