// Standalone invitation pages are rendered before the React application's CSS loads.
export const INVITE_PAGE_STYLES = `
:root{color-scheme:light;--canvas:#f2f2f7;--surface:#fff;--text:#1c1c1e;--secondary:#636366;--line:rgba(60,60,67,.12);--accent:#3c6faa;--action:#3f73b8;--tint:#edf2f9}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;background:var(--canvas);color:var(--text);font:16px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif;padding:max(24px,env(safe-area-inset-top)) 20px max(24px,env(safe-area-inset-bottom))}
.card{width:min(100%,430px);padding:28px 24px;border-radius:28px;background:var(--surface)}
.mark{width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:var(--tint);color:var(--accent);font-size:24px;font-weight:700}
.eyebrow{margin:24px 0 10px;color:var(--secondary);font-size:12px;font-weight:600;letter-spacing:.04em}
h1{margin:0;font-size:30px;line-height:1.12;letter-spacing:-.035em;font-weight:700}
p{margin:14px 0 0;color:var(--secondary);line-height:1.5}
.email{color:var(--text);font-weight:600;overflow-wrap:anywhere}
label{display:block;margin-top:22px;font-size:15px;font-weight:600}
input{width:100%;min-height:52px;margin-top:8px;padding:13px 14px;border:1px solid var(--line);border-radius:14px;background:var(--canvas);color:var(--text);font-family:inherit;font-size:17px;line-height:1.4;outline:none}
input::placeholder{color:var(--secondary);opacity:1}
input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--tint)}
button,.login-link{width:100%;min-height:52px;margin-top:24px;padding:14px 16px;border:0;border-radius:16px;background:var(--action);color:#fff;font:600 17px/1.4 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;cursor:pointer;text-align:center;text-decoration:none;touch-action:manipulation}
button:active,.login-link:active{background:#3565a3}
button:focus-visible,.login-link:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
button:disabled{opacity:.6;cursor:wait}
.login-link{display:none}.login-link.show,.notice .login-link{display:block}
.hint{margin-top:18px;font-size:13px;line-height:1.5}
.status{display:none;margin-top:18px;padding:14px;border-radius:14px;background:var(--tint);color:var(--accent);font-size:14px;line-height:1.5}
.status.error{background:#fff0ee;color:#b32e28}.status.show,.notice .status{display:block}
@media(max-width:360px){body{padding-inline:16px}.card{padding:24px 18px}h1{font-size:28px}}
@media(max-height:700px){body{place-items:start center;padding-block:16px}}
`;

export function formatInviteAccountLabel({ login, email }) {
  if (!login) return String(email || "");
  const label = String(login);
  return `Логин: ${label.charAt(0).toLocaleUpperCase("ru-RU")}${label.slice(1)}`;
}
