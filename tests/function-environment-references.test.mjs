import assert from "node:assert/strict";
import test from "node:test";
import { isKnownProductionReference } from "../functions/environmentReferences.js";

test("staging URLs, buckets, invite domains and webhooks are not rejected for sharing the production name prefix", () => {
  for (const value of ["tren-85720-staging", "https://tren-85720-staging.web.app/",
    "tren-85720-staging.firebasestorage.app", "gs://tren-85720-staging.firebasestorage.app/videos/one.mp4",
    "invite.tren-85720-staging.app", "https://europe-west1-tren-85720-staging.cloudfunctions.net/telegramWebhook",
    "https://storage.googleapis.com/tren-85720-staging.firebasestorage.app/videos/one.mp4",
    "https://tren-85720-staging.firebasestorage.app.storage.googleapis.com/videos/one.mp4",
    "https://firebasestorage.googleapis.com/v0/b/tren-85720-staging.firebasestorage.app/o/one.mp4",
    "https://staging.example.test/?note=tren-85720"]) assert.equal(isKnownProductionReference(value), false, value);
});

test("production project/hosts, host subdomains, buckets and function endpoints remain forbidden outside production", () => {
  for (const value of ["tren-85720", "https://tren-85720.web.app/", "https://tren-85720.firebaseapp.com/",
    "https://preview.tren-85720.web.app/", "https://tren-85720.web.app./", "TREN-85720.FIREBASESTORAGE.APP",
    "tren-85720.appspot.com", "gs://tren-85720.firebasestorage.app/videos/one.mp4", "invite.tren-85720.app",
    "https://europe-west1-tren-85720.cloudfunctions.net/telegramWebhook",
    "https://storage.googleapis.com/tren-85720.firebasestorage.app/videos/one.mp4",
    "https://tren-85720.firebasestorage.app.storage.googleapis.com/videos/one.mp4",
    "https://firebasestorage.googleapis.com/v0/b/tren-85720.appspot.com/o/one.mp4",
    "https://storage.cloud.google.com/tren-85720.firebasestorage.app/one.mp4"]) assert.equal(isKnownProductionReference(value), true, value);
});
