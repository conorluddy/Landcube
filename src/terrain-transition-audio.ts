import { terrainTransitionDurationMs } from './constants/terrain-transition';
import { isSoundMuted, subscribeToSoundMuted } from './sound-preference';

/** Spike: tectonic rumbles for landscape morphs and relief changes, faded out as the terrain settles. */
export interface TerrainTransitionAudio {
  /** A one-off rumble for a landscape morph; crossfades over any rumble already playing. */
  play(): void;
  /** Keeps a rumble going while something (a dragged slider) keeps changing; it fades once calls stop. */
  sustain(): void;
}

// tectonic_01–04 crossfaded into one mono 64 kbps file: one request, a third of the bytes.
const rumbleUrl = `${import.meta.env.BASE_URL}audio/tectonic.mp3`;
const peakGain = 0.6;
const fadeInSeconds = 0.15;
const fadeOutSeconds = 1.1;
// A random window half again as long as the morph, so the rumble trails off after it settles.
const sliceSeconds = (terrainTransitionDurationMs / 1000) * 1.5;
// How long a sustained rumble holds at full strength after the last change before fading.
const sustainHoldSeconds = 0.25;

interface Rumble {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

// === PUBLIC API ===

export function createTerrainTransitionAudio(): TerrainTransitionAudio {
  let context: AudioContext | undefined;
  let buffer: Promise<AudioBuffer> | undefined;
  let current: Rumble | undefined;
  // Bumped whenever the current rumble is let go, so a start still loading for it is dropped.
  let generation = 0;
  let isStarting = false;

  const fadeOut = () => {
    generation += 1;
    isStarting = false;

    if (!context || !current) {
      return;
    }

    scheduleEnd(current, context.currentTime, context.currentTime + fadeOutSeconds);
    current = undefined;
  };

  // Muting mid-rumble fades it rather than letting it run out.
  subscribeToSoundMuted((isMuted) => {
    if (isMuted) {
      fadeOut();
    }
  });

  /** Starts a fresh rumble that ends `durationSeconds` after it begins. */
  const start = (durationSeconds: number) => {
    context ??= new AudioContext();
    buffer ??= loadRumble(context);
    void context.resume();

    const audioContext = context;
    const startGeneration = generation;

    isStarting = true;
    void buffer.then(
      (loaded) => {
        if (startGeneration !== generation) {
          return;
        }

        isStarting = false;
        const rumble = startRumble(audioContext, loaded);

        current = rumble;
        // A finished rumble can't be revived, so a later sustain must start a fresh one.
        rumble.source.addEventListener('ended', () => {
          if (current === rumble) {
            current = undefined;
          }
        });
        scheduleEnd(current, audioContext.currentTime, audioContext.currentTime + durationSeconds);
      },
      (error: unknown) => {
        isStarting = false;
        // Forget the failed load so the next morph retries instead of staying silent.
        buffer = undefined;
        console.warn('Terrain transition audio failed to load; morphs stay silent.', error);
      },
    );
  };

  return {
    play() {
      // No sound (or 468 KB download) before the visitor has interacted with the page.
      if (isSoundMuted() || !hasUserInteracted()) {
        return;
      }

      fadeOut();
      start(sliceSeconds);
    },
    sustain() {
      if (isSoundMuted() || isStarting || !hasUserInteracted()) {
        return;
      }

      const durationSeconds = sustainHoldSeconds + fadeOutSeconds;

      if (context && current) {
        scheduleEnd(current, context.currentTime, context.currentTime + durationSeconds);
      } else {
        start(fadeInSeconds + durationSeconds);
      }
    },
  };
}

// === HELPERS ===

async function loadRumble(context: AudioContext): Promise<AudioBuffer> {
  const response = await fetch(rumbleUrl);

  if (!response.ok) {
    throw new Error(`Rumble audio ${rumbleUrl} returned HTTP ${response.status}.`);
  }

  return context.decodeAudioData(await response.arrayBuffer());
}

/** Plays from a random point, looping so a long sustain never runs off the end of the file. */
function startRumble(context: AudioContext, buffer: AudioBuffer): Rumble {
  const source = context.createBufferSource();
  const gain = context.createGain();
  const now = context.currentTime;

  source.buffer = buffer;
  source.loop = true;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peakGain, now + fadeInSeconds);
  source.connect(gain).connect(context.destination);
  source.start(now, Math.random() * buffer.duration);

  return { source, gain };
}

/** Holds (or rises back to) full strength, then fades to silence and stops at `endSeconds`. */
function scheduleEnd({ source, gain }: Rumble, nowSeconds: number, endSeconds: number) {
  const fadeStartSeconds = Math.max(nowSeconds, endSeconds - fadeOutSeconds);

  gain.gain.cancelScheduledValues(nowSeconds);
  gain.gain.setValueAtTime(gain.gain.value, nowSeconds);

  if (fadeStartSeconds > nowSeconds) {
    gain.gain.linearRampToValueAtTime(
      peakGain,
      Math.min(fadeStartSeconds, nowSeconds + fadeInSeconds),
    );
    gain.gain.setValueAtTime(peakGain, fadeStartSeconds);
  }

  gain.gain.linearRampToValueAtTime(0, endSeconds);
  source.stop(endSeconds);
}

/** Browsers without the User Activation API are assumed interactive; they gate audio themselves. */
function hasUserInteracted(): boolean {
  return (navigator as { userActivation?: UserActivation }).userActivation?.hasBeenActive ?? true;
}
