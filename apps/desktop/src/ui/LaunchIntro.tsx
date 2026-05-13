import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";

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

type LaunchStyle = CSSProperties & Record<`--${string}`, string>;
type SignalTemplate = Omit<SignalMark, "id">;

const signalMarkTemplates: SignalTemplate[] = [
  { kind: "bar", tone: "warm", width: 130, height: 10, x: "-49vw", y: "-42vh", driftX: "5vw", driftY: "3vh", delayMs: 0, durationMs: 2920 },
  { kind: "dot", tone: "neutral", width: 18, height: 18, x: "-35vw", y: "-42vh", driftX: "-2vw", driftY: "5vh", delayMs: 80, durationMs: 2840 },
  { kind: "bar", tone: "neutral", width: 88, height: 9, x: "-19vw", y: "-40vh", driftX: "4vw", driftY: "4vh", delayMs: 160, durationMs: 3020 },
  { kind: "dot", tone: "warm", width: 16, height: 16, x: "-3vw", y: "-43vh", driftX: "2vw", driftY: "6vh", delayMs: 240, durationMs: 2780 },
  { kind: "bar", tone: "neutral", width: 112, height: 9, x: "14vw", y: "-41vh", driftX: "-5vw", driftY: "5vh", delayMs: 120, durationMs: 3120 },
  { kind: "dot", tone: "neutral", width: 20, height: 20, x: "31vw", y: "-43vh", driftX: "-3vw", driftY: "6vh", delayMs: 280, durationMs: 2860 },
  { kind: "bar", tone: "warm", width: 118, height: 10, x: "48vw", y: "-39vh", driftX: "-6vw", driftY: "4vh", delayMs: 40, durationMs: 3000 },
  { kind: "dot", tone: "warm", width: 16, height: 16, x: "-46vw", y: "-29vh", driftX: "4vw", driftY: "2vh", delayMs: 300, durationMs: 2820 },
  { kind: "bar", tone: "neutral", width: 104, height: 9, x: "-31vw", y: "-28vh", driftX: "3vw", driftY: "3vh", delayMs: 100, durationMs: 3180 },
  { kind: "bar", tone: "warm", width: 92, height: 10, x: "-13vw", y: "-27vh", driftX: "-2vw", driftY: "5vh", delayMs: 340, durationMs: 2920 },
  { kind: "dot", tone: "neutral", width: 18, height: 18, x: "5vw", y: "-29vh", driftX: "1vw", driftY: "4vh", delayMs: 180, durationMs: 2740 },
  { kind: "bar", tone: "neutral", width: 118, height: 9, x: "22vw", y: "-28vh", driftX: "-4vw", driftY: "3vh", delayMs: 420, durationMs: 3100 },
  { kind: "bar", tone: "warm", width: 146, height: 10, x: "43vw", y: "-27vh", driftX: "-7vw", driftY: "2vh", delayMs: 220, durationMs: 3040 },
  { kind: "bar", tone: "neutral", width: 116, height: 9, x: "-50vw", y: "-15vh", driftX: "7vw", driftY: "-1vh", delayMs: 460, durationMs: 3040 },
  { kind: "dot", tone: "warm", width: 17, height: 17, x: "-37vw", y: "-16vh", driftX: "3vw", driftY: "2vh", delayMs: 260, durationMs: 2720 },
  { kind: "bar", tone: "warm", width: 128, height: 10, x: "-20vw", y: "-14vh", driftX: "4vw", driftY: "1vh", delayMs: 520, durationMs: 3140 },
  { kind: "dot", tone: "neutral", width: 16, height: 16, x: "-2vw", y: "-16vh", driftX: "-1vw", driftY: "3vh", delayMs: 360, durationMs: 2840 },
  { kind: "bar", tone: "neutral", width: 92, height: 9, x: "16vw", y: "-15vh", driftX: "-3vw", driftY: "2vh", delayMs: 560, durationMs: 2960 },
  { kind: "dot", tone: "warm", width: 18, height: 18, x: "34vw", y: "-16vh", driftX: "-4vw", driftY: "4vh", delayMs: 380, durationMs: 2780 },
  { kind: "bar", tone: "neutral", width: 102, height: 9, x: "49vw", y: "-13vh", driftX: "-6vw", driftY: "2vh", delayMs: 620, durationMs: 3060 },
  { kind: "dot", tone: "neutral", width: 16, height: 16, x: "-48vw", y: "-2vh", driftX: "6vw", driftY: "1vh", delayMs: 420, durationMs: 2820 },
  { kind: "bar", tone: "warm", width: 108, height: 10, x: "-32vw", y: "-1vh", driftX: "4vw", driftY: "-2vh", delayMs: 680, durationMs: 3100 },
  { kind: "dot", tone: "warm", width: 18, height: 18, x: "-14vw", y: "0vh", driftX: "2vw", driftY: "1vh", delayMs: 480, durationMs: 2860 },
  { kind: "bar", tone: "neutral", width: 126, height: 9, x: "4vw", y: "-1vh", driftX: "-2vw", driftY: "1vh", delayMs: 740, durationMs: 3160 },
  { kind: "dot", tone: "neutral", width: 15, height: 15, x: "21vw", y: "0vh", driftX: "-3vw", driftY: "-1vh", delayMs: 540, durationMs: 2920 },
  { kind: "bar", tone: "warm", width: 116, height: 10, x: "37vw", y: "-1vh", driftX: "-5vw", driftY: "2vh", delayMs: 800, durationMs: 2980 },
  { kind: "dot", tone: "warm", width: 16, height: 16, x: "49vw", y: "1vh", driftX: "-6vw", driftY: "1vh", delayMs: 600, durationMs: 2760 },
  { kind: "bar", tone: "neutral", width: 134, height: 9, x: "-49vw", y: "13vh", driftX: "7vw", driftY: "-3vh", delayMs: 700, durationMs: 3100 },
  { kind: "dot", tone: "neutral", width: 18, height: 18, x: "-35vw", y: "12vh", driftX: "4vw", driftY: "-2vh", delayMs: 900, durationMs: 2760 },
  { kind: "bar", tone: "warm", width: 112, height: 10, x: "-18vw", y: "14vh", driftX: "3vw", driftY: "-4vh", delayMs: 760, durationMs: 3040 },
  { kind: "dot", tone: "warm", width: 16, height: 16, x: "0vw", y: "13vh", driftX: "1vw", driftY: "-3vh", delayMs: 960, durationMs: 2840 },
  { kind: "bar", tone: "neutral", width: 94, height: 9, x: "17vw", y: "14vh", driftX: "-2vw", driftY: "-4vh", delayMs: 820, durationMs: 3180 },
  { kind: "dot", tone: "neutral", width: 18, height: 18, x: "34vw", y: "12vh", driftX: "-4vw", driftY: "-2vh", delayMs: 1020, durationMs: 2900 },
  { kind: "bar", tone: "warm", width: 136, height: 10, x: "48vw", y: "14vh", driftX: "-7vw", driftY: "-3vh", delayMs: 880, durationMs: 3080 },
  { kind: "dot", tone: "warm", width: 17, height: 17, x: "-46vw", y: "29vh", driftX: "5vw", driftY: "-4vh", delayMs: 980, durationMs: 2800 },
  { kind: "bar", tone: "neutral", width: 120, height: 9, x: "-31vw", y: "29vh", driftX: "4vw", driftY: "-5vh", delayMs: 1120, durationMs: 3060 },
  { kind: "dot", tone: "neutral", width: 16, height: 16, x: "-13vw", y: "30vh", driftX: "2vw", driftY: "-4vh", delayMs: 1040, durationMs: 2780 },
  { kind: "bar", tone: "warm", width: 132, height: 10, x: "6vw", y: "29vh", driftX: "-2vw", driftY: "-5vh", delayMs: 1180, durationMs: 3160 },
  { kind: "dot", tone: "warm", width: 18, height: 18, x: "24vw", y: "30vh", driftX: "-3vw", driftY: "-4vh", delayMs: 1080, durationMs: 2840 },
  { kind: "bar", tone: "neutral", width: 102, height: 9, x: "40vw", y: "28vh", driftX: "-5vw", driftY: "-4vh", delayMs: 1240, durationMs: 3040 },
  { kind: "dot", tone: "neutral", width: 16, height: 16, x: "50vw", y: "31vh", driftX: "-6vw", driftY: "-5vh", delayMs: 1160, durationMs: 2720 },
  { kind: "bar", tone: "warm", width: 146, height: 10, x: "-48vw", y: "43vh", driftX: "6vw", driftY: "-6vh", delayMs: 1260, durationMs: 3000 },
  { kind: "dot", tone: "neutral", width: 18, height: 18, x: "-29vw", y: "42vh", driftX: "4vw", driftY: "-6vh", delayMs: 1320, durationMs: 2760 },
  { kind: "bar", tone: "neutral", width: 118, height: 9, x: "-8vw", y: "42vh", driftX: "2vw", driftY: "-6vh", delayMs: 1200, durationMs: 3120 },
  { kind: "dot", tone: "warm", width: 16, height: 16, x: "13vw", y: "43vh", driftX: "-2vw", driftY: "-6vh", delayMs: 1360, durationMs: 2820 },
  { kind: "bar", tone: "warm", width: 126, height: 10, x: "31vw", y: "42vh", driftX: "-4vw", driftY: "-6vh", delayMs: 1280, durationMs: 3080 },
  { kind: "dot", tone: "neutral", width: 18, height: 18, x: "48vw", y: "42vh", driftX: "-6vw", driftY: "-6vh", delayMs: 1420, durationMs: 2740 },
];

const signalMarks: SignalMark[] = signalMarkTemplates.map((mark, index) => ({
  id: `signal-${index + 1}`,
  ...mark,
}));

const chatterMarks: ChatterMark[] = [
  {
    id: "left-warm",
    kind: "bar",
    tone: "warm",
    width: 114,
    height: 14,
    startX: "-43vw",
    startY: "-26vh",
    midX: "-23vw",
    midY: "-14vh",
    finalX: "-9.2rem",
    finalY: "-5.1rem",
    delayMs: 0,
    durationMs: 5600,
  },
  {
    id: "right-warm",
    kind: "bar",
    tone: "warm",
    width: 174,
    height: 15,
    startX: "41vw",
    startY: "-30vh",
    midX: "23vw",
    midY: "-18vh",
    finalX: "7.1rem",
    finalY: "-5.9rem",
    delayMs: 120,
    durationMs: 5480,
  },
  {
    id: "lower-warm",
    kind: "bar",
    tone: "warm",
    width: 128,
    height: 14,
    startX: "-35vw",
    startY: "32vh",
    midX: "-19vw",
    midY: "18vh",
    finalX: "-8.3rem",
    finalY: "6.8rem",
    delayMs: 180,
    durationMs: 5380,
  },
  {
    id: "bottom-warm",
    kind: "bar",
    tone: "warm",
    width: 146,
    height: 14,
    startX: "34vw",
    startY: "34vh",
    midX: "18vw",
    midY: "19vh",
    finalX: "5.2rem",
    finalY: "4.6rem",
    delayMs: 80,
    durationMs: 5520,
  },
  {
    id: "top-neutral",
    kind: "bar",
    tone: "neutral",
    width: 94,
    height: 14,
    startX: "-18vw",
    startY: "-38vh",
    midX: "-12vw",
    midY: "-24vh",
    finalX: "-5.2rem",
    finalY: "-10.4rem",
    delayMs: 40,
    durationMs: 5560,
  },
  {
    id: "top-right-neutral",
    kind: "bar",
    tone: "neutral",
    width: 82,
    height: 14,
    startX: "26vw",
    startY: "-41vh",
    midX: "18vw",
    midY: "-23vh",
    finalX: "5.6rem",
    finalY: "-10.4rem",
    delayMs: 220,
    durationMs: 5360,
  },
  {
    id: "right-neutral-small",
    kind: "bar",
    tone: "neutral",
    width: 74,
    height: 12,
    startX: "49vw",
    startY: "-2vh",
    midX: "28vw",
    midY: "-4vh",
    finalX: "10.7rem",
    finalY: "-1.1rem",
    delayMs: 260,
    durationMs: 5220,
  },
  {
    id: "left-neutral-small",
    kind: "bar",
    tone: "neutral",
    width: 78,
    height: 12,
    startX: "-49vw",
    startY: "7vh",
    midX: "-27vw",
    midY: "3vh",
    finalX: "-10.8rem",
    finalY: "-0.2rem",
    delayMs: 320,
    durationMs: 5160,
  },
  {
    id: "left-low-neutral",
    kind: "bar",
    tone: "neutral",
    width: 110,
    height: 13,
    startX: "-44vw",
    startY: "22vh",
    midX: "-26vw",
    midY: "11vh",
    finalX: "-8.6rem",
    finalY: "3.8rem",
    delayMs: 380,
    durationMs: 5140,
  },
  {
    id: "right-low-neutral",
    kind: "bar",
    tone: "neutral",
    width: 82,
    height: 13,
    startX: "46vw",
    startY: "25vh",
    midX: "26vw",
    midY: "13vh",
    finalX: "10.2rem",
    finalY: "3.2rem",
    delayMs: 440,
    durationMs: 5060,
  },
  {
    id: "bottom-neutral",
    kind: "bar",
    tone: "neutral",
    width: 164,
    height: 13,
    startX: "2vw",
    startY: "44vh",
    midX: "0vw",
    midY: "25vh",
    finalX: "1.2rem",
    finalY: "9.1rem",
    delayMs: 160,
    durationMs: 5400,
  },
  {
    id: "top-left-dot",
    kind: "dot",
    tone: "neutral",
    width: 24,
    height: 24,
    startX: "-30vw",
    startY: "-42vh",
    midX: "-21vw",
    midY: "-25vh",
    finalX: "-10.4rem",
    finalY: "-10.2rem",
    delayMs: 140,
    durationMs: 5460,
  },
  {
    id: "top-dot",
    kind: "dot",
    tone: "neutral",
    width: 28,
    height: 28,
    startX: "11vw",
    startY: "-45vh",
    midX: "8vw",
    midY: "-27vh",
    finalX: "1.9rem",
    finalY: "-10.4rem",
    delayMs: 220,
    durationMs: 5280,
  },
  {
    id: "middle-dot",
    kind: "dot",
    tone: "warm",
    width: 22,
    height: 22,
    startX: "-8vw",
    startY: "-18vh",
    midX: "-7vw",
    midY: "-11vh",
    finalX: "-3.9rem",
    finalY: "-5.1rem",
    delayMs: 60,
    durationMs: 5580,
  },
  {
    id: "lower-dot",
    kind: "dot",
    tone: "neutral",
    width: 22,
    height: 22,
    startX: "-14vw",
    startY: "27vh",
    midX: "-9vw",
    midY: "17vh",
    finalX: "-4.6rem",
    finalY: "6.6rem",
    delayMs: 300,
    durationMs: 5160,
  },
  {
    id: "right-dot",
    kind: "dot",
    tone: "warm",
    width: 22,
    height: 22,
    startX: "43vw",
    startY: "17vh",
    midX: "27vw",
    midY: "12vh",
    finalX: "10.3rem",
    finalY: "6.6rem",
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
        <div className="launch-intro__chatter">
          {chatterMarks.map((mark) => (
            <span
              key={mark.id}
              className={[
                "launch-intro__beep",
                "launch-intro__mark",
                `launch-intro__mark-${mark.kind}`,
                `launch-intro__mark-${mark.tone}`,
              ].join(" ")}
              style={markStyle(mark)}
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
  master.gain.exponentialRampToValueAtTime(0.28, now + 0.28);
  master.gain.exponentialRampToValueAtTime(0.17, now + 3.8);
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

  noiseGain.gain.setValueAtTime(0.052, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.007, now + 4.8);

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
    gain.gain.exponentialRampToValueAtTime(0.068 - index * 0.0028, start + 0.03);
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
    gain.gain.exponentialRampToValueAtTime(index === 1 ? 0.076 : 0.048, start + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 7.1);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(now + 7.3);
    cleanupNodes.push(oscillator);
  });
}
