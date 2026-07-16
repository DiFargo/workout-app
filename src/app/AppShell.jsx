export default function AppShell({ children, primaryNavigation = null }) {
  return (
    <>
      {children}
      {primaryNavigation}
    </>
  );
}
