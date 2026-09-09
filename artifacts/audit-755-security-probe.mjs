import fs from 'node:fs/promises';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-workout-audit',
  firestore: {
    host: '127.0.0.1', port: 8080,
    rules: await fs.readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  },
});
try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/audit-client'), { role: 'client', active: true });
    await setDoc(doc(db, 'users/audit-client/trainerTasks/task'), { title: 'Trainer task', status: 'open' });
  });
  const db = env.authenticatedContext('audit-client').firestore();
  const probes = [
    ['client creates own payment', () => setDoc(doc(db, 'users/audit-client/payments/payment'), { amount: 999, status: 'paid' })],
    ['client changes trainer task title', () => updateDoc(doc(db, 'users/audit-client/trainerTasks/task'), { title: 'Changed by client' })],
    ['client deletes trainer task', () => deleteDoc(doc(db, 'users/audit-client/trainerTasks/task'))],
    ['client creates arbitrary subcollection', () => setDoc(doc(db, 'users/audit-client/serverOnly/probe'), { forged: true })],
  ];
  for (const [name, run] of probes) {
    try { await run(); console.log(JSON.stringify({ name, allowed: true })); }
    catch (error) { console.log(JSON.stringify({ name, allowed: false, code: error.code })); }
  }
} finally {
  await env.cleanup();
}
