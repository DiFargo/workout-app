// Body locking alone does not cover the independently scrolling client shell.
// Keep its position and stop scroll chaining, while allowing the top sheet to scroll.
export function guardModalScroll(dialog) {
  const frozen = [];
  for (const element of document.body.querySelectorAll("*")) {
    if (!(element instanceof HTMLElement) || dialog.contains(element)) continue;
    const style = getComputedStyle(element);
    if (!/(auto|scroll)/.test(`${style.overflowX} ${style.overflowY}`)) continue;
    if (element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth) continue;
    frozen.push({
      element,
      x: element.scrollLeft,
      y: element.scrollTop,
      overflow: ["overflow-x", "overflow-y"].map(property => ({
        property,
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property)
      }))
    });
    element.style.setProperty("overflow", "hidden", "important");
  }

  const canScroll = (target, dx, dy) => {
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const delta = horizontal ? dx : dy;
    for (let element = target; element instanceof Element; element = element.parentElement) {
      const style = getComputedStyle(element);
      const overflow = horizontal ? style.overflowX : style.overflowY;
      const position = horizontal ? element.scrollLeft : element.scrollTop;
      const maximum = horizontal
        ? element.scrollWidth - element.clientWidth
        : element.scrollHeight - element.clientHeight;
      if (/(auto|scroll)/.test(overflow) && maximum > 1 &&
          (delta < 0 ? position > 0 : position < maximum - 1)) return true;
      if (element === dialog) break;
    }
    return false;
  };
  const prevent = (event) => { if (event.cancelable) event.preventDefault(); };
  const onWheel = (event) => {
    if (event.ctrlKey) return; // Preserve browser zoom.
    if (!dialog.contains(event.target) || !canScroll(event.target, event.deltaX, event.deltaY)) prevent(event);
  };
  let touch = null;
  const onTouchStart = (event) => {
    touch = event.touches.length === 1
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : null;
  };
  const onTouchMove = (event) => {
    if (!touch || event.touches.length !== 1) return;
    const next = event.touches[0];
    const dx = touch.x - next.clientX;
    const dy = touch.y - next.clientY;
    touch = { x: next.clientX, y: next.clientY };
    if (!dialog.contains(event.target)) return prevent(event);
    // Horizontal gestures belong to meal swipe actions, calendars and sliders.
    if (Math.abs(dx) > Math.abs(dy) || event.target.closest('input[type="range"]')) return;
    if (!canScroll(event.target, dx, dy)) prevent(event);
  };
  const options = { capture: true, passive: false };
  document.addEventListener("wheel", onWheel, options);
  document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
  document.addEventListener("touchmove", onTouchMove, options);

  return () => {
    document.removeEventListener("wheel", onWheel, true);
    document.removeEventListener("touchstart", onTouchStart, true);
    document.removeEventListener("touchmove", onTouchMove, true);
    for (const { element, x, y, overflow } of frozen) {
      element.style.removeProperty("overflow");
      for (const { property, value, priority } of overflow) {
        if (value) element.style.setProperty(property, value, priority);
      }
      element.scrollLeft = x;
      element.scrollTop = y;
    }
  };
}
