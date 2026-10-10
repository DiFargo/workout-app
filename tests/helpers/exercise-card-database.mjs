export function exerciseCardDatabase(seed = {}) {
  const documents = new Map(Object.entries(structuredClone(seed)));
  const writes = [];
  function reference(path) {
    return { path, id: path.split("/").at(-1),
      async get() { return { id: this.id, exists: documents.has(path), data: () => structuredClone(documents.get(path)) }; },
      collection(name) { return collection(`${path}/${name}`); }
    };
  }
  function collection(path, filter = () => true) {
    return { doc: id => reference(`${path}/${id}`),
      where(field, operation, value) {
        if (operation !== "==") throw Error("Unsupported test query");
        return collection(path, item => filter(item) && item[field] === value);
      },
      async get() { return { docs: await Promise.all([...documents].filter(([key, value]) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/") && filter(value)).map(([key]) => reference(key).get())) }; }
    };
  }
  return { documents, writes, collection,
    async runTransaction(callback) {
      const pending = [];
      const result = await callback({ get: ref => ref.get(), set: (ref, data) => pending.push([ref.path, structuredClone(data)]) });
      for (const [path, data] of pending) { documents.set(path, data); writes.push(path); }
      return result;
    }
  };
}
