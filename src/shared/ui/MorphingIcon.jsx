import { MorphIcon } from "morphicons/react";

function normalizeLucideIconData(icon) {
  if (Array.isArray(icon) && icon[0] === "svg" && Array.isArray(icon[2])) {
    return icon[2];
  }
  return icon;
}

export default function MorphingIcon({ icon, spring = "snappy", ...props }) {
  return (
    <MorphIcon
      icon={normalizeLucideIconData(icon)}
      spring={spring}
      reducedMotion="user"
      data-morphing-icon="true"
      {...props}
    />
  );
}
