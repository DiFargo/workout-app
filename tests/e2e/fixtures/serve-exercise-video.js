import { readFile } from 'node:fs/promises';

const fixture = readFile(new URL('../../../public/videos/1ea4065d-8785-4c13-9fd5-a5bdf409b6b7.mp4', import.meta.url));

// Serve the real clip locally, including seek requests. A nested route.fetch()
// can outlive the page during media preloading and fail test teardown.
export async function serveExerciseVideo(page) {
  const video = await fixture;
  await page.route('**/e2e-media/*.mp4', async route => {
    const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
    const headers = { 'content-type': 'video/mp4', 'accept-ranges': 'bytes' };
    if (!range) return route.fulfill({ status: 200, headers, body: video });
    const start = Number(range[1]);
    const end = Math.min(range[2] ? Number(range[2]) : video.length - 1, video.length - 1);
    if (start > end || start >= video.length) {
      return route.fulfill({ status: 416, headers: { ...headers, 'content-range': `bytes */${video.length}` }, body: '' });
    }
    return route.fulfill({ status: 206, headers: { ...headers, 'content-range': `bytes ${start}-${end}/${video.length}` }, body: video.subarray(start, end + 1) });
  });
}
