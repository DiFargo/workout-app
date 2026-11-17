export function fetchAuthorizedWithTimeout(path, options = {}) {
  // Reject absolute URLs, protocol-relative URLs and unrelated local paths.
  if (!/^\/(?:api\/|__preview\/)[\w/-]+$/.test(path)) return Promise.reject(new Error("Only local preview requests are allowed"));
  return fetch(path, { ...options, method: "POST", credentials: "omit" });
}

export async function localRequest(path, payload = {}) {
  const response = await fetchAuthorizedWithTimeout(path, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "local_preview_request_failed");
  return result;
}
