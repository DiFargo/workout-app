import test from "node:test";
import assert from "node:assert/strict";
import { createTrainerLibraryLoadHandler, deferredHandlerFactory } from "../src/app/trainerAsyncHandlers.js";
import { advanceAuthSession, captureAuthSession } from "../src/utils/authSession.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function libraryWrapperFixture(known = false) {
  const auth = { currentUser: { uid: "trainer" } };
  advanceAuthSession(auth);
  const values = {
    state: known ? { session: captureAuthSession(auth), templates: "ready", cards: "ready", templatesKnown: true, cardsKnown: true } : null,
    transitions: [],
    messages: []
  };
  const setState = update => {
    const next = typeof update === "function" ? update(values.state) : update;
    if (next !== values.state) { values.state = next; values.transitions.push(next); }
  };
  const ready = () => setState(previous => ({ ...previous, templates: "ready", cards: "ready", templatesKnown: true, cardsKnown: true }));
  const context = { auth, setTrainerLibraryLoadState: setState, setAdminClientStatus: message => values.messages.push(message) };
  return { auth, values, context, ready };
}

test("trainer async factories load on demand, share code, and keep call context", async () => {
  let imports = 0, factories = 0;
  const create = deferredHandlerFactory(async () => {
    imports++;
    return { create: context => { factories++; return { read: async suffix => context.name + suffix }; } };
  }, "create", ["read"]);
  const auth = { currentUser: { uid: "trainer" } };
  const first = create({ auth, name: "first" }), second = create({ auth, name: "second" });
  assert.equal(imports, 0);
  assert.deepEqual(await Promise.all([first.read("!"), second.read("?")]), ["first!", "second?"]);
  assert.equal(imports, 1);
  assert.equal(factories, 2);
});

test("an auth transition during lazy import cannot dispatch an old action", async () => {
  const auth = { currentUser: { uid: "trainer" } };
  let resolve, calls = 0;
  const create = deferredHandlerFactory(() => new Promise(done => { resolve = done; }), "create", ["write"]);
  const pending = create({ auth }).write();
  advanceAuthSession(auth, auth.currentUser);
  resolve({ create: () => ({ write: () => { calls++; } }) });
  assert.equal(await pending, null);
  assert.equal(calls, 0);
});

test("library lazy-module failure publishes loading then error and a new attempt can become ready", async () => {
  const fixture = libraryWrapperFixture();
  const gate = deferred();
  const calls = [];
  const wrapped = createTrainerLibraryLoadHandler(fixture.context, async (...args) => {
    calls.push(args);
    if (calls.length === 1) await gate.promise;
    fixture.ready();
    return "loaded";
  });
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const first = wrapped("first");
    assert.equal(fixture.values.state.templates, "loading");
    assert.equal(fixture.values.state.cards, "loading");
    assert.equal(fixture.values.state.templatesKnown, false);
    assert.equal(fixture.values.state.cardsKnown, false);
    gate.reject(new Error("Failed to fetch dynamically imported module"));
    assert.equal(await first, null);
    assert.equal(fixture.values.state.templates, "error");
    assert.equal(fixture.values.state.cards, "error");
    assert.equal(fixture.values.state.templatesKnown, false);
    assert.equal(fixture.values.state.cardsKnown, false);
    assert.ok(warnings.length > 0);

    assert.equal(await wrapped("retry"), "loaded");
    assert.deepEqual(calls, [["first"], ["retry"]]);
    assert.equal(fixture.values.state.templates, "ready");
    assert.equal(fixture.values.state.cards, "ready");
    assert.equal(fixture.values.state.templatesKnown, true);
    assert.equal(fixture.values.state.cardsKnown, true);
  } finally { console.warn = originalWarn; }
});

test("library wrapper preserves same-session knowledge but resets it after an auth transition and ignores old rejection", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    for (const nextUid of ["trainer", "other-trainer"]) {
      const fixture = libraryWrapperFixture(true);
      const old = deferred(), current = deferred();
      let calls = 0;
      const wrapped = createTrainerLibraryLoadHandler(fixture.context, async () => {
        await (++calls === 1 ? old.promise : current.promise);
        fixture.ready();
        return "current";
      });
      const oldRequest = wrapped();
      assert.equal(fixture.values.state.templatesKnown, true);
      assert.equal(fixture.values.state.cardsKnown, true);
      if (nextUid !== "trainer") fixture.auth.currentUser = { uid: nextUid };
      advanceAuthSession(fixture.auth, fixture.auth.currentUser);
      const currentRequest = wrapped();
      assert.equal(fixture.values.state.templates, "loading");
      assert.equal(fixture.values.state.cards, "loading");
      assert.equal(fixture.values.state.templatesKnown, false);
      assert.equal(fixture.values.state.cardsKnown, false);
      assert.equal(fixture.values.state.session.uid, nextUid);
      assert.equal(fixture.values.state.session.isCurrent(), true);
      current.resolve();
      assert.equal(await currentRequest, "current");
      const state = fixture.values.state;
      const transitionCount = fixture.values.transitions.length;
      old.reject(new Error("Old lazy module request failed"));
      assert.equal(await oldRequest, null);
      assert.equal(fixture.values.state, state);
      assert.equal(fixture.values.transitions.length, transitionCount);
      assert.equal(fixture.values.state.templates, "ready");
      assert.equal(fixture.values.state.cards, "ready");
    }
  } finally { console.warn = originalWarn; }
});

test("an older concurrent library rejection cannot replace a newer loading token or ready result", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    for (const resolveCurrentFirst of [false, true]) {
      const fixture = libraryWrapperFixture(true);
      const old = deferred(), current = deferred();
      let calls = 0;
      const wrapped = createTrainerLibraryLoadHandler(fixture.context, async () => {
        await (++calls === 1 ? old.promise : current.promise);
        fixture.ready();
        return "newer";
      });
      const oldRequest = wrapped();
      const currentRequest = wrapped();
      assert.equal(fixture.values.state.templates, "loading");
      assert.equal(fixture.values.state.cards, "loading");
      assert.equal(fixture.values.state.templatesKnown, true);
      assert.equal(fixture.values.state.cardsKnown, true);
      if (resolveCurrentFirst) { current.resolve(); assert.equal(await currentRequest, "newer"); }
      const state = fixture.values.state;
      const transitionCount = fixture.values.transitions.length;
      old.reject(new Error("Superseded module request failed"));
      assert.equal(await oldRequest, null);
      assert.equal(fixture.values.state, state);
      assert.equal(fixture.values.transitions.length, transitionCount);
      if (!resolveCurrentFirst) { current.resolve(); assert.equal(await currentRequest, "newer"); }
      assert.equal(fixture.values.state.templates, "ready");
      assert.equal(fixture.values.state.cards, "ready");
      assert.equal(fixture.values.state.templatesKnown, true);
      assert.equal(fixture.values.state.cardsKnown, true);
    }
  } finally { console.warn = originalWarn; }
});
