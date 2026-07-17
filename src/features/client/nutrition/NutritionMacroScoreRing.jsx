import styles from "./NutritionMacroScoreRing.module.css";

export default function NutritionMacroScoreRing({ score, segments }) {
  return (
    <svg
      className={styles.root}
      viewBox="0 0 42 42"
      role="img"
      aria-label={`Оценка питания: ${score}`}
    >
      <circle className={styles.track} cx="21" cy="21" r="15.9155" pathLength="100" />
      {segments.map(({ id, offset, value }) => (
        <circle
          key={id}
          className={`${styles.segment} ${styles[id]}`}
          cx="21"
          cy="21"
          r="15.9155"
          pathLength="100"
          strokeDasharray={`${value} ${100 - value}`}
          strokeDashoffset={-offset}
        />
      ))}
      <circle className={styles.center} cx="21" cy="21" r="10.2" />
      <text className={styles.value} x="21" y="22" textAnchor="middle">{score}</text>
    </svg>
  );
}
