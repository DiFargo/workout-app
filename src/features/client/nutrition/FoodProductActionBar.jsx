import BottomActionBar from "../../../shared/ui/BottomActionBar";
import styles from "./FoodProductActionBar.module.css";

export default function FoodProductActionBar({
  hidden,
  onBack,
  onAdd
}) {
  return (
    <BottomActionBar
      hidden={hidden}
      ariaLabel="Действия с продуктом"
      scope="food-product-action-bar"
      testId="food-product-action-bar"
      className={styles.root}
      buttonClassName={styles.button}
      activeClassName={styles.add}
      items={[
        { id: "back", label: "Назад к поиску", icon: "←", onClick: onBack },
        { id: "add", label: "Добавить", icon: "✓", active: true, onClick: onAdd }
      ]}
    />
  );
}
