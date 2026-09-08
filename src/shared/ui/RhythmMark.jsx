import styles from "./RhythmMark.module.css";

/** Quiet, decorative signature. It does not replace a control or a status. */
export default function RhythmMark() {
  return <span className={styles.root} data-rhythm-mark aria-hidden="true"><i /><i /><i /><i /><i /></span>;
}
