import test from 'node:test';
import assert from 'node:assert/strict';
import { planExercisePreviewCopies, copyExercisePreviewAssets } from '../scripts/lib/exercise-preview-copy.mjs';

const bucket = 'tren-85720.firebasestorage.app';
const from = 'template-exercise-videos/source/video.mp4';
const to = 'template-exercise-videos/target/video.mp4';
const card = { video: `gs://${bucket}/${from}`, videoPosterTime: 7.695 };
const [job] = planExercisePreviewCopies([card], new Map([[from, to]]), bucket);
const poster = { contentType: 'image/webp', size: '123', md5Hash: 'poster', generation: '12', cacheControl: 'private, no-store, max-age=0' };
function fixture({ existing = false, missing = false, mismatch = false } = {}) {
  const objects = new Map([[from, { size: '1000', md5Hash: 'video' }], [to, { size: '1000', md5Hash: mismatch ? 'different' : 'video' }]]);
  if (!missing) objects.set(job.sourcePreview, poster);
  if (existing) objects.set(job.destinationPreview, poster);
  const writes = [];
  return { writes, storage: {
    async get(path) { const body = objects.get(decodeURIComponent(path.split('/o/')[1])); return { status: body ? 200 : 404, body }; },
    async post(path, body, options) { writes.push({ path, body, options }); objects.set(job.destinationPreview, { ...poster, ...body }); }
  } };
}
test('nested cards deduplicate previews; timestamp and destination determine identity', () => {
  const jobs = planExercisePreviewCopies([card, { workouts: [{ exercises: [card, { ...card, videoPosterTime: 8 }] }] }], new Map([[from, to]]), bucket);
  assert.equal(jobs.length, 2);
  assert.notEqual(job.sourcePreview, job.destinationPreview);
  assert.notEqual(jobs[0].destinationPreview, jobs[1].destinationPreview);
  assert.equal(planExercisePreviewCopies([{ ...card, videoPosterTime: null }], new Map([[from, to]]), bucket).length, 0);
  assert.equal(planExercisePreviewCopies([card], new Map([[from, from]]), bucket).length, 0);
});
test('dry run validates identical videos without writes', async () => {
  const f = fixture();
  assert.deepEqual(await copyExercisePreviewAssets([job], { ...f, bucket }), { planned: 1, copied: 0, existing: 0, sourceMissing: 0 });
  assert.equal(f.writes.length, 0);
});
test('apply creates private preview with generation preconditions and verifies it', async () => {
  const f = fixture();
  assert.equal((await copyExercisePreviewAssets([job], { ...f, bucket, apply: true })).copied, 1);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.writes[0].options.queryParams, { ifGenerationMatch: 0, ifSourceGenerationMatch: '12' });
  assert.equal(f.writes[0].body.cacheControl, 'private, no-store, max-age=0');
  assert.equal(f.writes[0].body.metadata.firebaseStorageDownloadTokens, null);
});
test('existing previews are preserved and missing sources are reported', async () => {
  for (const flag of ['existing', 'missing']) {
    const f = fixture({ [flag]: true });
    const result = await copyExercisePreviewAssets([job], { ...f, bucket, apply: true });
    assert.equal(result[flag === 'existing' ? 'existing' : 'sourceMissing'], 1);
    assert.equal(f.writes.length, 0);
  }
});
test('different video bytes prevent preview reuse', async () => {
  const f = fixture({ mismatch: true });
  await assert.rejects(copyExercisePreviewAssets([job], { ...f, bucket, apply: true }), /Video copy differs/);
  assert.equal(f.writes.length, 0);
});
test('unsafe existing poster policy fails without any overwrite', async () => {
  const writes = [];
  const storage = { get: async () => ({ status: 200, body: { ...poster, metadata: { firebaseStorageDownloadTokens: 'unsafe' } } }), post: async (...args) => writes.push(args) };
  await assert.rejects(copyExercisePreviewAssets([job], { storage, bucket, apply: true }), /Existing preview policy/);
  assert.equal(writes.length, 0);
});
