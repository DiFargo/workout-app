import { resolveProtectedExerciseVideoSource } from "../../functions/protectedExerciseVideo.js";
import { resolveExerciseVideoPreviewAssetPath } from "../../functions/exerciseVideoPreviewAsset.js";
import { normalizeExerciseVideoPosterTime } from "../../functions/exerciseVideoPoster.js";

// A preview belongs to both the exact video object and the selected timestamp.
// Copying the MP4 alone cannot preserve its derived WebP identity.
export function planExercisePreviewCopies(values, mediaMap, bucket) {
  const jobs = new Map();
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const source = value.video || value.videoUrl || value.videoURL;
    const previewTime = normalizeExerciseVideoPosterTime(value.videoPosterTime);
    if (source && previewTime !== null) {
      const video = resolveProtectedExerciseVideoSource(source, bucket);
      const destination = mediaMap.get(video.objectPath);
      if (destination && destination !== video.objectPath) {
        const sourcePreview = resolveExerciseVideoPreviewAssetPath({ ...video, previewTime });
        const destinationPreview = resolveExerciseVideoPreviewAssetPath({ bucket, objectPath: destination, previewTime });
        jobs.set(destinationPreview, { sourceVideo: video.objectPath, destinationVideo: destination,
          sourcePreview, destinationPreview, previewTime });
      }
    }
    Object.values(value).forEach(visit);
  };
  values.forEach(visit);
  return [...jobs.values()];
}

export async function copyExercisePreviewAssets(jobs, { storage, bucket, apply = false }) {
  const result = { planned: jobs.length, copied: 0, existing: 0, sourceMissing: 0 };
  const metadata = path => storage.get(`/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}`, { resolveOnHTTPError: true });
  const valid = object => object?.contentType === "image/webp" && Number(object.size) > 0 && Number(object.size) <= 512 * 1024 &&
    object.cacheControl === "private, no-store, max-age=0" && !object.metadata?.firebaseStorageDownloadTokens;
  for (const job of jobs) {
    const destination = await metadata(job.destinationPreview);
    if (destination.status === 200) {
      if (!valid(destination.body)) throw new Error("Existing preview policy is invalid; no overwrite performed");
      result.existing++;
      continue;
    }
    if (destination.status !== 404) throw new Error("Destination preview metadata unavailable");
    const source = await metadata(job.sourcePreview);
    if (source.status === 404) { result.sourceMissing++; continue; }
    if (source.status !== 200 || !valid(source.body)) throw new Error("Source preview metadata invalid");
    const [sourceVideo, destinationVideo] = await Promise.all([metadata(job.sourceVideo), metadata(job.destinationVideo)]);
    if (sourceVideo.status !== 200 || destinationVideo.status !== 200 || !sourceVideo.body.md5Hash ||
      sourceVideo.body.md5Hash !== destinationVideo.body.md5Hash || sourceVideo.body.size !== destinationVideo.body.size) {
      throw new Error("Video copy differs; preview must not be reused");
    }
    if (!apply) continue;
    await storage.post(`/storage/v1/b/${bucket}/o/${encodeURIComponent(job.sourcePreview)}/copyTo/b/${bucket}/o/${encodeURIComponent(job.destinationPreview)}`, {
      contentType: "image/webp", cacheControl: "private, no-store, max-age=0", contentDisposition: "inline",
      metadata: { firebaseStorageDownloadTokens: null }
    }, { queryParams: { ifGenerationMatch: 0, ifSourceGenerationMatch: source.body.generation }, retries: 0 });
    const verified = await metadata(job.destinationPreview);
    if (verified.status !== 200 || !valid(verified.body) || verified.body.md5Hash !== source.body.md5Hash) throw new Error("Copied preview verification failed");
    result.copied++;
  }
  return result;
}
