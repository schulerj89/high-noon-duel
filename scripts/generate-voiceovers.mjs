import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_VOICE_ID = "ruirxsoakN0GWmGNIo04";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const API_KEY_ENV = "ELEVENLABS_API_KEY";
const ELEVENLABS_TTS_BASE_URL = "https://api.elevenlabs.io/v1/text-to-speech";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env");
const voiceLinesPath = path.join(repoRoot, "scripts", "voice-lines.json");
const outputDir = path.join(repoRoot, "public", "audio", "voice");

await loadDotEnv(envPath);

const options = parseCliOptions(process.argv.slice(2));
const apiKey = process.env[API_KEY_ENV];
const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;

if (!apiKey) {
  console.error(
    `Missing ${API_KEY_ENV}. Set it in your environment, .env, or run through your local secret broker.`
  );
  process.exitCode = 1;
} else {
  try {
    await main({ apiKey, voiceId, modelId, options });
  } catch (error) {
    console.error(formatError(error));
    process.exitCode = 1;
  }
}

async function main({ apiKey, voiceId, modelId, options }) {
  const allLines = await readVoiceLines(voiceLinesPath);
  const lines = options.only
    ? allLines.filter((line) => line.id === options.only)
    : allLines;

  if (options.only && lines.length === 0) {
    console.error(`No voice line found for --only ${options.only}.`);
    process.exitCode = 1;
    return;
  }

  await mkdir(outputDir, { recursive: true });

  console.log(`Generating ${lines.length} voice line${lines.length === 1 ? "" : "s"}.`);
  console.log(`Voice ID: ${voiceId}`);
  console.log(`Model ID: ${modelId}`);
  console.log(`Output: ${path.relative(repoRoot, outputDir)}`);

  const failures = [];

  for (const line of lines) {
    const outputPath = path.join(outputDir, `${line.id}.mp3`);
    const relativeOutput = path.relative(repoRoot, outputPath);

    if (!options.force && (await fileExists(outputPath))) {
      console.log(`skip ${line.id}: ${relativeOutput} already exists`);
      continue;
    }

    console.log(`generate ${line.id}: "${line.text}"`);

    try {
      const bytes = await generateSpeech({
        apiKey,
        voiceId,
        modelId,
        text: line.text
      });
      await writeFile(outputPath, bytes);
      console.log(`saved ${line.id}: ${relativeOutput}`);
    } catch (error) {
      failures.push({ id: line.id, error });
      console.error(`failed ${line.id}: ${formatError(error)}`);
    }
  }

  if (failures.length > 0) {
    console.error(`Voice generation finished with ${failures.length} failure(s).`);
    process.exitCode = 1;
    return;
  }

  console.log("Voice generation complete.");
}

async function generateSpeech({ apiKey, voiceId, modelId, text }) {
  const response = await fetch(`${ELEVENLABS_TTS_BASE_URL}/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": apiKey
    },
    body: JSON.stringify({
      text,
      model_id: modelId
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await readErrorBody(response)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function readVoiceLines(filePath) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("scripts/voice-lines.json must contain an array.");
  }

  const seenIds = new Set();
  const lines = [];

  for (const [index, item] of parsed.entries()) {
    if (!isRecord(item)) {
      throw new Error(`Voice line at index ${index} must be an object.`);
    }

    const { id, text } = item;

    if (typeof id !== "string" || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(id)) {
      throw new Error(`Voice line at index ${index} has an invalid id.`);
    }

    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error(`Voice line "${id}" has empty text.`);
    }

    if (seenIds.has(id)) {
      throw new Error(`Duplicate voice line id "${id}".`);
    }

    seenIds.add(id);
    lines.push({ id, text });
  }

  return lines;
}

async function loadDotEnv(filePath) {
  if (!(await fileExists(filePath))) {
    return;
  }

  const raw = await readFile(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = unquoteEnvValue(trimmed.slice(equalsIndex + 1).trim());

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(args) {
  const options = {
    force: false,
    only: null
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--only") {
      const value = args[i + 1];

      if (!value || value.startsWith("--")) {
        throw new Error("--only requires a voice line id.");
      }

      options.only = value;
      i += 1;
      continue;
    }

    if (arg.startsWith("--only=")) {
      options.only = arg.slice("--only=".length);
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function parseCliOptions(args) {
  try {
    return parseArgs(args);
  } catch (error) {
    console.error(formatError(error));
    process.exit(1);
  }
}

async function readErrorBody(response) {
  const body = await response.text();
  return body.length > 400 ? `${body.slice(0, 400)}...` : body;
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function unquoteEnvValue(value) {
  const quote = value[0];

  if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }

  return value;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}
