import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') throw new Error('This export command targets Windows.');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const personal = resolve(process.argv[2] || join(homedir(), '.codex', 'skills'));
const names = [
  'composition-patterns', 'design-critique', 'emil-design-eng',
  'firebase-auth-basics', 'firebase-firestore',
  'firebase-security-rules-auditor', 'firestore-rules-creation',
  'playwright', 'react-best-practices', 'security-best-practices',
  'security-threat-model', 'web-design-guidelines'
];
const roots = [
  { name: 'ui-ux-pro-max', path: join(repo, '.agents', 'skills', 'ui-ux-pro-max') },
  ...names.map(name => ({ name, path: join(personal, name) }))
];
const items = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const privateName = /^(?:auth\.json|config\.toml|credentials.*|service[-_]?account.*|id_(?:rsa|ed25519|ecdsa|dsa).*|\.env(?:$|\.)|.*\.(?:local|pem|p12|pfx|key|sqlite|db|log)$)/i;

async function inspectTree(source, entryPrefix) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Links are not permitted: ${entryPrefix}`);
  if (info.isDirectory()) {
    for (const child of await readdir(source, { withFileTypes: true })) {
      if (['.git', '__pycache__', 'node_modules'].includes(child.name) || child.name.endsWith('.pyc')) continue;
      if (privateName.test(child.name)) throw new Error(`Unexpected private/config file: ${entryPrefix}/${child.name}`);
      await inspectTree(join(source, child.name), `${entryPrefix}/${child.name}`);
    }
  } else if (info.isFile()) {
    items.push({ source, entry: entryPrefix });
  } else {
    throw new Error(`Unsupported file type: ${entryPrefix}`);
  }
}

// Only these 13 skill trees are eligible. Never traverse the Codex home itself.
for (const root of roots) {
  await readFile(join(root.path, 'SKILL.md'), 'utf8');
  await inspectTree(root.path, `.agents/skills/${root.name}`);
}
items.push({ source: join(repo, 'docs', 'codex-team-setup.md'), entry: 'docs/codex-team-setup.md' });
items.sort((a, b) => a.entry.localeCompare(b.entry));

const out = join(repo, 'output', 'codex-team');
await mkdir(out, { recursive: true });
const bundle = await mkdtemp(join(out, 'codex-team-kit-'));
const files = [];
for (const item of items) {
  const sourceBytes = await readFile(item.source);
  if (/-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----(?:\r?\n|\\n)[A-Za-z0-9+/=]{32,}/.test(sourceBytes.toString('utf8'))) {
    throw new Error(`Private key material detected: ${item.entry}`);
  }
  const target = join(bundle, ...item.entry.split('/'));
  await mkdir(dirname(target), { recursive: true });
  await copyFile(item.source, target);
  const bytes = await readFile(target);
  files.push({ path: item.entry, sha256: hash(bytes), bytes: bytes.length });
}
await writeFile(join(bundle, 'manifest.json'), JSON.stringify({
  format: 1,
  createdAtUtc: new Date().toISOString(),
  scope: 'Shared skill snapshots and setup instructions only; no application source, account configuration or credentials.',
  skills: roots.map(root => root.name),
  files
}, null, 2) + '\n');

// Archive only the new staging folder. No profile or execution-policy changes.
const zipPath = `${bundle}.zip`;
const quote = value => `'${value.replaceAll("'", "''")}'`;
execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
  'Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
  `$base=${quote(bundle)}; $zip=[IO.Compression.ZipFile]::Open(${quote(zipPath)}, 'Create'); ` +
  'try { Get-ChildItem -LiteralPath $base -Force -Recurse -File | ForEach-Object { ' +
  "$entry=$_.FullName.Substring($base.Length+1).Replace('\\','/'); " +
  '[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$_.FullName,$entry) | Out-Null ' +
  '} } finally { $zip.Dispose() }'
], { windowsHide: true, stdio: 'pipe' });
const archive = await readFile(zipPath);
console.log(JSON.stringify({ path: zipPath, skills: roots.length, files: files.length, sha256: hash(archive), bytes: archive.length }, null, 2));
