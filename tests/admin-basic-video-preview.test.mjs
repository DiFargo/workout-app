import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { normalizeExerciseVideoPosterTime } from "../functions/exerciseVideoPoster.js";

const source = readFileSync(new URL("../src/components/admin/AdminBaseLibrary.jsx", import.meta.url), "utf8");
const helpers = source.slice(source.indexOf("function getRecord("), source.indexOf("function getFirstList("));
const rowSource = source.slice(source.indexOf("function createExerciseRow("), source.indexOf("export default function AdminBaseLibrary("));
const createExerciseRow = runInNewContext(`${helpers}\n${rowSource}\ncreateExerciseRow`, {
  normalizeExerciseVideoPosterTime,
  getBasicWorkoutMannequinIllustrationSource: () => ""
});

test("admin basic exercise preview uses only the selected source's normalized frame", () => {
  const exercise = { id: "leg_press", name: "Жим ногами", video: "/base.mp4" };
  const row = (override) => createExerciseRow(exercise, 0, { leg_press: override });
  assert.equal(row({ videoUrl: "/approved.mp4", videoPosterTime: 0 }).videoPosterTime, 0);
  assert.equal(row({ videoUrl: "/approved.mp4", videoPosterTime: 2.34567 }).videoPosterTime, 2.346);
  assert.equal(row({ videoUrl: "/approved.mp4", videoPosterTime: -1 }).videoPosterTime, null);
  assert.equal(row({ videoPosterTime: 8 }).videoPosterTime, null);
  assert.equal(row({ videoUrl: "/approved.mp4", videoPosterTime: 8, videoDisabled: true }).videoPosterTime, null);
  assert.equal(row({ videoUrl: "/approved.mp4" }).videoPosterTime, null);
});
