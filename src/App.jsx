import AppErrorBoundary from "./components/common/AppErrorBoundary";
import AppCore from "./AppCore";

export default function App() {
  return (
    <AppErrorBoundary>
      <AppCore />
    </AppErrorBoundary>
  );
}
