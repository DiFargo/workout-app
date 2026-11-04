function telegramContextData(hostWindow) {
  const sdkData = hostWindow?.Telegram?.WebApp?.initData;
  if (typeof sdkData === "string" && sdkData.trim()) return sdkData.trim();
  const hash = String(hostWindow?.location?.hash || "").replace(/^#/, "");
  return new URLSearchParams(hash).get("tgWebAppData")?.trim() || "";
}

function telegramUserId(initData) {
  try {
    const user = JSON.parse(new URLSearchParams(initData).get("user") || "null");
    const id = user?.id;
    if (typeof id !== "number" && (typeof id !== "string" || !/^[1-9]\d*$/.test(id))) return "";
    const numericId = Number(id);
    return Number.isSafeInteger(numericId) && numericId > 0 ? String(numericId) : "";
  } catch {
    return "";
  }
}

export async function acquireTelegramAppInstance(hostWindow = window) {
  const unsupported = () => ({ status: "unsupported", release() {} });
  let initData;
  let locks;
  let userId;
  try {
    initData = telegramContextData(hostWindow);
    if (!initData) return { status: "browser", release() {} };
    userId = telegramUserId(initData);
    locks = hostWindow?.navigator?.locks;
    if (!userId || typeof locks?.request !== "function") return unsupported();
  } catch {
    return unsupported();
  }

  return new Promise(resolve => {
    let settled = false;
    let released = false;
    let unlock;
    const finish = status => {
      if (settled) return;
      settled = true;
      resolve({ status, release });
    };
    const release = () => {
      if (released) return;
      released = true;
      hostWindow.removeEventListener?.("pagehide", onPageHide);
      unlock?.();
    };
    const onPageHide = event => {
      // A BFCache snapshot may resume an in-progress workout. Do not
      // deliberately surrender its ownership merely because it was cached.
      if (event?.persisted !== true) release();
    };
    try {
      // Unverified Telegram user data is only an origin-local lock namespace,
      // never an authentication or account-access decision.
      const request = locks.request(`workout:telegram:instance:v1:${userId}`, {
        mode: "exclusive", ifAvailable: true
      }, lock => {
        if (lock === null) { finish("duplicate"); return; }
        if (!lock) { finish("unsupported"); return; }
        return new Promise(complete => {
          unlock = complete;
          hostWindow.addEventListener?.("pagehide", onPageHide);
          finish("primary");
        });
      });
      Promise.resolve(request).then(() => {
        if (!settled) finish("unsupported");
      }, () => {
        release();
        finish("unsupported");
      });
    } catch {
      release();
      finish("unsupported");
    }
  });
}
