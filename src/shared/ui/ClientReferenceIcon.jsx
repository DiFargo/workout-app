// Vector paths from the user's approved Mint / Night Glass HTML reference.
// Kept client-only so trainer/admin iconography is unchanged.
const paths = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
  dumbbell: <path d="m6.5 6.5 11 11M4 9l5-5M15 20l5-5M2.5 6.5l4-4M17.5 21.5l4-4M8 11l3-3M13 16l3-3" />,
  food: <path d="M5 3v6c0 3 6 3 6 0V3M8 3v18M18 3c-4 4-4 9 0 9h1V3Zm1 9v9" />,
  chart: <path d="M4 20V10M11 20V4M18 20v-7" />,
  user: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 9h18c0-1-3-1-3-9M10 21h4" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  camera: <><path d="M3 7h4l2-3h6l2 3h4v13H3Z" /><circle cx="12" cy="13" r="4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v5M17 3v5M3 11h18M8 15h1M15 15h1" /></>,
  plus: <path d="M12 4v16M4 12h16" />,
  mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3" /></>,
  trophy: <path d="M8 3h8v7a4 4 0 0 1-8 0Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 14v6M8 21h8" />,
  message: <path d="M21 4H3v14h5l4 4v-4h9Z" />,
  settings: <><path d="M4 6h16M4 18h16" /><circle cx="8" cy="6" r="3" fill="var(--apple-surface)" /><circle cx="16" cy="18" r="3" fill="var(--apple-surface)" /></>,
  shield: <><path d="m12 2 8 4v7c0 5-8 9-8 9S4 18 4 13V6Z" /><path d="m8 12 3 3 5-6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 10v7m0-10v.1" /></>,
  ruler: <path d="m3 16 13-13 5 5L8 21ZM7 12l2 2m2-6 2 2m2-6 2 2" />
};

export default function ClientReferenceIcon({ name, size = 22, strokeWidth = 1.7, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.info}</svg>;
}

export const ArrowRight = props => <ClientReferenceIcon name="arrow" {...props} />;
export const Bell = props => <ClientReferenceIcon name="bell" {...props} />;
export const CalendarDays = props => <ClientReferenceIcon name="calendar" {...props} />;
export const Camera = props => <ClientReferenceIcon name="camera" {...props} />;
export const ChartNoAxesColumnIncreasing = props => <ClientReferenceIcon name="chart" {...props} />;
export const Check = props => <ClientReferenceIcon name="check" {...props} />;
export const ChevronRight = props => <ClientReferenceIcon name="chevron" {...props} />;
export const Dumbbell = props => <ClientReferenceIcon name="dumbbell" {...props} />;
export const Info = props => <ClientReferenceIcon name="info" {...props} />;
export const MessageCircle = props => <ClientReferenceIcon name="message" {...props} />;
export const Mic = props => <ClientReferenceIcon name="mic" {...props} />;
export const Plus = props => <ClientReferenceIcon name="plus" {...props} />;
export const Ruler = props => <ClientReferenceIcon name="ruler" {...props} />;
export const Settings2 = props => <ClientReferenceIcon name="settings" {...props} />;
export const ShieldCheck = props => <ClientReferenceIcon name="shield" {...props} />;
export const Trophy = props => <ClientReferenceIcon name="trophy" {...props} />;
