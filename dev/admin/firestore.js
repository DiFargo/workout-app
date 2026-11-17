import { localRequest } from "./apiClient.js";

export const collection = (parent, ...parts) => ({ path: [parent.path, ...parts].filter(Boolean).join("/") });
export const doc = (parent, ...parts) => {
  const id = parts.at(-1) || `local-${crypto.randomUUID()}`;
  return { path: [parent.path, ...(parts.length ? parts : [id])].filter(Boolean).join("/"), id };
};
export const serverTimestamp = () => new Date().toISOString();
export const getDocs = async ref => {
  const result = await localRequest("/__preview/firestore/read", { path: ref.path });
  const docs = result.docs.map(item => ({ id: item.id, data: () => structuredClone(item.data) }));
  return { docs, forEach: fn => docs.forEach(fn) };
};
export const setDoc = (ref, data, options = {}) => localRequest("/__preview/firestore/write", { writes: [{ path: ref.path, data, merge: Boolean(options.merge) }] });
export const writeBatch = () => {
  const writes = [];
  return {
    set: (ref, data, options = {}) => writes.push({ path: ref.path, data, merge: Boolean(options.merge) }),
    commit: () => localRequest("/__preview/firestore/write", { writes })
  };
};
