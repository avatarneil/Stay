import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import styles from "./styles.css?raw";
import { StatusShell } from "./ui/StatusShell";

const tauriMocks = vi.hoisted(() => ({
  hide: vi.fn(() => Promise.resolve()),
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invoke,
  isTauri: () => true,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    hide: tauriMocks.hide,
  }),
}));

describe("performance budgets", () => {
  beforeEach(() => {
    tauriMocks.invoke.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates the native guard panel only for real state changes", () => {
    render(
      <StatusShell mode="guarding" status="On">
        <section>Guarded</section>
      </StatusShell>,
    );

    const shell = screen.getByRole("main");

    fireEvent.mouseEnter(shell);
    fireEvent.mouseEnter(shell);
    fireEvent.focus(shell);

    expect(shell).toHaveClass("stay-shell-revealed");
    expect(tauriMocks.invoke).toHaveBeenCalledTimes(1);
    expect(tauriMocks.invoke).toHaveBeenLastCalledWith("set_guarding_panel_expanded", {
      expanded: true,
    });

    fireEvent.mouseLeave(shell);
    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(shell).toHaveClass("stay-shell-collapsed");
    expect(tauriMocks.invoke).toHaveBeenCalledTimes(2);
    expect(tauriMocks.invoke).toHaveBeenLastCalledWith("set_guarding_panel_expanded", {
      expanded: false,
    });
  });

  it("does not animate filter effects on shell or locked overlay keyframes", () => {
    const animatedFilters = keyframeBlocks(styles)
      .filter((block) => !block.name.startsWith("launch-"))
      .flatMap((block) => block.body.match(/\bfilter\s*:/g)?.map(() => block.name) ?? []);

    expect(animatedFilters).toEqual([]);
  });

  it("keeps shell transitions off layout and paint-heavy properties", () => {
    const transition = declarationValue(declarationBlock(".stay-shell"), "transition");

    expect(transition).not.toMatch(/\b(background|box-shadow|padding|border-radius|filter|backdrop-filter)\b/);
  });

  it("allows the locked overlay content to scroll on constrained screens", () => {
    const lockedPanel = declarationBlock(".stay-shell-locked .mode-panel-active");

    expect(declarationValue(lockedPanel, "overflow")).toBe("auto");
  });
});

function declarationBlock(selector: string): string {
  const selectorStart = styles.indexOf(`${selector} {`);

  if (selectorStart === -1) {
    throw new Error(`Could not find CSS block for ${selector}`);
  }

  const blockStart = styles.indexOf("{", selectorStart);
  const blockEnd = findMatchingBrace(styles, blockStart);

  return styles.slice(blockStart + 1, blockEnd);
}

function declarationValue(block: string, property: string): string {
  const match = block.match(new RegExp(`${escapeRegex(property)}\\s*:\\s*([^;]+);`));

  if (!match) {
    throw new Error(`Could not find ${property} declaration`);
  }

  return match[1].trim();
}

function keyframeBlocks(css: string): Array<{ name: string; body: string }> {
  const blocks: Array<{ name: string; body: string }> = [];
  const keyframePattern = /@keyframes\s+([a-z-]+)/g;
  let match: RegExpExecArray | null;

  while ((match = keyframePattern.exec(css)) !== null) {
    const blockStart = css.indexOf("{", match.index);
    const blockEnd = findMatchingBrace(css, blockStart);

    blocks.push({
      name: match[1],
      body: css.slice(blockStart + 1, blockEnd),
    });
    keyframePattern.lastIndex = blockEnd + 1;
  }

  return blocks;
}

function findMatchingBrace(input: string, openingBraceIndex: number): number {
  let depth = 0;

  for (let index = openingBraceIndex; index < input.length; index += 1) {
    if (input[index] === "{") {
      depth += 1;
    }

    if (input[index] === "}") {
      depth -= 1;
    }

    if (depth === 0) {
      return index;
    }
  }

  throw new Error("Could not find matching CSS brace");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
