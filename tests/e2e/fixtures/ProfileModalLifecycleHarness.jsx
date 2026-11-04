import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ProfileEmailModal from "../../../src/features/client/profile/ProfileEmailModal";
import ProfilePasswordModal from "../../../src/features/client/profile/ProfilePasswordModal";
import ProfileQuickWeightModal from "../../../src/features/client/profile/ProfileQuickWeightModal";
import ProfileTelegramModal from "../../../src/features/client/profile/ProfileTelegramModal";
import { useProfileTelegramEffects } from "../../../src/features/client/profile/useProfileTelegramEffects";
import NutritionVoiceModal from "../../../src/features/client/nutrition/NutritionVoiceModal";
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

const voiceItems = [{ id: "review-one", name: "Йогурт", amount: 100, calories: 60, protein: 4, fat: 2, carbs: 6, kind: "review" }];

function TelegramFixture({ open, onClose }) {
  const [profile, setProfile] = useState({ connected: false });
  const [code, setCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [status, setStatus] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [checks, setChecks] = useState(0);
  const [opens, setOpens] = useState(0);
  const busy = useRef(false);
  const refresh = async () => {
    if (busy.current) return false;
    busy.current = true;
    setLinking(true);
    setChecks(value => value + 1);
    await new Promise(resolve => setTimeout(resolve, 120));
    const accepted = Boolean(window.__telegramBotLinkAccepted);
    if (accepted) {
      setProfile({ connected: true, username: "fixture_user", displayName: "Тестовый профиль", connectedAt: `confirmed-${code}` });
      setCode("");
      setStatus("Telegram подключён.");
    } else setStatus("Подключение пока не подтверждено. Нажми Start в боте и проверь ещё раз.");
    busy.current = false;
    setLinking(false);
    return accepted;
  };
  const start = async () => {
    if (busy.current) return;
    busy.current = true;
    setLinking(true);
    setStatus("");
    const attempt = attempts + 1;
    setAttempts(attempt);
    await new Promise(resolve => setTimeout(resolve, 120));
    if (new URLSearchParams(location.search).get("telegramFailFirst") === "1" && attempt === 1) {
      setStatus("Не удалось создать ссылку. Попробуй ещё раз.");
    } else {
      setCode(`fixture_link_${attempt}`);
      setStatus("Ссылка готова. Открой бота и нажми Start.");
    }
    busy.current = false;
    setLinking(false);
  };
  useProfileTelegramEffects({
    APP_PAGES: { PROFILE: "profile" }, telegramConnectOpen: open, telegramLinkCode: code,
    handleTelegramLoginAuth: async () => false, refreshTelegramConnection: refresh,
    setPage: () => {}, setTelegramConnectOpen: value => { if (!value) onClose(); }, setTelegramStatus: setStatus
  });
  return <>
    <output hidden data-testid="profile-telegram-fixture-state" data-attempts={attempts} data-checks={checks} data-opens={opens} />
    <ProfileTelegramModal open={open} telegramProfile={profile} botLinkUrl={code ? `https://t.me/zmena_teleg_bot?start=${code}` : ""}
      linking={linking} status={status} onClose={onClose} onStartLink={start} onCheckLogin={refresh}
      onOpenBotLink={event => { event.preventDefault(); setOpens(value => value + 1); window.Telegram?.WebApp?.openTelegramLink?.(event.currentTarget.href); }}
      onChangeTelegram={() => { setCode(""); setStatus(""); }}
      onCancelChange={() => { setCode(""); setStatus(""); }}
      onDisconnect={async () => { setCode(""); setStatus("Telegram отключён."); setProfile({ connected: false }); return true; }} />
  </>;
}

export default function Harness() {
  useModalFocusTrap();
  const [modal, setModal] = useState("");
  const [email, setEmail] = useState("first@example.test");
  const close = () => setModal("");
  return <main>
    {["email", "password", "weight", "voice", "telegram"].map(name => <button key={name} type="button" onClick={() => setModal(name)}>Открыть {name}</button>)}
    <button type="button" onClick={() => setEmail("updated@example.test")}>Обновить email профиля</button>
    <ProfileEmailModal open={modal === "email"} email={email} onClose={close} onRequestEmailChange={async () => false} />
    <ProfilePasswordModal open={modal === "password"} onClose={close} onChangePassword={async () => false} />
    <ProfileQuickWeightModal open={modal === "weight"} onClose={close} onSave={async () => false} />
    <NutritionVoiceModal open={modal === "voice"} voiceState="idle" voiceAddedItems={voiceItems} onClose={close} onVoiceEnd={() => {}} />
    <TelegramFixture open={modal === "telegram"} onClose={close} />
  </main>;
}
createRoot(document.getElementById("root")).render(<Harness />);
