import FoodProductPage from "./FoodProductPage";
import FoodSearchHeader from "./FoodSearchHeader";
import FoodSearchPage from "./FoodSearchPage";
import NutritionBarcodeOverlay from "./NutritionBarcodeOverlay";
import styles from "./FoodSearchOverlay.module.css";
import { useEffect, useRef } from "react";

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
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!dialog || !hasHeaderLayout) return undefined;
    const overlay = overlayRef.current;
    const viewport = window.visualViewport;
    let fullHeight = window.innerHeight;
    let fullWidth = window.innerWidth;
    let frame = 0;
    const syncViewport = () => {
      if (window.innerWidth !== fullWidth) {
        fullWidth = window.innerWidth;
        fullHeight = window.innerHeight;
      }
      fullHeight = Math.max(fullHeight, window.innerHeight);
      const height = viewport?.height ?? window.innerHeight;
      const searchFocused = overlay.contains(document.activeElement)
        && document.activeElement?.matches('[data-css-module-control="food-search-input"]');
      const reduced = window.matchMedia("(any-pointer: coarse)").matches
        && (viewport?.scale ?? 1) === 1 && fullHeight - height > 120;
      // Keep the sheet stable when tapping a result while the keyboard closes.
      const keyboardOpen = reduced && (searchFocused || overlay.dataset.foodSearchKeyboard === "true");
      overlay.dataset.foodSearchKeyboard = String(Boolean(keyboardOpen));
      overlay.style.setProperty("--food-search-visible-height", `${height}px`);
      overlay.style.setProperty("--food-search-visible-top", `${viewport?.offsetTop ?? 0}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncViewport);
    };
    syncViewport();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    overlay.addEventListener("focusin", schedule);
    overlay.addEventListener("focusout", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      overlay.removeEventListener("focusin", schedule);
      overlay.removeEventListener("focusout", schedule);
    };
  }, [dialog, hasHeaderLayout]);

  return (
    <div
      ref={overlayRef}
      className={`${styles.searchOverlay} ${hasHeaderLayout ? "" : styles.fixtureOverlay}`}
      data-css-module-scope="food-search-overlay"
      data-modal-layer={dialog && onDismiss ? "true" : undefined}
      data-testid={overlayTestId}
    >
      {dialog && onDismiss ? (
        <button
          type="button"
          className={styles.backdrop} data-modal-backdrop="true"
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
  const searchScrollStateRef = useRef(null);

  useEffect(() => {
    if (!open) searchScrollStateRef.current = null;
  }, [open]);

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
        <FoodSearchPage {...searchProps} scrollStateRef={searchScrollStateRef} modal />
        <NutritionBarcodeOverlay open={barcodeOpen} />
      </FoodSearchSurface>
    );
  }

  return (
    <div
      className={styles.productOverlay}
      data-modal-backdrop="true"
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
