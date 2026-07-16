import styles from "./TrainerAvatar.module.css";

function getInitials(client = {}) {
  return String(client.name || client.displayName || client.email || "К")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getAvatar(client = {}) {
  return client.avatarUrl || client.photoURL || client.telegramAvatarUrl || client.telegram?.avatarUrl || "";
}

export default function TrainerAvatar({ client, size = "medium" }) {
  const image = getAvatar(client);
  return (
    <span className={`${styles.avatar} ${styles[size] || styles.medium}`}>
      {image ? <img src={image} alt="" /> : getInitials(client)}
    </span>
  );
}
