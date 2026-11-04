// Firebase publishes its auth transition before the client finishes creating
// the corresponding Firestore profile. Bootstrap must wait, then verify the
// actual server profile; this promise never supplies a role or grants access.
const preparations = new WeakMap();

export function beginAuthProfilePreparation(auth) {
  let complete;
  const promise = new Promise((resolve) => { complete = resolve; });
  const operation = { promise, complete: () => {
    if (preparations.get(auth) === operation) preparations.delete(auth);
    complete();
  } };
  preparations.set(auth, operation);
  return operation.complete;
}

export function cancelAuthProfilePreparation(auth) {
  preparations.get(auth)?.complete();
}

export async function waitForAuthProfilePreparation(auth) {
  let pending;
  while ((pending = preparations.get(auth))) await pending.promise;
}
