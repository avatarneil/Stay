import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import stayIconUrl from "../../src-tauri/icons/icon.png";

const defaultDurationMs = 7600;
const reducedMotionDurationMs = 1200;

type LaunchIntroProps = {
  onComplete: () => void;
};

type ChatterMark = {
  id: string;
  kind: "bar" | "dot";
  tone: "neutral" | "warm" | "accent";
  width: number;
  height: number;
  startX: string;
  startY: string;
  midX: string;
  midY: string;
  finalX: string;
  finalY: string;
  delayMs: number;
  durationMs: number;
};

type LaunchStyle = CSSProperties & Record<`--${string}`, string>;

const chatterMarks: ChatterMark[] = [
  {
    id: "left-warm",
    kind: "bar",
    tone: "warm",
    width: 170,
    height: 24,
    startX: "-43vw",
    startY: "-26vh",
    midX: "-25vw",
    midY: "-16vh",
    finalX: "-19.4rem",
    finalY: "-7.9rem",
    delayMs: 0,
    durationMs: 5600,
  },
  {
    id: "right-warm",
    kind: "bar",
    tone: "warm",
    width: 260,
    height: 24,
    startX: "41vw",
    startY: "-30vh",
    midX: "24vw",
    midY: "-18vh",
    finalX: "11.2rem",
    finalY: "-9.6rem",
    delayMs: 120,
    durationMs: 5480,
  },
  {
    id: "lower-warm",
    kind: "bar",
    tone: "warm",
    width: 188,
    height: 22,
    startX: "-35vw",
    startY: "32vh",
    midX: "-20vw",
    midY: "18vh",
    finalX: "-17rem",
    finalY: "11.8rem",
    delayMs: 180,
    durationMs: 5380,
  },
  {
    id: "bottom-warm",
    kind: "bar",
    tone: "warm",
    width: 220,
    height: 22,
    startX: "34vw",
    startY: "34vh",
    midX: "18vw",
    midY: "19vh",
    finalX: "8.4rem",
    finalY: "8.9rem",
    delayMs: 80,
    durationMs: 5520,
  },
  {
    id: "top-neutral",
    kind: "bar",
    tone: "neutral",
    width: 150,
    height: 24,
    startX: "-18vw",
    startY: "-38vh",
    midX: "-13vw",
    midY: "-23vh",
    finalX: "-6rem",
    finalY: "-16.5rem",
    delayMs: 40,
    durationMs: 5560,
  },
  {
    id: "right-neutral-small",
    kind: "bar",
    tone: "neutral",
    width: 116,
    height: 20,
    startX: "49vw",
    startY: "-2vh",
    midX: "28vw",
    midY: "-4vh",
    finalX: "20.4rem",
    finalY: "-1.2rem",
    delayMs: 260,
    durationMs: 5220,
  },
  {
    id: "left-neutral-small",
    kind: "bar",
    tone: "neutral",
    width: 116,
    height: 20,
    startX: "-49vw",
    startY: "7vh",
    midX: "-27vw",
    midY: "3vh",
    finalX: "-19rem",
    finalY: "2.1rem",
    delayMs: 320,
    durationMs: 5160,
  },
  {
    id: "bottom-neutral",
    kind: "bar",
    tone: "neutral",
    width: 250,
    height: 22,
    startX: "2vw",
    startY: "44vh",
    midX: "0vw",
    midY: "25vh",
    finalX: "0.8rem",
    finalY: "16.1rem",
    delayMs: 160,
    durationMs: 5400,
  },
  {
    id: "top-left-dot",
    kind: "dot",
    tone: "neutral",
    width: 42,
    height: 42,
    startX: "-30vw",
    startY: "-42vh",
    midX: "-21vw",
    midY: "-25vh",
    finalX: "-18rem",
    finalY: "-16.2rem",
    delayMs: 140,
    durationMs: 5460,
  },
  {
    id: "top-dot",
    kind: "dot",
    tone: "neutral",
    width: 46,
    height: 46,
    startX: "11vw",
    startY: "-45vh",
    midX: "8vw",
    midY: "-27vh",
    finalX: "0.6rem",
    finalY: "-17rem",
    delayMs: 220,
    durationMs: 5280,
  },
  {
    id: "middle-dot",
    kind: "dot",
    tone: "warm",
    width: 36,
    height: 36,
    startX: "-8vw",
    startY: "-18vh",
    midX: "-7vw",
    midY: "-11vh",
    finalX: "-10.3rem",
    finalY: "-7.7rem",
    delayMs: 60,
    durationMs: 5580,
  },
  {
    id: "lower-dot",
    kind: "dot",
    tone: "neutral",
    width: 36,
    height: 36,
    startX: "-14vw",
    startY: "27vh",
    midX: "-9vw",
    midY: "17vh",
    finalX: "-12rem",
    finalY: "6.5rem",
    delayMs: 300,
    durationMs: 5160,
  },
  {
    id: "right-dot",
    kind: "dot",
    tone: "warm",
    width: 34,
    height: 34,
    startX: "43vw",
    startY: "17vh",
    midX: "27vw",
    midY: "12vh",
    finalX: "20rem",
    finalY: "5.1rem",
    delayMs: 100,
    durationMs: 5500,
  },
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
      <div className="launch-intro__chatter" aria-hidden="true">
        {chatterMarks.map((mark) => (
          <span
            key={mark.id}
            className={[
              "launch-intro__mark",
              `launch-intro__mark-${mark.kind}`,
              `launch-intro__mark-${mark.tone}`,
            ].join(" ")}
            style={markStyle(mark)}
          />
        ))}
      </div>
      <div className="launch-intro__connector" aria-hidden="true">
        <span className="launch-intro__connector-line" />
        <span className="launch-intro__connector-dot launch-intro__connector-dot-left" />
        <span className="launch-intro__connector-dot launch-intro__connector-dot-right" />
      </div>
      <img className="launch-intro__icon" src={stayIconUrl} alt="" aria-hidden="true" />
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

function markStyle(mark: ChatterMark): LaunchStyle {
  return {
    "--mark-width": `${mark.width}px`,
    "--mark-height": `${mark.height}px`,
    "--mark-start-x": mark.startX,
    "--mark-start-y": mark.startY,
    "--mark-mid-x": mark.midX,
    "--mark-mid-y": mark.midY,
    "--mark-final-x": mark.finalX,
    "--mark-final-y": mark.finalY,
    "--mark-delay": `${mark.delayMs}ms`,
    "--mark-duration": `${mark.durationMs}ms`,
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
  master.gain.exponentialRampToValueAtTime(0.18, now + 0.28);
  master.gain.exponentialRampToValueAtTime(0.11, now + 3.8);
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

  noiseGain.gain.setValueAtTime(0.035, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.004, now + 4.8);

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
    gain.gain.exponentialRampToValueAtTime(0.045 - index * 0.0025, start + 0.03);
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
    gain.gain.exponentialRampToValueAtTime(index === 1 ? 0.052 : 0.032, start + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 7.1);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(now + 7.3);
    cleanupNodes.push(oscillator);
  });
}
