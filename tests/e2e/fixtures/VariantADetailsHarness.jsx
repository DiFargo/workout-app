import { createRoot } from "react-dom/client";
import { useState } from "react";
import ProfileEmailModal from "../../../src/features/client/profile/ProfileEmailModal";
import ProfilePasswordModal from "../../../src/features/client/profile/ProfilePasswordModal";
import ProfileTrainerNotificationsModal from "../../../src/features/client/profile/ProfileTrainerNotificationsModal";
import { useModalFocusTrap } from "../../../src/shared/hooks/useModalFocusTrap";
import clientIosThemeStyles from "../../../src/AppCoreClientIosTheme.module.css";
import "../../../src/styles/index.css";
import "../../../src/styles/_variables.css";
import "../../../src/shared/ui/ResponsiveModalLayer.module.css";
import "../../../src/AppCoreFoundation.module.css";
import "../../../src/AppCoreTheme.module.css";
import "../../../src/AppCoreSurface.module.css";
import "../../../src/AppCoreLayout.module.css";
import "../../../src/AppCoreClientFlow.module.css";
import "../../../src/AppCoreClientVisual.module.css";
import "../../../src/AppCoreClientAppleTheme.css";

document.documentElement.classList.add(clientIosThemeStyles.contract);
document.body.dataset.nativeAppUi = "true";

const message = "На следующей тренировке оставь один–два повтора в запасе. Если после разминки остаётся дискомфорт, напиши мне перед выполнением упражнения: вместе выберем подходящую замену. Не увеличивай рабочий вес, пока техника не станет уверенной.";
const tasks = [
  { id: "message", notificationType: "message", status: "progress", message },
  { id: "long-title", title: "Обновить фотографии прогресса спереди, сбоку и сзади при одинаковом освещении", status: "progress" }
];
const noop = () => {};
// Unsigned DEV-only token for SDK claim parsing; never sent to an API.
const customUser = {
  uid: "fixture-custom-session",
  async getIdToken() {
    const now = Math.floor(Date.now() / 1000);
    const encode = value => btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    return `${encode({ alg: "none" })}.${encode({ sub: this.uid, iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: "custom" } })}.fixture-only`;
  }
};

export default function Harness() {
  useModalFocusTrap();
  const kind = new URLSearchParams(location.search).get("case");
  const [inboxTasks, setInboxTasks] = useState([
    { id: "measure", title: "Сделать контрольный замер", dueDate: "2026-10-31", status: "progress", target: "measurements" },
    { id: "message", notificationType: "message", status: "progress", message },
    { id: "long", title: "Обновить фотографии прогресса спереди, сбоку и сзади при одинаковом освещении", status: "progress", target: "progressPhotos" },
    { id: "completed", title: "Сделать контрольный замер", dueDate: "2026-06-13", status: "completed", target: "measurements" },
    { id: "read", notificationType: "message", status: "completed", message: "Вижу новые замеры, отличная работа! Продолжай в своём ритме." }
  ]);
  return <main>
    {kind === "email" ? <ProfileEmailModal open authUser={customUser} email="fixture@telegram.tren-85720.app" onClose={noop} onRequestEmailChange={async () => false} /> : null}
    {kind === "password" ? <ProfilePasswordModal open canResetByEmail={false} onAddRecoveryEmail={noop} onClose={noop} onChangePassword={async () => false} /> : null}
    {kind === "notifications" ? <ProfileTrainerNotificationsModal open activeCount={2} tasks={tasks} getTaskDestination={() => ""} onClose={noop} onUpdateTask={noop} /> : null}
    {kind === "notificationsAudit" ? <ProfileTrainerNotificationsModal open tasks={inboxTasks} getTaskDestination={task => task.target || ""} onClose={noop} onOpenTask={noop}
      onUpdateTask={async (task, completed) => { setInboxTasks(current => current.map(item => item.id === task.id ? { ...item, status: completed ? "completed" : "progress", completedAt: "" } : item)); }} /> : null}
  </main>;
}

createRoot(document.getElementById("root")).render(<Harness />);
