import { useRef, useState } from "react";
import ProfileSettingsModal from "../../features/client/profile/ProfileSettingsModal";
import ProfileBodyMetricsSettingsSection from "../../features/client/profile/ProfileBodyMetricsSettingsSection";
import ProfileAppSettingsSection from "../../features/client/profile/ProfileAppSettingsSection";
import ProfileNotificationSettingsSection from "../../features/client/profile/ProfileNotificationSettingsSection";
import ProfileNutritionModal from "../../features/client/profile/ProfileNutritionModal";
import { calculateAiNutritionMacros, calculatePersonalAiNutritionCalories } from "../../utils/aiNutritionCalculations";

// Stateful, local-only callbacks exercise the real sheets without writing user data.
export default function ProfileSheetsE2EHarness({ section = "profile", failFirst = false, connected = true }) {
  const [activeSection, setActiveSection] = useState(section);
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState({ weight: 99, targetWeight: 98.8, height: 181, age: 35, sex: "female", goal: "recomp", activity: "medium" });
  const [notifications, setNotifications] = useState(true);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState("");
  const [week, setWeek] = useState(0);
  const attempts = useRef(0);
  const macros = calculateAiNutritionMacros(calculatePersonalAiNutritionCalories(draft), draft.weight, draft.goal);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(2026, 8, 7 + week * 7 + index, 12);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { key, date, dayNumber: date.getDate(), calories: index === 0 ? 1280 : 0, hasFood: index === 0, isToday: week === 0 && index === 0, isSelected: week === 0 && index === 0 };
  });
  function save() {
    attempts.current += 1;
    if (failFirst && attempts.current === 1) return false;
    setResult(JSON.stringify(draft));
    return true;
  }
  return <>
    <output data-testid="profile-sheets-result">{result}</output>
    <ProfileSettingsModal open={open && section !== "nutrition"} section={activeSection} onClose={() => setOpen(false)}>
      {section === "profile" ? <ProfileBodyMetricsSettingsSection
        draft={draft} onDraftChange={(key, value) => setDraft(current => ({ ...current, [key]: value }))}
        onSave={save} onSaved={() => setOpen(false)}
      /> : activeSection === "settings" ? <ProfileNotificationSettingsSection
        telegramProfile={{ connected, notificationsEnabled: notifications }}
        onOpenConnections={() => setActiveSection("connections")}
        onToggleNotifications={async enabled => {
          attempts.current += 1;
          await new Promise(resolve => setTimeout(resolve, 250));
          if (failFirst && attempts.current === 1) return false;
          setNotifications(enabled);
          setResult(JSON.stringify({ notificationsEnabled: enabled }));
          return true;
        }}
      /> : <ProfileAppSettingsSection
        email="test@invite.tren-85720.app" telegramProfile={{ connected, username: "telegram" }}
        onOpenEmail={() => setResult("email")} onOpenTelegram={() => setResult("telegram")}
      />}
    </ProfileSettingsModal>
    <ProfileNutritionModal
      open={open && section === "nutrition"} profileDraft={draft} activeProfile={draft}
      draftMacros={macros} nutritionGoals={macros} saveStatus={status}
      weekLabel={`${weekDays[0].dayNumber}–${weekDays[6].dayNumber} сентября`} weekDays={weekDays}
      aiPlan={null} aiWeek={macros} aiActiveProfile={draft} selectedTotals={{ calories: 1280 }}
      onClose={() => setOpen(false)} onGoalChange={goal => setDraft(current => ({ ...current, goal }))}
      onSave={() => setStatus(save() ? "saved" : "error")} onShiftWeek={shift => setWeek(current => current + shift)}
      onSuccessAcknowledged={() => setOpen(false)}
    />
  </>;
}
