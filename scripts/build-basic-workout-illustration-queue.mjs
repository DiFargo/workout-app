#!/usr/bin/env node

/**
 * Builds a non-runtime queue for the full exercise illustration project.
 *
 * The queue is intentionally kept outside public/ and is not imported by the
 * app. It gives asset-generation and QA tooling one deterministic record per
 * source exercise without making the large 873-item catalogue part of the
 * startup path.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_CATALOGUE_PATH = "public/basic-workout/exercise-catalogue.v1.json";
export const DEFAULT_QUEUE_PATH = "data/basic-workout-illustration-build/exercise-illustration-queue.v1.json";
export const ILLUSTRATION_QUEUE_SCHEMA_VERSION = "basic-workout-illustration-queue-v1";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function compareAscii(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function asExerciseArray(value, label) {
  const exercises = Array.isArray(value) ? value : value?.exercises;
  if (!Array.isArray(exercises)) {
    throw new Error(`${label} must be an array or an object with an exercises array.`);
  }
  return exercises;
}

/**
 * Produces a Windows-safe, URL-safe asset filename from a stable source id.
 * The source catalogue uses ids as the canonical keys; display titles are not
 * used because they may be edited or localized later.
 */
export function safeIllustrationFilename(sourceId) {
  const normalized = normalizeText(sourceId);
  if (!normalized) throw new Error("Cannot create an illustration filename without a sourceId.");

  const stem = normalized
    .replace(/[^A-Za-z0-9_-]+/gu, "_")
    .replace(/^_+|_+$/gu, "");

  if (!stem) throw new Error(`sourceId cannot be converted to a safe filename: ${sourceId}`);

  // Keep paths comfortably within the Windows filename limit if a later
  // source catalogue uses long identifiers. The hash preserves uniqueness.
  const safeStem = stem.length > 120
    ? `${stem.slice(0, 104)}_${sha256(normalized).slice(0, 12)}`
    : stem;

  return `${safeStem}.webp`;
}

export function getCatalogueIllustrationRecords(catalogue) {
  const seenSourceIds = new Set();
  const seenFilenames = new Map();

  const records = asExerciseArray(catalogue, "Catalogue")
    .map((exercise, index) => {
      const sourceId = normalizeText(exercise?.sourceId);
      const sourceName = normalizeText(exercise?.sourceName);
      if (!sourceId) throw new Error(`Catalogue exercise at index ${index} is missing sourceId.`);
      if (!sourceName) throw new Error(`Catalogue exercise ${sourceId} is missing sourceName.`);
      if (seenSourceIds.has(sourceId)) throw new Error(`Catalogue contains duplicate sourceId: ${sourceId}`);
      seenSourceIds.add(sourceId);

      const safeFilename = safeIllustrationFilename(sourceId);
      const collidingSourceId = seenFilenames.get(safeFilename);
      if (collidingSourceId) {
        throw new Error(`Illustration filename collision: ${collidingSourceId} and ${sourceId} both map to ${safeFilename}`);
      }
      seenFilenames.set(safeFilename, sourceId);

      return {
        sourceId,
        sourceName,
        safeFilename,
        category: normalizeText(exercise?.category),
        equipment: normalizeText(exercise?.equipment),
        primaryMuscles: Array.isArray(exercise?.primaryMuscles)
          ? exercise.primaryMuscles.map((muscle) => normalizeText(muscle)).filter(Boolean)
          : []
      };
    })
    .sort((left, right) => compareAscii(left.sourceId, right.sourceId));

  if (!records.length) throw new Error("Catalogue does not contain any exercises.");
  return records;
}

function buildSourceInstructionMap(sourceInput) {
  const instructionsBySourceId = new Map();
  const seenSourceIds = new Set();

  asExerciseArray(sourceInput, "Source input").forEach((exercise, index) => {
    const sourceId = normalizeText(exercise?.id || exercise?.sourceId);
    if (!sourceId) throw new Error(`Source input exercise at index ${index} is missing id.`);
    if (seenSourceIds.has(sourceId)) throw new Error(`Source input contains duplicate id: ${sourceId}`);
    seenSourceIds.add(sourceId);

    if (!Array.isArray(exercise?.instructions)) return;
    const instructions = exercise.instructions.filter((instruction) => (
      typeof instruction === "string" && instruction.trim().length > 0
    ));
    if (instructions.length) instructionsBySourceId.set(sourceId, instructions);
  });

  return instructionsBySourceId;
}

/**
 * Makes a stable JSON-serializable queue keyed by sourceId. Source-derived
 * instructions are included only when an explicit source input was supplied.
 */
export function buildBasicWorkoutIllustrationQueue(catalogue, {
  sourceInput = null,
  sourceInputSha256 = ""
} = {}) {
  const records = getCatalogueIllustrationRecords(catalogue);
  const instructionsBySourceId = sourceInput ? buildSourceInstructionMap(sourceInput) : null;
  const bySourceId = {};

  records.forEach((record) => {
    const entry = {
      sourceId: record.sourceId,
      sourceName: record.sourceName,
      safeFilename: record.safeFilename,
      category: record.category,
      equipment: record.equipment,
      primaryMuscles: record.primaryMuscles
    };

    const originalInstructions = instructionsBySourceId?.get(record.sourceId);
    if (originalInstructions) entry.originalInstructions = originalInstructions;
    bySourceId[record.sourceId] = entry;
  });

  const meta = {
    schemaVersion: ILLUSTRATION_QUEUE_SCHEMA_VERSION,
    catalogueSchemaVersion: normalizeText(catalogue?.meta?.schemaVersion),
    catalogueSourceSha256: normalizeText(catalogue?.meta?.source?.sha256),
    exerciseCount: records.length,
    originalInstructionsIncluded: Boolean(sourceInput)
  };
  if (sourceInputSha256) meta.sourceInputSha256 = sourceInputSha256;

  return { meta, bySourceId };
}

async function readJson(filePath, label) {
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return { value: JSON.parse(raw), sha256: sha256(raw) };
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

export async function writeBasicWorkoutIllustrationQueue(outputPath, queue) {
  const destination = path.resolve(outputPath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      args.help = true;
    } else if (["--catalogue", "--source-input", "--out"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      args[argument.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return args;
}

function printUsage() {
  console.log([
    "Usage: node scripts/build-basic-workout-illustration-queue.mjs [options]",
    "",
    `  --catalogue <path>     Full catalogue JSON (default: ${DEFAULT_CATALOGUE_PATH})`,
    "  --source-input <path>  Optional Free Exercise DB source JSON; includes its original instructions",
    `  --out <path>           Queue output (default: ${DEFAULT_QUEUE_PATH})`
  ].join("\n"));
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printUsage();

  const cataloguePath = path.resolve(args.catalogue || DEFAULT_CATALOGUE_PATH);
  const catalogue = await readJson(cataloguePath, "Catalogue");
  let sourceInput = null;
  let sourceInputSha256 = "";

  if (args.sourceInput) {
    const source = await readJson(path.resolve(args.sourceInput), "Source input");
    sourceInput = source.value;
    sourceInputSha256 = source.sha256;
  }

  const queue = buildBasicWorkoutIllustrationQueue(catalogue.value, {
    sourceInput,
    sourceInputSha256
  });
  const outputPath = args.out || DEFAULT_QUEUE_PATH;
  await writeBasicWorkoutIllustrationQueue(outputPath, queue);
  console.log(JSON.stringify({
    output: outputPath,
    exerciseCount: queue.meta.exerciseCount,
    originalInstructionsIncluded: queue.meta.originalInstructionsIncluded
  }, null, 2));
}

const executedAsScript = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (executedAsScript) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
