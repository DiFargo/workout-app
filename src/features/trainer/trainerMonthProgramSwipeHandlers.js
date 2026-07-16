export function createTrainerMonthProgramSwipeHandlers({
  adminProgramSwipeStartRef,
  adminProgramSwipeSuppressClickRef,
  setAdminProgramSwipeOpenKey
}) {
  function handleAdminProgramSwipeStart(key, event) {
    event.stopPropagation();
    if (event.pointerType === "mouse" && event.button !== 0) return;
    adminProgramSwipeStartRef.current = { key, x: event.clientX, y: event.clientY };
  }

  function handleAdminProgramSwipeEnd(key, event) {
    event.stopPropagation();
    const start = adminProgramSwipeStartRef.current;
    adminProgramSwipeStartRef.current = null;
    if (!start || start.key !== key) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;

    event.preventDefault();
    adminProgramSwipeSuppressClickRef.current = true;
    window.setTimeout(() => {
      adminProgramSwipeSuppressClickRef.current = false;
    }, 0);
    setAdminProgramSwipeOpenKey(deltaX < 0 ? key : "");
  }

  function handleAdminProgramSwipeCancel(key, event) {
    event.stopPropagation();
    if (adminProgramSwipeStartRef.current?.key === key) {
      adminProgramSwipeStartRef.current = null;
    }
  }

  function handleAdminProgramSwipeClick(event) {
    if (!adminProgramSwipeSuppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }

  return {
    handleAdminProgramSwipeCancel,
    handleAdminProgramSwipeClick,
    handleAdminProgramSwipeEnd,
    handleAdminProgramSwipeStart
  };
}
