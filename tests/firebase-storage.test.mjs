import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("Firebase Storage stays out of the startup module and loads on demand", async () => {
  const [firebaseSource, storageHelperSource, viteConfigSource] = await Promise.all([
    fs.readFile("src/firebase.js", "utf8"),
    fs.readFile("src/utils/firebaseStorage.js", "utf8"),
    fs.readFile("vite.config.js", "utf8")
  ]);

  assert.doesNotMatch(firebaseSource, /firebase\/storage/);
  assert.match(storageHelperSource, /import\("firebase\/storage"\)/);
  assert.match(storageHelperSource, /export async function uploadStorageFile/);
  assert.match(viteConfigSource, /return "firebase-storage"/);
});
