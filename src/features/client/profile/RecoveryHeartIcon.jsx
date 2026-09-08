/** Decorative recovery mark: three arrows following a heart-shaped cycle. */
export default function RecoveryHeartIcon({ size = 28, strokeWidth = 1.5, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...props}
    >
      <g fill="none">
        <path d="M5.4 16.3C3.3 14.3 2 12.3 2 9.6C2 6.5 4.4 4 7.5 4C9.5 4 10.9 5.3 12.3 7.1M11.7 3.8L12.3 7.1L9 6.6" />
        <path d="M14.3 5.8C16.1 4 18.3 3.7 20.2 5.1C22.4 6.7 22.9 9.3 21.9 12C21.2 13.9 19.8 15.6 18.3 17.2M18.9 13.9L18.3 17.2L21.6 16.6" />
        <path d="M16.6 18.9L12 23L6.6 18M9.9 18.5L6.6 18L7.1 21.3" />
      </g>
    </svg>
  );
}
