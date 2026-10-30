import { terrainTransitionDurationMs } from './constants/terrain-transition';

/** Spike: a tectonic rumble under each landscape morph, faded out as the terrain settles. */
export interface TerrainTransitionAudio {
  play(): void;
}

// tectonic_01–04 crossfaded into one mono 64 kbps file: one request, a third of the bytes.
const rumbleUrl = `${import.meta.env.BASE_URL}audio/tectonic.mp3`;
const peakGain = 0.6;
const fadeInSeconds = 0.15;
const fadeOutSeconds = 1.1;
// A random window half again as long as the morph, so the rumble trails off after it settles.
const sliceSeconds = (terrainTransitionDurationMs / 1000) * 1.5;

// === PUBLIC API ===

export function createTerrainTransitionAudio(): TerrainTransitionAudio {
  let context: AudioContext | undefined;
  let rumble: Promise<AudioBuffer> | undefined;
  let current: { source: AudioBufferSourceNode; gain: GainNode } | undefined;
  // Bumped by every play, so only the newest morph's rumble starts once loading finishes.
  let playGeneration = 0;

  const fadeOut = () => {
    playGeneration += 1;

    if (!context || !current) {
      return;
    }

    const { source, gain } = current;
    const now = context.currentTime;

    current = undefined;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fadeOutSeconds);
    source.stop(now + fadeOutSeconds);
  };

  const play = () => {
    context ??= new AudioContext();
    rumble ??= loadRumble(context);
    void context.resume();
    // A morph that supersedes another crossfades rather than stacking rumbles.
    fadeOut();

    const audioContext = context;
    const generation = playGeneration;

    void rumble.then(
      (buffer) => {
        if (generation !== playGeneration) {
          return;
        }

        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        const now = audioContext.currentTime;
        const offsetSeconds = Math.random() * Math.max(0, buffer.duration - sliceSeconds);
        const endSeconds = now + sliceSeconds;

        source.buffer = buffer;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(peakGain, now + fadeInSeconds);
        gain.gain.setValueAtTime(peakGain, endSeconds - fadeOutSeconds);
        gain.gain.linearRampToValueAtTime(0, endSeconds);
        source.connect(gain).connect(audioContext.destination);
        source.start(now, offsetSeconds, sliceSeconds);
        current = { source, gain };
      },
      (error: unknown) => {
        console.warn('Terrain transition audio failed to load; morphs stay silent.', error);
      },
    );
  };

  return { play };
}

// === HELPERS ===

async function loadRumble(context: AudioContext): Promise<AudioBuffer> {
  const response = await fetch(rumbleUrl);

  if (!response.ok) {
    throw new Error(`Rumble audio ${rumbleUrl} returned HTTP ${response.status}.`);
  }

  return context.decodeAudioData(await response.arrayBuffer());
}
