#!/usr/bin/env node

/**
 * Verifies that every exercise in the full catalogue has a non-empty WebP
 * illustration at the deterministic path used by the illustration queue.
 * This is deliberately a build/QA script, not a runtime dependency.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_CATALOGUE_PATH,
  getCatalogueIllustrationRecords
} from "./build-basic-workout-illustration-queue.mjs";

export const DEFAULT_ILLUSTRATIONS_DIR = "public/basic-workout/exercises/catalogue/v1";

async function readCatalogue(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Catalogue is not valid JSON: ${error.message}`);
  }
}

async function checkWebp(filePath) {
  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return { status: "missing" };
    return { status: "invalid", reason: error.message };
  }

  if (!stats.isFile()) return { status: "invalid", reason: "not a file" };
  if (stats.size < 12) return { status: "invalid", reason: "file is too small to be a WebP" };

  const handle = await fs.open(filePath, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const isWebp = bytesRead === 12
      && header.subarray(0, 4).toString("ascii") === "RIFF"
      && header.subarray(8, 12).toString("ascii") === "WEBP";
    return isWebp
      ? { status: "valid", bytes: stats.size }
      : { status: "invalid", reason: "missing RIFF/WEBP file signature" };
  } finally {
    await handle.close();
  }
}

export async function verifyBasicWorkoutIllustrations({
  cataloguePath = DEFAULT_CATALOGUE_PATH,
  illustrationsDir = DEFAULT_ILLUSTRATIONS_DIR
} = {}) {
  const catalogue = await readCatalogue(path.resolve(cataloguePath));
  const records = getCatalogueIllustrationRecords(catalogue);
  const directory = path.resolve(illustrationsDir);
  const checks = await Promise.all(records.map(async (record) => {
    const filePath = path.join(directory, record.safeFilename);
    return {
      sourceId: record.sourceId,
      safeFilename: record.safeFilename,
      filePath,
      ...(await checkWebp(filePath))
    };
  }));

  const missing = checks.filter((check) => check.status === "missing");
  const invalid = checks.filter((check) => check.status === "invalid");
  const valid = checks.filter((check) => check.status === "valid");

  return {
    cataloguePath,
    illustrationsDir,
    exerciseCount: records.length,
    validCount: valid.length,
    missing,
    invalid
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      args.help = true;
    } else if (["--catalogue", "--images-dir"].includes(argument)) {
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
    "Usage: node scripts/verify-basic-workout-illustrations.mjs [options]",
    "",
    `  --catalogue <path>  Full catalogue JSON (default: ${DEFAULT_CATALOGUE_PATH})`,
    `  --images-dir <path> WebP asset folder (default: ${DEFAULT_ILLUSTRATIONS_DIR})`
  ].join("\n"));
}

function printFailures(label, failures) {
  const preview = failures.slice(0, 20);
  console.error(`${label} (${failures.length}):`);
  preview.forEach((failure) => {
    const detail = failure.reason ? ` — ${failure.reason}` : "";
    console.error(`- ${failure.safeFilename}${detail}`);
  });
  if (failures.length > preview.length) console.error(`- … and ${failures.length - preview.length} more`);
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printUsage();

  const result = await verifyBasicWorkoutIllustrations({
    cataloguePath: args.catalogue || DEFAULT_CATALOGUE_PATH,
    illustrationsDir: args.imagesDir || DEFAULT_ILLUSTRATIONS_DIR
  });

  console.log(JSON.stringify({
    cataloguePath: result.cataloguePath,
    illustrationsDir: result.illustrationsDir,
    exerciseCount: result.exerciseCount,
    validCount: result.validCount,
    missingCount: result.missing.length,
    invalidCount: result.invalid.length
  }, null, 2));

  if (result.missing.length || result.invalid.length) {
    if (result.missing.length) printFailures("Missing illustrations", result.missing);
    if (result.invalid.length) printFailures("Invalid WebP files", result.invalid);
    process.exitCode = 1;
  }
}

const executedAsScript = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (executedAsScript) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
