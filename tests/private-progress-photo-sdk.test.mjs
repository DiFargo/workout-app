import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium } from "@playwright/test";

const loaderPath = JSON.stringify(fileURLToPath(new URL("../src/utils/privateProgressPhoto.js", import.meta.url)).replaceAll("\\", "/"));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const bundle = await rolldown({ input: "private-sdk-proof", platform: "browser", plugins: [{
  name: "private-sdk-proof",
  resolveId(id) {
    if (["private-sdk-proof", "private-sdk-app"].includes(id)) return id;
    if (/\/firebase(?:\.js)?$/.test(id)) return "private-sdk-app";
    if (id === "firebase/auth") return "private-sdk-auth";
    return null;
  },
  load(id) {
    if (id === "private-sdk-auth") return "export const onAuthStateChanged=()=>()=>{};";
    if (id === "private-sdk-app") return `import{initializeApp}from'firebase/app';export const app=initializeApp({apiKey:'fixture',projectId:'fixture',storageBucket:'fixture.invalid'});export const auth={currentUser:{uid:'fixture'}};`;
    if (id !== "private-sdk-proof") return null;
    return `import{getBlob,getStorage,ref}from'firebase/storage';import{app}from'private-sdk-app';
      import{startPrivateProgressPhotoLoad,PRIVATE_PROGRESS_PHOTO_MAX_BYTES}from ${loaderPath};
      window.probeSdk=async()=>{
        const raw=await getBlob(ref(getStorage(app),'progress-photos/fixture/session/front.png'),PRIVATE_PROGRESS_PHOTO_MAX_BYTES);
        let state,normalized,revoked=0;
        const request=startPrivateProgressPhotoLoad({source:'gs://fixture.invalid/progress-photos/fixture/session/front.png',onState:value=>{state=value},urlApi:{
          createObjectURL:blob=>{normalized=blob;return URL.createObjectURL(blob)},revokeObjectURL:url=>{revoked++;URL.revokeObjectURL(url)}
        }});
        await request.completion;
        const image=new Image();image.src=state.url;await image.decode();
        const result={rawType:raw.type,rawSize:raw.size,status:state.status,normalizedType:normalized.type,normalizedSize:normalized.size,width:image.naturalWidth};
        request.dispose();return{...result,revoked,aborted:request.signal.aborted};
      };`;
  }
}] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();

test("actual Firebase SDK bounded getBlob loses MIME; private loader validates bytes, restores type and renders", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), requests = [];
    await page.route("https://firebasestorage.googleapis.com/**", route => {
      requests.push({ method: route.request().method(), range: route.request().headers().range, tokenQuery: new URL(route.request().url()).searchParams.has("token") });
      return route.fulfill({ status: 206, headers: { "Content-Type": "image/png", "Access-Control-Allow-Origin": "*", "Content-Range": `bytes 0-${png.length - 1}/${png.length}` }, body: png });
    });
    await page.setContent("<main></main>");
    await page.addScriptTag({ content: generated.output[0].code });
    assert.deepEqual(await page.evaluate(() => window.probeSdk()), {
      rawType: "", rawSize: png.length, status: "ready", normalizedType: "image/png", normalizedSize: png.length, width: 1, revoked: 1, aborted: true
    });
    // The SDK requests an inclusive upper Range of maxBytes, then slices its
    // returned Blob to maxBytes. Both calls must keep the bounded SDK path.
    assert.deepEqual(requests, [1, 2].map(() => ({ method: "GET", range: "bytes=0-10485760", tokenQuery: false })));
  } finally { await browser.close(); }
});
