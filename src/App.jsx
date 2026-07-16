import AppCore from "./AppCore";
import AppErrorBoundary from "./components/common/AppErrorBoundary";

export default function App() {
  return (
    <AppErrorBoundary>
      <AppCore />
    </AppErrorBoundary>
  );
}
