// Match actual project/host/bucket boundaries, not a project-name substring:
// tren-85720-staging is isolated from tren-85720 despite their shared prefix.
export function isKnownProductionReference(value, projectId = "tren-85720") {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return false;
  if (text === projectId) return true;
  let url;
  try { url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`); }
  catch { return false; } // The parameter's own URL/bucket validator handles syntax.
  const host = url.hostname.replace(/\.$/, "");
  const hosts = [`${projectId}.web.app`, `${projectId}.firebaseapp.com`,
    `${projectId}.firebasestorage.app`, `${projectId}.appspot.com`, `invite.${projectId}.app`,
    `${projectId}.firebasestorage.app.storage.googleapis.com`, `${projectId}.appspot.com.storage.googleapis.com`];
  if (hosts.some(target => host === target || host.endsWith(`.${target}`)) ||
    host.endsWith(`-${projectId}.cloudfunctions.net`)) return true;
  if (["storage.googleapis.com", "storage.cloud.google.com", "firebasestorage.googleapis.com"].includes(host)) {
    const segments = url.pathname.split("/").filter(Boolean).map(part => {
      try { return decodeURIComponent(part); } catch { return part; }
    });
    return segments.some(part => part === `${projectId}.firebasestorage.app` || part === `${projectId}.appspot.com`);
  }
  return false;
}
