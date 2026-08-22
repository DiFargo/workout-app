import FoodProductPage from "./FoodProductPage";
import FoodSearchHeader from "./FoodSearchHeader";
import FoodSearchPage from "./FoodSearchPage";
import NutritionBarcodeOverlay from "./NutritionBarcodeOverlay";
import styles from "./FoodSearchOverlay.module.css";

export function FoodSearchSurface({
  children,
  layout = "fixture",
  overlayTestId,
  screenTestId,
  dialog = false,
  ariaLabel,
  onDismiss
}) {
  const hasHeaderLayout = layout === "search" || layout === "my-products";

  return (
    <div
      className={`${styles.searchOverlay} ${hasHeaderLayout ? "" : styles.fixtureOverlay}`}
      data-css-module-scope="food-search-overlay"
      data-testid={overlayTestId}
    >
      {dialog && onDismiss ? (
        <button
          type="button"
          className={styles.backdrop}
          onClick={onDismiss}
          aria-label="Закрыть поиск еды по фону"
          data-food-search-action="dismiss-backdrop"
        />
      ) : null}
      <section
        className={[
          styles.searchScreen,
          hasHeaderLayout ? styles.headerLayout : styles.fixtureLayout,
          layout === "my-products" ? styles.myProductsLayout : "",
          layout === "search" ? styles.searchLayout : "",
          dialog ? styles.modalLayout : ""
        ].filter(Boolean).join(" ")}
        data-food-search-header-layout={hasHeaderLayout ? layout : undefined}
        data-testid={screenTestId}
        role={dialog ? "dialog" : undefined}
        aria-modal={dialog ? "true" : undefined}
        data-modal-surface={dialog ? "true" : undefined}
        aria-label={ariaLabel}
      >
        {dialog ? <div className={styles.grabber} aria-hidden="true" data-food-search-grabber /> : null}
        {children}
      </section>
    </div>
  );
}

export default function FoodSearchOverlay({
  open,
  selectedFood,
  headerProps,
  productProps,
  searchProps,
  barcodeOpen
}) {
  if (!open) {
    return null;
  }

  const headerLayout = selectedFood
    ? null
    : headerProps?.searchTab === "my"
      ? "my-products"
      : "search";

  if (!selectedFood) {
    return (
      <FoodSearchSurface
        layout={headerLayout}
        overlayTestId="food-search-overlay"
        screenTestId="food-search-screen"
        dialog
        ariaLabel="Поиск еды"
        onDismiss={headerProps?.onClose}
      >
        <FoodSearchHeader {...headerProps} />
        <FoodSearchPage {...searchProps} modal />
        <NutritionBarcodeOverlay open={barcodeOpen} />
      </FoodSearchSurface>
    );
  }

  return (
    <div
      className={styles.productOverlay}
      data-css-module-scope="food-product-overlay"
      data-food-product-open="true"
      data-testid="food-search-overlay"
    >
      <section
        className={styles.productLayout}
        data-food-product-open="true"
        data-testid="food-search-screen"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-label="Поиск еды"
      >
        <FoodSearchHeader {...headerProps} />
        <FoodProductPage {...productProps} />
        <NutritionBarcodeOverlay open={barcodeOpen} />
      </section>
    </div>
  );
}
