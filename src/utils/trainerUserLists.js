export function normalizeTrainerClientRecord(item = {}) {
  return {
    ...item,
    role: item.role || "client"
  };
}

export function buildTrainerUserLists(items = [], options = {}) {
  const isAdmin = Boolean(options.isAdmin);
  const adminEmail = String(options.adminEmail || "").toLowerCase();
  const uniqueUsers = new Map();

  items.forEach((item) => {
    if (!item?.id) return;
    uniqueUsers.set(item.id, normalizeTrainerClientRecord(item));
  });

  const users = [...uniqueUsers.values()].sort((a, b) =>
    String(a.name || a.email || "").localeCompare(String(b.name || b.email || ""), "ru")
  );
  const clients = users.filter((item) => {
    const role = item.role || "client";
    const email = String(item.email || "").toLowerCase();
    if (email === adminEmail) return false;
    return isAdmin
      ? ["client", "trainer"].includes(role)
      : role === "client";
  });

  return { users, clients };
}
