import { isTrainerV2Path } from "../../app/cssVariant";

// Keep the original trainer surface intact while V2 progressively reveals tools.
export default function TrainerClientDisclosure({ title, children, className = "" }) {
  if (!isTrainerV2Path(window.location.pathname)) return children;
  return (
    <details className={`trainerClientDisclosure ${className}`}>
      <summary>{title}<span aria-hidden="true">⌄</span></summary>
      <div>{children}</div>
    </details>
  );
}

export function TrainerClientColumn({ children }) {
  return isTrainerV2Path(window.location.pathname)
    ? <div className="trainerClientMainColumn">{children}</div>
    : children;
}
