import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";

const defaultDurationMs = 7600;
const reducedMotionDurationMs = 1200;

type LaunchIntroProps = {
  onComplete: () => void;
};

type SignalMark = {
  id: string;
  kind: "bar" | "dot";
  tone: "neutral" | "warm" | "accent";
  width: number;
  height: number;
  x: string;
  y: string;
  driftX: string;
  driftY: string;
  delayMs: number;
  durationMs: number;
};

type IconMark = {
  id: string;
  kind: "bar" | "dot";
  tone: "neutral" | "warm";
  placement: string;
};

type LaunchStyle = CSSProperties & Record<`--${string}`, string>;
type SignalTemplate = Omit<SignalMark, "id">;

const signalRows = [5, 12.5, 20, 27.5, 35, 42.5, 50, 57.5, 65, 72.5, 80, 87.5, 95];
const signalColumns = [-18, -6, 6, 18, 30, 42, 54, 66, 78, 90, 102, 114];

const signalMarkTemplates: SignalTemplate[] = signalRows.flatMap((rowY, rowIndex) =>
  signalColumns.map((columnX, columnIndex) => {
    const seed = rowIndex * signalColumns.length + columnIndex;
    const isDot = seed % 4 === 0;
    const tone: SignalMark["tone"] = seed % 11 === 0 ? "accent" : seed % 3 === 0 ? "warm" : "neutral";
    const durationMs = 3600 + (seed % 8) * 210;
    const rowOffset = ((columnIndex % 3) - 1) * 1.8;
    const columnOffset = ((rowIndex % 4) - 1.5) * 1.6;

    return {
      kind: isDot ? "dot" : "bar",
      tone,
      width: isDot ? 6 + (seed % 5) * 2 : 34 + (seed % 8) * 10,
      height: isDot ? 6 + (seed % 5) * 2 : 5 + (seed % 3),
      x: `${columnX + columnOffset}vw`,
      y: `${rowY + rowOffset}vh`,
      driftX: `${38 + (seed % 6) * 5}vw`,
      driftY: `${((seed % 7) - 3) * 0.55}vh`,
      delayMs: -Math.round(((columnIndex + 1) / signalColumns.length) * durationMs) + rowIndex * 34,
      durationMs,
    };
  }),
);

const signalMarks: SignalMark[] = signalMarkTemplates.map((mark, index) => ({
  id: `signal-${index + 1}`,
  ...mark,
}));

const iconMarks: IconMark[] = [
  { id: "top-left-dot", kind: "dot", tone: "neutral", placement: "top-left-dot" },
  { id: "top-left-bar", kind: "bar", tone: "neutral", placement: "top-left-bar" },
  { id: "top-center-dot", kind: "dot", tone: "neutral", placement: "top-center-dot" },
  { id: "top-right-bar", kind: "bar", tone: "neutral", placement: "top-right-bar" },
  { id: "upper-warm-left", kind: "bar", tone: "warm", placement: "upper-warm-left" },
  { id: "upper-warm-dot", kind: "dot", tone: "warm", placement: "upper-warm-dot" },
  { id: "upper-warm-right", kind: "bar", tone: "warm", placement: "upper-warm-right" },
  { id: "mid-left-bar", kind: "bar", tone: "neutral", placement: "mid-left-bar" },
  { id: "mid-right-bar", kind: "bar", tone: "neutral", placement: "mid-right-bar" },
  { id: "lower-left-bar", kind: "bar", tone: "neutral", placement: "lower-left-bar" },
  { id: "lower-left-dot", kind: "dot", tone: "neutral", placement: "lower-left-dot" },
  { id: "lower-right-warm", kind: "bar", tone: "warm", placement: "lower-right-warm" },
  { id: "lower-right-dot", kind: "dot", tone: "warm", placement: "lower-right-dot" },
  { id: "bottom-left-warm", kind: "bar", tone: "warm", placement: "bottom-left-warm" },
  { id: "bottom-neutral", kind: "bar", tone: "neutral", placement: "bottom-neutral" },
];

export function LaunchIntro({ onComplete }: LaunchIntroProps) {
  const durationMs = useMemo(prefersReducedMotion, []) ? reducedMotionDurationMs : defaultDurationMs;

  useEffect(() => {
    const timer = window.setTimeout(onComplete, durationMs);
    const stopAudio = durationMs === defaultDurationMs ? playLaunchSound() : undefined;

    return () => {
      window.clearTimeout(timer);
      stopAudio?.();
    };
  }, [durationMs, onComplete]);

  return (
    <section className="launch-intro" aria-label="Stay opening animation" style={durationStyle(durationMs)}>
      <div className="launch-intro__grain" aria-hidden="true" />
      <div className="launch-intro__room" aria-hidden="true" />
      <div className="launch-intro__signals" aria-hidden="true">
        {signalMarks.map((mark) => (
          <span
            key={mark.id}
            className={[
              "launch-intro__signal",
              `launch-intro__signal-${mark.kind}`,
              `launch-intro__signal-${mark.tone}`,
            ].join(" ")}
            style={signalStyle(mark)}
          />
        ))}
      </div>
      <div className="launch-intro__icon-stage" aria-hidden="true">
        <div className="launch-intro__tile" />
        <div className="launch-intro__icon-pattern">
          {iconMarks.map((mark) => (
            <span
              key={mark.id}
              className={[
                "launch-intro__icon-mark",
                `launch-intro__icon-mark-${mark.kind}`,
                `launch-intro__icon-mark-${mark.tone}`,
                `launch-intro__icon-mark--${mark.placement}`,
              ].join(" ")}
            />
          ))}
        </div>
        <div className="launch-intro__connector">
          <span className="launch-intro__connector-line" />
          <span className="launch-intro__connector-dot launch-intro__connector-dot-left" />
          <span className="launch-intro__connector-dot launch-intro__connector-dot-right" />
        </div>
      </div>
      <div className="launch-intro__copy" aria-hidden="true">
        <p>Stay</p>
        <span>Their hour deserves your hour.</span>
      </div>
      <button type="button" className="launch-intro__skip ghost" onClick={onComplete}>
        Skip
      </button>
    </section>
  );
}

function durationStyle(durationMs: number): LaunchStyle {
  return {
    "--launch-duration": `${durationMs}ms`,
  };
}

function signalStyle(mark: SignalMark): LaunchStyle {
  return {
    "--signal-width": `${mark.width}px`,
    "--signal-height": `${mark.height}px`,
    "--signal-x": mark.x,
    "--signal-y": mark.y,
    "--signal-drift-x": mark.driftX,
    "--signal-drift-y": mark.driftY,
    "--signal-delay": `${mark.delayMs}ms`,
    "--signal-duration": `${mark.durationMs}ms`,
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playLaunchSound(): (() => void) | undefined {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return undefined;
  }

  const audio = new AudioContextConstructor();
  const now = audio.currentTime;
  const master = audio.createGain();
  const lowpass = audio.createBiquadFilter();
  const cleanupNodes: AudioScheduledSourceNode[] = [];

  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.95, now + 0.28);
  master.gain.exponentialRampToValueAtTime(0.58, now + 3.8);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 7.2);

  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(4200, now);
  lowpass.frequency.exponentialRampToValueAtTime(760, now + 3.4);
  lowpass.frequency.exponentialRampToValueAtTime(340, now + 5.4);
  lowpass.Q.setValueAtTime(0.8, now);

  lowpass.connect(master);
  master.connect(audio.destination);

  scheduleRoomTone(audio, lowpass, cleanupNodes, now);
  scheduleChatterPulses(audio, lowpass, cleanupNodes, now);
  scheduleQuietChord(audio, lowpass, cleanupNodes, now);

  void audio.resume().catch(() => undefined);

  return () => {
    cleanupNodes.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Already stopped.
      }
    });
    void audio.close().catch(() => undefined);
  };
}

function scheduleRoomTone(
  audio: AudioContext,
  destination: AudioNode,
  cleanupNodes: AudioScheduledSourceNode[],
  now: number,
): void {
  const noise = audio.createBufferSource();
  const noiseGain = audio.createGain();
  const bandpass = audio.createBiquadFilter();
  const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.sin(index * 12.9898) * 0.18 + (Math.sin(index * 78.233) % 1) * 0.06;
  }

  noise.buffer = buffer;
  noise.loop = true;

  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(1180, now);
  bandpass.frequency.exponentialRampToValueAtTime(260, now + 3.8);
  bandpass.Q.setValueAtTime(0.9, now);

  noiseGain.gain.setValueAtTime(0.064, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.009, now + 4.8);

  noise.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(destination);

  noise.start(now);
  noise.stop(now + 5.2);
  cleanupNodes.push(noise);
}

function scheduleChatterPulses(
  audio: AudioContext,
  destination: AudioNode,
  cleanupNodes: AudioScheduledSourceNode[],
  now: number,
): void {
  const frequencies = [523.25, 659.25, 392, 783.99, 587.33, 440, 698.46, 329.63, 493.88, 739.99];

  frequencies.forEach((frequency, index) => {
    const start = now + 0.18 + index * 0.22;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = index % 3 === 0 ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.72, start + 0.16);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.088 - index * 0.0035, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + 0.28);
    cleanupNodes.push(oscillator);
  });
}

function scheduleQuietChord(
  audio: AudioContext,
  destination: AudioNode,
  cleanupNodes: AudioScheduledSourceNode[],
  now: number,
): void {
  const notes = [146.83, 220, 293.66];

  notes.forEach((frequency, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = now + 2.6 + index * 0.08;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.detune.setValueAtTime(index === 1 ? 4 : -3, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(index === 1 ? 0.096 : 0.06, start + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 7.1);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(now + 7.3);
    cleanupNodes.push(oscillator);
  });
}
