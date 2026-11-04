import { memo, useEffect, useRef, useState } from "react";
import { Dumbbell } from "lucide-react";
import ProtectedExerciseVideo from "../media/ProtectedExerciseVideo";
import { protectedExerciseVideoAccess } from "../../utils/protectedExerciseVideo";
import styles from "./TrainerLibraryExercisePreview.module.css";

export default memo(function TrainerLibraryExercisePreview({ video, previewTime, poster }) {
  const containerRef = useRef(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [failedPoster, setFailedPoster] = useState("");
  const source = typeof video === "string" ? video.trim() : "";
  const posterSource = typeof poster === "string" ? poster.trim() : "";
  const hasPoster = Boolean(posterSource && failedPoster !== posterSource);
  const protectedSource = Boolean(source && protectedExerciseVideoAccess.isProtected(source));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    if (typeof IntersectionObserver === "function") {
      const observer = new IntersectionObserver(([entry]) => {
        setNearViewport(entry.isIntersecting);
      }, { rootMargin: "120px" });
      observer.observe(container);
      return () => observer.disconnect();
    }

    // Older WebViews still defer posters until the card approaches the screen.
    let frame;
    const check = () => {
      frame = undefined;
      const rect = container.getBoundingClientRect();
      setNearViewport(rect.bottom >= -120 && rect.top <= window.innerHeight + 120 &&
        rect.right >= -120 && rect.left <= window.innerWidth + 120);
    };
    const schedule = () => { if (frame === undefined) frame = window.requestAnimationFrame(check); };
    check();
    document.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    return () => {
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <span ref={containerRef} className={styles.preview} inert aria-hidden="true">
    <Dumbbell size={24} strokeWidth={1.6} aria-hidden="true" />
    {nearViewport ? <span className={styles.media}>
      {hasPoster ? <img src={posterSource} alt="" loading="lazy" decoding="async" draggable={false}
        onError={() => setFailedPoster(posterSource)} /> : protectedSource ? <ProtectedExerciseVideo
        src={source} previewTime={previewTime} preferPoster preload="none" muted playsInline
        controls={false} tabIndex={-1} aria-hidden="true" /> : null}
    </span> : null}
  </span>;
});
