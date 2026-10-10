// A UID alone cannot distinguish a pending save from a previous login of the
// same account. Bootstrap advances this identity on every auth transition.
const sessions = new WeakMap();

export function advanceAuthSession(auth, user = auth?.currentUser || null) {
  if (!auth) return null;
  const session = { user, uid: user?.uid || "" };
  sessions.set(auth, session);
  return session;
}

export function captureAuthSession(auth) {
  const user = auth?.currentUser || null;
  let session = auth && sessions.get(auth);
  if (auth && (!session || session.user !== user)) {
    session = advanceAuthSession(auth, user);
  }

  return {
    uid: session?.uid || "",
    isCurrent: () => Boolean(session?.uid)
      && auth?.currentUser === session.user
      && sessions.get(auth) === session
  };
}
