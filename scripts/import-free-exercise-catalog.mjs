#!/usr/bin/env node

/**
 * Imports the public-domain Free Exercise DB into a lazy, application-owned
 * reference catalogue. It intentionally does not retain the source step-by-
 * step instructions or images: Russian descriptions and safety copy below are
 * generated from factual fields only.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FREE_EXERCISE_DB_SOURCE = {
  name: "Free Exercise DB",
  url: "https://github.com/yuhonas/free-exercise-db",
  exportUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json",
  license: "Unlicense / public domain",
  expectedRecordCount: 873,
  importedAt: "2026-08-06"
};

const MUSCLE_NAMES = {
  abdominals: "мышцы живота",
  abductors: "отводящие мышцы бедра",
  adductors: "приводящие мышцы бедра",
  biceps: "бицепс",
  calves: "икры",
  chest: "грудные мышцы",
  forearms: "предплечья",
  glutes: "ягодицы",
  hamstrings: "задняя поверхность бедра",
  lats: "широчайшие мышцы спины",
  lower_back: "нижняя часть спины",
  middle_back: "середина спины",
  neck: "мышцы шеи",
  quadriceps: "квадрицепс",
  shoulders: "плечи",
  traps: "трапециевидные мышцы",
  triceps: "трицепс"
};

const EQUIPMENT_NAMES = {
  "body only": "собственный вес",
  bands: "эспандер",
  barbell: "штанга",
  "e-z curl bar": "EZ-гриф",
  cable: "кроссовер",
  dumbbell: "гантели",
  "exercise ball": "гимнастический мяч",
  "foam roll": "ролл для миофасциального релиза",
  kettlebells: "гири",
  machine: "тренажёр",
  "medicine ball": "медицинский мяч",
  other: "специальный инвентарь"
};

const CATEGORY_NAMES = {
  cardio: "Кардио",
  plyometrics: "Плиометрическое упражнение",
  powerlifting: "Силовое упражнение",
  strength: "Силовое упражнение",
  stretching: "Растяжка",
  strongman: "Силовое упражнение",
  "olympic weightlifting": "Тяжелоатлетическое упражнение"
};

const LEVEL_NAMES = {
  beginner: "начальный",
  intermediate: "средний",
  expert: "продвинутый"
};

const VERIFIED_RUSSIAN_TITLES = {
  Ab_Crunch_Machine: "Скручивания в тренажёре",
  Ab_Roller: "Выкатывание с роликом для пресса",
  Air_Bike: "Велосипедные скручивания",
  Alternate_Hammer_Curl: "Попеременные молотковые сгибания с гантелями",
  Barbell_Bench_Press_Medium_Grip: "Жим штанги лёжа средним хватом",
  Barbell_Curl: "Сгибание рук со штангой",
  Barbell_Deadlift: "Становая тяга со штангой",
  Barbell_Full_Squat: "Приседания со штангой",
  Barbell_Hip_Thrust: "Ягодичный мост со штангой",
  Barbell_Row: "Тяга штанги в наклоне",
  Bent_Over_Two_Dumbbell_Row: "Тяга двух гантелей в наклоне",
  Bicycle_Crunches: "Велосипедные скручивания",
  Cable_Crossover: "Сведение рук в кроссовере",
  Cable_Hammer_Curls: "Молотковые сгибания в кроссовере",
  Cable_Hip_Adduction: "Приведение бедра в кроссовере",
  Cable_Rope_Overhead_Triceps_Extension: "Разгибание рук с канатом из-за головы",
  Cable_Rope_Triceps_Pushdown: "Разгибание рук с канатом",
  Cable_Seated_Crunch: "Скручивания в кроссовере сидя",
  Cable_Seated_Row: "Горизонтальная тяга блока",
  Close_Grip_Barbell_Bench_Press: "Жим штанги лёжа узким хватом",
  Concentration_Curls: "Концентрированные сгибания с гантелью",
  Crunches: "Скручивания лёжа",
  Decline_Dumbbell_Flyes: "Разведение гантелей на наклонной скамье",
  Decline_Dumbbell_Press: "Жим гантелей на наклонной скамье вниз головой",
  Dumbbell_Bench_Press: "Жим гантелей лёжа",
  Dumbbell_Bicep_Curl: "Сгибание рук с гантелями",
  Dumbbell_Flyes: "Разведение гантелей лёжа",
  Dumbbell_Lunges: "Выпады с гантелями",
  Dumbbell_One_Arm_Row: "Тяга гантели в наклоне одной рукой",
  Dumbbell_Shoulder_Press: "Жим гантелей сидя",
  Dumbbell_Side_Lateral_Raise: "Подъём гантелей в стороны",
  Dumbbell_Squat: "Приседания с гантелью",
  Dumbbell_Straight_Leg_Deadlift: "Румынская тяга с гантелями",
  Dumbbell_Tricep_Extension: "Разгибание гантели из-за головы",
  Face_Pull: "Тяга каната к лицу",
  Flat_Bench_Lying_Leg_Raise: "Подъём ног лёжа на скамье",
  Front_Dumbbell_Raise: "Подъём гантелей перед собой",
  Glute_Ham_Raise: "Подъём корпуса на тренажёре для задней поверхности бедра",
  Hammer_Curls: "Молотковые сгибания с гантелями",
  Hyperextensions_Back_Extensions: "Гиперэкстензия",
  Incline_Dumbbell_Curl: "Сгибание рук с гантелями на наклонной скамье",
  Incline_Dumbbell_Flyes: "Разведение гантелей на наклонной скамье",
  Incline_Dumbbell_Press: "Жим гантелей на наклонной скамье",
  Incline_Push_Up: "Отжимания от высокой опоры",
  Lying_Leg_Curls: "Сгибание ног лёжа в тренажёре",
  Machine_Bench_Press: "Жим от груди в тренажёре",
  Machine_Bicep_Curl: "Сгибание рук в тренажёре",
  Machine_Calf_Raise: "Подъёмы на носки в тренажёре",
  Machine_Leg_Extensions: "Разгибание ног в тренажёре",
  Machine_Leg_Press: "Жим ногами",
  Machine_Preacher_Curls: "Сгибание рук на скамье Скотта",
  Machine_Seated_Leg_Curl: "Сгибание ног сидя в тренажёре",
  Muscle_Up: "Выход силой на перекладине",
  One_Arm_Dumbbell_Preacher_Curl: "Сгибание одной руки с гантелью на скамье Скотта",
  One_Arm_Dumbbell_Row: "Тяга гантели одной рукой",
  One_Arm_Kettlebell_Clean: "Подъём гири на грудь одной рукой",
  One_Arm_Long_Bar_Row: "Тяга T-грифа одной рукой",
  One_Arm_Prone_Hammer_Curl: "Молотковое сгибание одной руки лёжа на наклонной скамье",
  One_Arm_Side_Laterals: "Подъём гантели в сторону одной рукой",
  One_Arm_Triceps_Extension: "Разгибание руки с гантелью",
  Pec_Deck: "Сведение рук в тренажёре",
  Plank: "Планка",
  Pullups: "Подтягивания",
  Push_Ups: "Отжимания от пола",
  Reverse_Crunch: "Обратные скручивания",
  Seated_Barbell_Military_Press: "Жим штанги сидя",
  Seated_Cable_Rows: "Горизонтальная тяга блока сидя",
  Seated_Dumbbell_Curl: "Сгибание рук с гантелями сидя",
  Seated_Dumbbell_Press: "Жим гантелей сидя",
  Side_Lateral_Raise: "Подъём гантелей в стороны",
  Smith_Machine_Bench_Press: "Жим лёжа в Смите",
  Smith_Machine_Squat: "Приседания в Смите",
  Standing_Calf_Raises: "Подъёмы на носки стоя",
  Standing_Dumbbell_Upright_Row: "Тяга гантелей к подбородку",
  Standing_Military_Press: "Жим штанги стоя",
  Straight_Arm_Pulldown: "Тяга прямыми руками в кроссовере",
  Triceps_Pushdown: "Разгибание рук на верхнем блоке",
  Wide_Grip_Lat_Pulldown: "Тяга верхнего блока широким хватом"
};

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function asStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];
}

function translateList(values, dictionary) {
  return values.map((value) => dictionary[value] || value);
}

function labelForRecord(record, primaryMuscles, equipment) {
  const verified = VERIFIED_RUSSIAN_TITLES[record.id];
  if (verified) return { name: verified, titleStatus: "verified" };

  const focus = primaryMuscles.join(" и ") || "основные мышцы";
  const equipmentPart = equipment ? ` · ${equipment}` : "";
  return {
    name: `${CATEGORY_NAMES[record.category] || "Упражнение"} · ${focus}${equipmentPart}`,
    titleStatus: "source-fallback"
  };
}

function buildDescription(record, primaryMuscles, secondaryMuscles, equipment) {
  const category = CATEGORY_NAMES[record.category] || "Упражнение";
  const primary = primaryMuscles.length ? primaryMuscles.join(" и ") : "основные мышцы";
  const secondary = secondaryMuscles.length ? ` Дополнительно работают: ${secondaryMuscles.join(" и ")}.` : "";
  const equipmentText = equipment ? ` Инвентарь: ${equipment}.` : " Инвентарь не требуется или не указан.";
  return `${category}. Основная нагрузка: ${primary}.${secondary}${equipmentText}`;
}

function buildTechniqueCue(record) {
  if (record.category === "stretching") {
    return "Увеличивайте амплитуду постепенно и дышите спокойно, не пружиня в крайнем положении.";
  }
  if (record.category === "cardio") {
    return "Начните в ровном темпе и сохраняйте устойчивое, контролируемое движение.";
  }
  if (record.force === "static") {
    return "Займите устойчивое положение, сохраняйте ровное дыхание и не допускайте потери контроля.";
  }
  if (record.mechanic === "isolation") {
    return "Зафиксируйте корпус и выполняйте движение плавно, не помогая инерцией.";
  }
  return "Начните с лёгкой нагрузки, удерживайте корпус стабильно и контролируйте движение в обе стороны.";
}

function buildSafetyCue(record) {
  if (record.level === "expert" || record.category === "olympic weightlifting" || record.category === "strongman") {
    return "Выполняйте только при уверенной технике и под контролем квалифицированного специалиста; остановитесь при боли.";
  }
  return "Подбирайте нагрузку по технике, не выполняйте движение через боль и при сомнениях уточните вариант у тренера.";
}

function assertSourceRecord(record, index, errors) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    errors.push(`records[${index}] must be an object`);
    return;
  }

  ["id", "name", "level", "category"].forEach((field) => {
    if (!normalizeText(record[field])) errors.push(`records[${index}].${field} must be a non-empty string`);
  });

  ["primaryMuscles", "secondaryMuscles"].forEach((field) => {
    if (!Array.isArray(record[field])) errors.push(`records[${index}].${field} must be an array`);
  });
}

export function buildFreeExerciseCatalogue(sourceRecords, { importedAt = FREE_EXERCISE_DB_SOURCE.importedAt } = {}) {
  if (!Array.isArray(sourceRecords)) throw new Error("Free Exercise DB input must be an array.");
  if (sourceRecords.length < 800) throw new Error(`Expected at least 800 exercises, received ${sourceRecords.length}.`);

  const errors = [];
  const sourceIds = new Set();
  const sourceNames = new Set();
  sourceRecords.forEach((record, index) => {
    assertSourceRecord(record, index, errors);
    const sourceId = normalizeText(record?.id);
    const sourceName = normalizeText(record?.name);
    if (sourceId && sourceIds.has(sourceId)) errors.push(`records[${index}].id duplicates ${sourceId}`);
    if (sourceName && sourceNames.has(sourceName)) errors.push(`records[${index}].name duplicates ${sourceName}`);
    sourceIds.add(sourceId);
    sourceNames.add(sourceName);
  });
  if (errors.length) throw new Error(`Free Exercise DB validation failed:\n- ${errors.join("\n- ")}`);

  const catalogue = sourceRecords.map((record) => {
    const sourceId = normalizeText(record.id);
    const sourceName = normalizeText(record.name);
    const primaryMuscleCodes = asStringArray(record.primaryMuscles);
    const secondaryMuscleCodes = asStringArray(record.secondaryMuscles);
    const primaryMuscles = translateList(primaryMuscleCodes, MUSCLE_NAMES);
    const secondaryMuscles = translateList(secondaryMuscleCodes, MUSCLE_NAMES);
    const equipment = EQUIPMENT_NAMES[normalizeText(record.equipment)] || "";
    const title = labelForRecord(record, primaryMuscles, equipment);
    const aliases = [...new Set([title.titleStatus === "verified" ? title.name : "", sourceName].filter(Boolean))];
    const category = normalizeText(record.category);
    const level = normalizeText(record.level);
    const force = normalizeText(record.force);
    const mechanic = normalizeText(record.mechanic);
    const russianCategory = CATEGORY_NAMES[category] || "Упражнение";
    const searchableText = [
      title.name,
      sourceName,
      russianCategory,
      ...primaryMuscles,
      ...secondaryMuscles,
      equipment
    ].filter(Boolean).join(" ").toLocaleLowerCase("ru");

    return {
      catalogId: `fedb:${sourceId}`,
      sourceId,
      sourceName,
      name: title.name,
      titleStatus: title.titleStatus,
      aliases,
      searchableText,
      category,
      categoryLabel: russianCategory,
      level,
      levelLabel: LEVEL_NAMES[level] || "не указан",
      force,
      mechanic,
      equipment: normalizeText(record.equipment),
      equipmentLabel: equipment || "не указан",
      primaryMuscles: primaryMuscleCodes,
      primaryMuscleLabels: primaryMuscles,
      secondaryMuscles: secondaryMuscleCodes,
      secondaryMuscleLabels: secondaryMuscles,
      description: buildDescription(record, primaryMuscles, secondaryMuscles, equipment),
      techniqueCue: buildTechniqueCue(record),
      safetyCue: buildSafetyCue(record),
      basicPlanEligible: false,
      source: {
        name: FREE_EXERCISE_DB_SOURCE.name,
        url: FREE_EXERCISE_DB_SOURCE.url,
        license: FREE_EXERCISE_DB_SOURCE.license,
        sourceId
      }
    };
  }).sort((left, right) => left.catalogId.localeCompare(right.catalogId, "en"));

  const titleStatuses = catalogue.reduce((summary, item) => {
    summary[item.titleStatus] = (summary[item.titleStatus] || 0) + 1;
    return summary;
  }, {});

  return {
    meta: {
      schemaVersion: "basic-workout-full-catalog-v1",
      source: {
        ...FREE_EXERCISE_DB_SOURCE,
        importedAt,
        sourceRecordCount: catalogue.length
      },
      exerciseCount: catalogue.length,
      titleStatuses,
      contentPolicy: "Source instructions and image paths are deliberately excluded. Russian descriptions and safety cues are original application copy.",
      basicPlanPolicy: "The full reference catalogue is not an automatic AI allowlist. Only the reviewed basic-plan core may be used by the generator."
    },
    exercises: catalogue
  };
}

export async function writeFreeExerciseCatalogue(outputPath, catalogue) {
  const destination = path.resolve(outputPath);
  const source = [
    "// Generated by scripts/import-free-exercise-catalog.mjs. Do not edit by hand.",
    `export const BASIC_WORKOUT_FULL_CATALOGUE_META = ${JSON.stringify(catalogue.meta, null, 2)};`,
    `export const BASIC_WORKOUT_FULL_EXERCISE_CATALOGUE = ${JSON.stringify(catalogue.exercises, null, 2)};`,
    "export const BASIC_WORKOUT_FULL_EXERCISE_COUNT = BASIC_WORKOUT_FULL_EXERCISE_CATALOGUE.length;",
    ""
  ].join("\n");
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, source, "utf8");
}

export async function writeFreeExerciseCatalogueJson(outputPath, catalogue) {
  const destination = path.resolve(outputPath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, `${JSON.stringify(catalogue, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      args.help = true;
    } else if (argument === "--input" || argument === "--out" || argument === "--public-out") {
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
  console.log("Usage: node scripts/import-free-exercise-catalog.mjs --input <exercises.json> (--out <generated-module.js> | --public-out <catalogue.json>)");
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printUsage();
  if (!args.input || (!args.out && !args.publicOut)) {
    throw new Error("--input and at least one output (--out or --public-out) are required.");
  }

  const inputPath = path.resolve(args.input);
  const raw = await fs.readFile(inputPath, "utf8");
  const sourceRecords = JSON.parse(raw);
  const importedAt = new Date().toISOString().slice(0, 10);
  const catalogue = buildFreeExerciseCatalogue(sourceRecords, { importedAt });
  const sourceHash = crypto.createHash("sha256").update(raw).digest("hex");
  catalogue.meta.source.sha256 = sourceHash;
  if (args.out) await writeFreeExerciseCatalogue(args.out, catalogue);
  if (args.publicOut) await writeFreeExerciseCatalogueJson(args.publicOut, catalogue);
  console.log(JSON.stringify({
    exerciseCount: catalogue.exercises.length,
    titleStatuses: catalogue.meta.titleStatuses,
    sha256: sourceHash
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
