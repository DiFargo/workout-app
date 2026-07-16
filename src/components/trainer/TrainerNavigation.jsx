import { useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Home,
  MoreHorizontal,
  User,
  Users,
  X
} from "lucide-react";
import Modal from "../../shared/ui/Modal";
import TrainerAvatar from "./TrainerAvatar";
import styles from "./TrainerNavigation.module.css";

const TRAINER_NAVIGATION = [
  { id: "dashboard", label: "Обзор", mobileLabel: "Дашборд", icon: Home, desktop: true, mobile: true },
  { id: "clients", label: "Клиенты", icon: Users, desktop: true, mobile: true },
  { id: "workouts", label: "Программы", icon: Dumbbell, desktop: true, overflow: true },
  { id: "analytics", label: "Аналитика", icon: BarChart3, desktop: true, overflow: true },
  { id: "notifications", label: "Уведомления", icon: Bell, desktop: true, overflow: true },
  { id: "more", label: "Кабинет", mobileLabel: "Ещё", icon: MoreHorizontal, desktop: true, mobile: true, overflow: true }
];

export default function TrainerNavigation({ activeSection, onNavigate, trainerName, trainerAvatar }) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const desktopItems = useMemo(() => TRAINER_NAVIGATION.filter((item) => item.desktop), []);
  const mobileItems = useMemo(() => TRAINER_NAVIGATION.filter((item) => item.mobile), []);
  const overflowItems = useMemo(() => TRAINER_NAVIGATION.filter((item) => item.overflow), []);
  const overflowIds = useMemo(() => new Set(overflowItems.map((item) => item.id)), [overflowItems]);

  const navigate = (section) => {
    setOverflowOpen(false);
    onNavigate(section);
  };

  const renderButton = (item, mobile = false) => {
    const Icon = item.id === "more" && !mobile ? User : item.icon;
    const active = activeSection === item.id || (mobile && item.id === "more" && overflowIds.has(activeSection));
    return (
      <button
        type="button"
        key={item.id}
        data-section={item.id}
        data-testid={mobile ? `trainer-nav-${item.id}` : `trainer-desktop-nav-${item.id}`}
        className={active ? styles.active : undefined}
        onClick={() => mobile && item.id === "more" ? setOverflowOpen(true) : navigate(item.id)}
        aria-current={active ? "page" : undefined}
      >
        <span className={styles.icon}>
          <Icon size={mobile ? 21 : 18} strokeWidth={1.8} />
          {item.badge ? <i>{item.badge}</i> : null}
        </span>
        <span>{mobile ? item.mobileLabel || item.label : item.label}</span>
      </button>
    );
  };

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.brand}><strong>T</strong><span>Tren</span></div>
        <nav>{desktopItems.map((item) => renderButton(item))}</nav>
        <button className={styles.trainer} type="button" onClick={() => navigate("more")}>
          <TrainerAvatar client={{ name: trainerName, avatarUrl: trainerAvatar }} size="small" />
          <span><small>Тренер</small><strong>{trainerName || "Тренер"}</strong></span>
          <ChevronDown size={16} />
        </button>
      </aside>

      <nav className={styles.mobileNav} aria-label="Разделы тренера">
        {mobileItems.map((item) => renderButton(item, true))}
      </nav>

      <Modal
        open={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        ariaLabel="Дополнительные разделы"
        portal={false}
        contentAs="aside"
        classNames={{ overlay: styles.drawerOverlay, backdrop: styles.drawerBackdrop, content: styles.drawer }}
      >
        <header>
          <div><span>МЕНЮ</span><h2>Ещё</h2></div>
          <button type="button" onClick={() => setOverflowOpen(false)} aria-label="Закрыть"><X size={18} /></button>
        </header>
        <nav>
          {overflowItems.map((item) => {
            const Icon = item.id === "more" ? User : item.icon;
            const active = activeSection === item.id;
            return (
              <button
                type="button"
                key={item.id}
                data-section={item.id}
                data-testid={`trainer-more-${item.id}`}
                className={active ? styles.active : undefined}
                aria-current={active ? "page" : undefined}
                onClick={() => navigate(item.id)}
              >
                <span><Icon size={20} />{item.badge ? <i>{item.badge}</i> : null}</span>
                <strong>{item.label}</strong>
                <ChevronRight size={17} />
              </button>
            );
          })}
        </nav>
      </Modal>
    </>
  );
}
