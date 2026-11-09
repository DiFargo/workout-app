import AccessDeniedScreen from "../../../components/common/AccessDeniedScreen.jsx";
import { useBasicWorkoutAccess } from "./basicWorkoutAccess.js";
import RouteFallback from "../../../app/RouteFallback.jsx";

export default function BasicWorkoutAccessBoundary({ children, onBack, renderBottomBar }) {
  const { allowed, loading } = useBasicWorkoutAccess();
  if (loading) return <RouteFallback title="Проверяем доступ к тренировкам" activeTab="workouts" renderBottomBar={renderBottomBar} />;
  if (!allowed) return <AccessDeniedScreen message="Базовые тренировки доступны после разрешения администратора. Индивидуальный план и история сохранены." backLabel="← К тренировкам" onBack={onBack} />;
  return children;
}
