import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 22_050;
const TAU = Math.PI * 2;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "public", "audio");

await main();

async function main() {
  await mkdir(outputDir, { recursive: true });

  const assets = [
    ["sfx-gunshot-player.wav", createGunshot({ seed: 11, boomFrequency: 86, crackGain: 1 })],
    ["sfx-gunshot-enemy.wav", createGunshot({ seed: 23, boomFrequency: 72, crackGain: 0.9 })],
    ["sfx-revolver-cock.wav", createRevolverCock()],
    ["sfx-holster-leather.wav", createLeatherRustle()],
    ["sfx-bullet-whiz.wav", createBulletWhiz()],
    ["sfx-dust-impact.wav", createDustImpact()],
    ["sfx-body-hit.wav", createBodyHit()],
    ["sfx-poster-paper.wav", createPosterPaper()],
    ["sfx-button-click.wav", createButtonClick()],
    ["music-bounty-board-loop.wav", createBountyBoardLoop()],
    ["music-town-wind-loop.wav", createTownWindLoop()],
    ["music-duel-tension-loop.wav", createDuelTensionLoop()],
    ["music-victory-sting.wav", createVictorySting()],
    ["music-defeat-sting.wav", createDefeatSting()]
  ];

  for (const [fileName, samples] of assets) {
    const outputPath = path.join(outputDir, fileName);
    await writeFile(outputPath, encodeWav(samples));
    console.log(`wrote ${path.relative(repoRoot, outputPath)}`);
  }
}

function createGunshot({ seed, boomFrequency, crackGain }) {
  const duration = 0.62;
  const rng = createRandom(seed);

  return normalize(
    makeSamples(duration, (t) => {
      const crackEnvelope = Math.exp(-t * 45);
      const boomEnvelope = Math.exp(-t * 6.8);
      const tailEnvelope = Math.exp(-t * 2.8);
      const crack = (rng() * 2 - 1) * crackEnvelope * crackGain;
      const boom = Math.sin(TAU * boomFrequency * t) * boomEnvelope * 0.85;
      const tail = (rng() * 2 - 1) * tailEnvelope * 0.14;

      return crack * 0.75 + boom + tail;
    }),
    0.94
  );
}

function createRevolverCock() {
  const samples = silence(0.42);
  add(samples, metallicClick(0.09, 1100, 0.72, 31), 0);
  add(samples, metallicClick(0.12, 1650, 0.55, 37), 0.13);
  add(samples, metallicClick(0.1, 720, 0.38, 41), 0.27);
  return normalize(samples, 0.82);
}

function createLeatherRustle() {
  const rng = createRandom(53);
  let low = 0;

  return normalize(
    makeSamples(0.58, (t) => {
      const envelope = Math.sin(Math.PI * Math.min(1, t / 0.58));
      low += ((rng() * 2 - 1) - low) * 0.035;
      return low * envelope * 0.78 + Math.sin(TAU * 115 * t) * envelope * 0.06;
    }),
    0.55
  );
}

function createBulletWhiz() {
  const rng = createRandom(67);

  return normalize(
    makeSamples(0.48, (t) => {
      const progress = t / 0.48;
      const frequency = 1850 - progress * 1260;
      const envelope = Math.sin(Math.PI * progress);
      const whistle = Math.sin(TAU * frequency * t + Math.sin(TAU * 18 * t) * 0.35);
      return whistle * envelope * 0.72 + (rng() * 2 - 1) * envelope * 0.06;
    }),
    0.72
  );
}

function createDustImpact() {
  const rng = createRandom(71);
  let low = 0;

  return normalize(
    makeSamples(0.55, (t) => {
      const envelope = Math.exp(-t * 8);
      low += ((rng() * 2 - 1) - low) * 0.08;
      const thud = Math.sin(TAU * 78 * t) * Math.exp(-t * 12) * 0.42;
      return low * envelope * 0.8 + thud;
    }),
    0.64
  );
}

function createBodyHit() {
  const rng = createRandom(83);

  return normalize(
    makeSamples(0.36, (t) => {
      const thump = Math.sin(TAU * 92 * t) * Math.exp(-t * 16);
      const slap = (rng() * 2 - 1) * Math.exp(-t * 26) * 0.45;
      return thump + slap;
    }),
    0.7
  );
}

function createPosterPaper() {
  const rng = createRandom(97);
  let high = 0;

  return normalize(
    makeSamples(0.5, (t) => {
      const firstFlap = Math.exp(-Math.abs(t - 0.08) * 32);
      const secondFlap = Math.exp(-Math.abs(t - 0.27) * 24);
      high = high * 0.52 + (rng() * 2 - 1) * 0.48;
      return high * (firstFlap * 0.48 + secondFlap * 0.34);
    }),
    0.55
  );
}

function createButtonClick() {
  const samples = silence(0.12);
  add(samples, metallicClick(0.045, 1350, 0.38, 101), 0);
  add(samples, tone(0.08, 520, 0.22, 14), 0.035);
  return normalize(samples, 0.5);
}

function createBountyBoardLoop() {
  const duration = 14;
  const samples = silence(duration);
  add(samples, windBed(duration, 109, 0.16), 0);

  const notes = [196, 247, 294, 330, 294, 247, 220, 196];
  for (let i = 0; i < 16; i += 1) {
    const note = notes[i % notes.length];
    add(samples, pluck(note, 1.2, 0.28, 120 + i), i * 0.82);
  }

  add(samples, tone(duration, 98, 0.08, 4), 0);
  return loopFade(normalize(samples, 0.72), 0.12);
}

function createTownWindLoop() {
  const duration = 18;
  const samples = silence(duration);
  add(samples, windBed(duration, 131, 0.34), 0);
  add(samples, whistleGust(duration, 880, 0.09), 0);
  return loopFade(normalize(samples, 0.6), 0.2);
}

function createDuelTensionLoop() {
  const duration = 10;
  const samples = silence(duration);
  add(samples, windBed(duration, 149, 0.12), 0);

  for (let time = 0.15; time < duration; time += 1.25) {
    add(samples, pulse(0.42, 64, 0.44), time);
  }

  for (let time = 0.7; time < duration; time += 2.5) {
    add(samples, pluck(147, 1.6, 0.16, Math.floor(time * 100)), time);
  }

  return loopFade(normalize(samples, 0.66), 0.12);
}

function createVictorySting() {
  const samples = silence(2.7);
  add(samples, pluck(294, 1.4, 0.36, 201), 0);
  add(samples, pluck(370, 1.4, 0.32, 202), 0.18);
  add(samples, pluck(440, 1.6, 0.34, 203), 0.36);
  add(samples, tone(2.1, 147, 0.18, 3), 0.42);
  add(samples, metallicClick(0.16, 980, 0.28, 204), 1.82);
  return normalize(samples, 0.75);
}

function createDefeatSting() {
  const samples = silence(2.9);
  add(samples, tone(2.4, 130.81, 0.18, 8), 0);
  add(samples, pluck(196, 1.2, 0.24, 211), 0.12);
  add(samples, pluck(164.81, 1.4, 0.24, 212), 0.62);
  add(samples, pluck(130.81, 1.8, 0.26, 213), 1.08);
  add(samples, windBed(2.9, 214, 0.1), 0);
  return normalize(samples, 0.7);
}

function metallicClick(duration, frequency, gain, seed) {
  const rng = createRandom(seed);

  return makeSamples(duration, (t) => {
    const envelope = Math.exp(-t * 38);
    const overtone = Math.sin(TAU * frequency * t) + Math.sin(TAU * frequency * 1.72 * t) * 0.42;
    return (overtone + (rng() * 2 - 1) * 0.32) * envelope * gain;
  });
}

function pluck(frequency, duration, gain, seed) {
  const rng = createRandom(seed);

  return makeSamples(duration, (t) => {
    const envelope = Math.exp(-t * 3.2) * (1 - Math.exp(-t * 80));
    const string =
      Math.sin(TAU * frequency * t) +
      Math.sin(TAU * frequency * 2.01 * t) * 0.34 +
      Math.sin(TAU * frequency * 3.02 * t) * 0.12;

    return (string + (rng() * 2 - 1) * 0.045) * envelope * gain;
  });
}

function tone(duration, frequency, gain, attack) {
  return makeSamples(duration, (t) => {
    const envelope = (1 - Math.exp(-t * attack)) * Math.exp(-t * 0.35);
    return Math.sin(TAU * frequency * t) * envelope * gain;
  });
}

function pulse(duration, frequency, gain) {
  return makeSamples(duration, (t) => {
    const envelope = Math.exp(-t * 5) * (1 - Math.exp(-t * 40));
    return Math.sin(TAU * frequency * t) * envelope * gain;
  });
}

function windBed(duration, seed, gain) {
  const rng = createRandom(seed);
  let low = 0;
  let mid = 0;

  return makeSamples(duration, (t) => {
    const raw = rng() * 2 - 1;
    low += (raw - low) * 0.008;
    mid += (raw - mid) * 0.035;
    const gust = 0.65 + Math.sin(TAU * 0.071 * t + 1.7) * 0.22 + Math.sin(TAU * 0.037 * t) * 0.12;
    return (low * 0.8 + mid * 0.2) * gust * gain;
  });
}

function whistleGust(duration, frequency, gain) {
  return makeSamples(duration, (t) => {
    const gust = Math.max(0, Math.sin(TAU * 0.052 * t - 0.8));
    return Math.sin(TAU * (frequency + Math.sin(TAU * 0.11 * t) * 80) * t) * gust * gain;
  });
}

function makeSamples(durationSeconds, render) {
  const length = Math.max(1, Math.floor(durationSeconds * SAMPLE_RATE));
  const samples = new Float32Array(length);

  for (let i = 0; i < length; i += 1) {
    samples[i] = render(i / SAMPLE_RATE, i);
  }

  return samples;
}

function silence(durationSeconds) {
  return new Float32Array(Math.max(1, Math.floor(durationSeconds * SAMPLE_RATE)));
}

function add(target, source, offsetSeconds) {
  const offset = Math.floor(offsetSeconds * SAMPLE_RATE);

  for (let i = 0; i < source.length; i += 1) {
    const targetIndex = offset + i;

    if (targetIndex >= target.length) {
      break;
    }

    target[targetIndex] += source[i];
  }
}

function normalize(samples, peak = 0.9) {
  let max = 0;

  for (const sample of samples) {
    max = Math.max(max, Math.abs(sample));
  }

  if (max <= 0) {
    return samples;
  }

  const gain = peak / max;
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] *= gain;
  }

  return samples;
}

function loopFade(samples, seconds) {
  const fadeLength = Math.min(samples.length, Math.floor(seconds * SAMPLE_RATE));

  for (let i = 0; i < fadeLength; i += 1) {
    const fadeIn = i / fadeLength;
    const fadeOut = 1 - i / fadeLength;
    samples[i] *= fadeIn;
    samples[samples.length - 1 - i] *= fadeOut;
  }

  return samples;
}

function encodeWav(samples) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * bytesPerSample);
  }

  return buffer;
}

function createRandom(seed) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}
