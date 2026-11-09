import { forwardRef, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { protectedExerciseVideoAccess, VIDEO_ACCESS_REFRESH_MARGIN_MS } from "../../utils/protectedExerciseVideo.js";
import { normalizeExerciseVideoPosterTime } from "../../../functions/exerciseVideoPoster.js";
import styles from "./ProtectedExerciseVideo.module.css";

const subscribe = (listener) => protectedExerciseVideoAccess.subscribe(listener);
const getSnapshot = () => protectedExerciseVideoAccess.getSnapshot();

// A paused seek displays a chosen frame without a second image or public URL.
// The first real play still starts at the beginning of the demonstration.
function displayPreview(video, time, state, source, force = false) {
  if (!video || video.readyState < 1 || !video.paused || time === null) return;
  if (!force && state.current?.source === source && state.current.time === time) return;
  video.currentTime = Math.min(time, Number.isFinite(video.duration) ? Math.max(0, video.duration - .05) : time);
  state.current = { source, time, showing: true };
}

const ProtectedExerciseVideo = forwardRef(function ProtectedExerciseVideo({ src, previewTime, preferPoster = false, ...props }, forwardedRef) {
  const authSession = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const requiresAccess = protectedExerciseVideoAccess.isProtected(src);
  const session = requiresAccess ? authSession : 0;
  const [attempt, setAttempt] = useState(0);
  const [access, setAccess] = useState(null);
  const [failedPoster, setFailedPoster] = useState("");
  const [playedSource, setPlayedSource] = useState("");
  const [videoIntent, setVideoIntent] = useState("");
  const [fallbackPreview, setFallbackPreview] = useState("");
  const videoRef = useRef(null);
  const playbackToRestore = useRef(null);
  const intentionalCleanup = useRef(false);
  const previewState = useRef(null);
  const posterTime = normalizeExerciseVideoPosterTime(previewTime);
  const requestedPosterTime = preferPoster ? posterTime : null;
  const previewSource = `${session}:${src}`;
  const previewIdentity = `${previewSource}:${posterTime}`;
  const seekFallback = preferPoster && requiresAccess && fallbackPreview === previewIdentity;
  const posterOnly = preferPoster && requiresAccess && videoIntent !== previewSource && !seekFallback;
  const current = access?.source === src && access.session === session && access.previewTime === requestedPosterTime ? access : null;
  const nativeSource = current?.url || (!requiresAccess ? src : undefined);
  // While signing, do not request metadata just to seek to a preview. The
  // poster layer reuses the video's CSS crop and needs no MP4 bytes.
  const waitingForPoster = preferPoster && requiresAccess && !seekFallback && (!current || current.posterPending);
  const posterIdentity = `${previewSource}:${posterTime}:${current?.posterUrl || ""}`;
  const rejectedBlob = failedPoster === `blob:${posterIdentity}`;
  const fastPoster = preferPoster && !seekFallback && !current?.posterPending && failedPoster !== posterIdentity
    ? (!rejectedBlob && current?.posterBlobUrl) || current?.posterUrl : undefined;
  const posterUnavailable = Boolean(preferPoster && requiresAccess && !seekFallback && current && !current.error &&
    !waitingForPoster && !fastPoster && playedSource !== previewSource);
  const seekPreviewTime = seekFallback ? posterTime ?? 0 : preferPoster && requiresAccess || waitingForPoster || fastPoster ? null : posterTime;
  const preload = seekFallback && playedSource !== previewSource ? "metadata" : posterOnly || waitingForPoster || fastPoster
    ? playbackToRestore.current?.playing ? "auto" : "none" : props.preload;

  useEffect(() => {
    // A trainer can select a new moment before a prebuilt WebP exists for it.
    // Retrying that optional image forever cannot create it. Only in this
    // degraded case request the ordinary authenticated video capability and
    // seek the exact chosen frame; available posters still load zero MP4 bytes.
    if (posterUnavailable) setFallbackPreview(previewIdentity);
  }, [posterUnavailable, previewIdentity]);

  useEffect(() => {
    if (seekPreviewTime === null) {
      if (previewState.current?.showing && videoRef.current?.paused) videoRef.current.currentTime = 0;
      previewState.current = null;
    } else displayPreview(videoRef.current, seekPreviewTime, previewState, previewSource);
  }, [seekPreviewTime, previewSource]);

  useEffect(() => {
    const video = videoRef.current;
    // StrictMode rehearses effect cleanup without replacing the DOM node.
    // Restore a public source synchronously if that rehearsal released it.
    if (video && src && !protectedExerciseVideoAccess.isProtected(src) && !video.getAttribute("src")) {
      video.setAttribute("src", src);
      video.load();
    }
    return () => {
      intentionalCleanup.current = true;
      playbackToRestore.current = null;
      previewState.current = null;
      // Only account/source changes end buffered playback; credential refresh does not.
      video?.pause();
      video?.removeAttribute("src");
      video?.load();
    };
  }, [src, session]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !requiresAccess || !preferPoster) return;
    const descriptor = Object.getOwnPropertyDescriptor(video, "play");
    const nativePlay = video.play;
    let active = true, playingRequest;
    // Existing controls and forwarded refs call the native DOM node's play().
    // Keep that interface, delaying only the protected URL until real intent.
    const play = () => {
      if (video.getAttribute("src")) return nativePlay.call(video);
      if (playingRequest) return playingRequest;
      setVideoIntent(previewSource);
      playingRequest = protectedExerciseVideoAccess.resolve(src, { previewTime: requestedPosterTime }).then(result => {
        if (!active || videoRef.current !== video) throw Object.assign(new Error("Сеанс видео изменился."), { code: "video/session-changed" });
        const firstPlayback = !video.getAttribute("src");
        intentionalCleanup.current = false;
        // Let React own src before native play(). Assigning it imperatively and
        // then committing the same prop can restart loading and abort playback.
        flushSync(() => setAccess(previous => ({ ...previous, source: src, session,
          previewTime: requestedPosterTime, ...result })));
        if (firstPlayback) { previewState.current = null; video.currentTime = 0; }
        return nativePlay.call(video);
      }).finally(() => { playingRequest = null; });
      return playingRequest;
    };
    video.play = play;
    return () => {
      active = false;
      if (video.play === play) {
        if (descriptor) Object.defineProperty(video, "play", descriptor);
        else delete video.play;
      }
    };
  }, [src, session, requiresAccess, preferPoster, previewSource, requestedPosterTime]);

  useEffect(() => {
    let active = true;
    let refreshTimer;
    protectedExerciseVideoAccess.resolve(src, { previewTime: requestedPosterTime, ...(posterOnly ? { posterOnly: true } : {}) }).then(async (result) => {
      if (!active) return;
      const video = videoRef.current;
      if (result.expiresAt && video?.getAttribute("src") && video.getAttribute("src") !== result.url) {
        playbackToRestore.current = { time: video.currentTime, playing: !video.paused };
      }
      const cachedPoster = preferPoster && !seekFallback && result.posterUrl
        ? protectedExerciseVideoAccess.getCachedPoster(src, { previewTime: requestedPosterTime }) : null;
      const posterPending = Boolean(preferPoster && !seekFallback && result.posterUrl && !cachedPoster);
      const nextAccess = { source: src, session, attempt, previewTime: requestedPosterTime, ...result };
      const publish = patch => setAccess(previous => ({ ...nextAccess, ...patch,
        // A late poster task cannot remove a URL already requested by Play.
        ...(!nextAccess.url && previous?.source === src && previous.session === session && previous.url ? { url: previous.url } : {}) }));
      publish({ posterPending, posterBlobUrl: cachedPoster?.url });
      if (result.expiresAt) refreshTimer = window.setTimeout(() => {
        if (active) setAttempt((value) => value + 1);
      }, Math.max(1000, result.expiresAt - Date.now() - VIDEO_ACCESS_REFRESH_MARGIN_MS));
      if (posterPending) {
        // Join an upcoming-exercise prefetch instead of requesting the same
        // private image twice. Playback resolves its own video-only capability.
        const poster = await protectedExerciseVideoAccess.prefetchPoster(src, { previewTime: requestedPosterTime });
        if (active) {
          // Fetch/stream/CORS prefetch can fail while a native image can still
          // load the signed WebP. Keep that image fallback, never the MP4.
          publish({ posterPending: false, posterBlobUrl: poster?.url });
        }
      }
    }, (error) => {
      if (!active) return;
      intentionalCleanup.current = true;
      playbackToRestore.current = null;
      videoRef.current?.pause();
      videoRef.current?.removeAttribute("src");
      videoRef.current?.load();
      setAccess({ source: src, session, attempt, previewTime: requestedPosterTime, error });
    });
    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
    };
  }, [src, session, attempt, requestedPosterTime, preferPoster, previewSource, posterTime, posterOnly, seekFallback]);

  return <>
    <video {...props} key={`${session}:${src}`} src={nativeSource || undefined}
      poster={props.poster} preload={preload}
      data-video-preview-time={posterTime ?? "default"}
      data-video-preview-mode={fastPoster ? "poster" : waitingForPoster ? "pending" : seekFallback ? "seek" : posterOnly ? "unavailable" : preferPoster && requiresAccess ? "playback" : "seek"}
      data-protected-video-state={!requiresAccess ? "public" : current?.error ? "error" : current?.url || current?.posterOnly ? "ready" : "pending"}
      data-video-session={session} ref={(element) => {
      videoRef.current = element;
      if (typeof forwardedRef === "function") forwardedRef(element);
      else if (forwardedRef) forwardedRef.current = element;
    }} onLoadStart={(event) => {
      if (event.currentTarget.getAttribute("src")) intentionalCleanup.current = false;
      // Assigning a preload=none source can emit loadstart without fetching a
      // video frame. Keep the ready poster free of a perpetual loading label.
      if (event.currentTarget.getAttribute("src") && !waitingForPoster && (!fastPoster || !event.currentTarget.paused)) props.onLoadStart?.(event);
    }} onLoadedMetadata={(event) => {
      const restore = playbackToRestore.current;
      if (restore) {
        playbackToRestore.current = null;
        const video = event.currentTarget;
        if (Number.isFinite(restore.time)) video.currentTime = Math.min(restore.time, Number.isFinite(video.duration) ? video.duration : restore.time);
        if (restore.playing) void video.play().catch(() => {});
      } else displayPreview(event.currentTarget, seekPreviewTime, previewState, previewSource, true);
      props.onLoadedMetadata?.(event);
    }} onPlay={(event) => {
      if (previewState.current?.source === previewSource && previewState.current.showing) {
        previewState.current.showing = false;
        event.currentTarget.currentTime = 0;
      }
      props.onPlay?.(event);
    }} onPlaying={(event) => {
      setPlayedSource(previewSource);
      props.onPlaying?.(event);
    }} onError={(event) => {
      if (!intentionalCleanup.current && event.currentTarget.getAttribute("src")) props.onError?.(event);
    }} />
    {fastPoster && playedSource !== previewSource ? <img
      className={`${props.className || ""} ${styles.poster}`} style={{ ...props.style, pointerEvents: "none" }}
      src={fastPoster} alt="" aria-hidden="true" draggable={false} data-video-poster="true"
      onError={() => {
        if (current?.posterBlobUrl && fastPoster === current.posterBlobUrl && fastPoster.startsWith("blob:")) {
          protectedExerciseVideoAccess.invalidate(src);
          setFailedPoster(`blob:${posterIdentity}`);
        } else setFailedPoster(posterIdentity);
      }} /> : null}
    {current?.error ? <div className={`${styles.error}${preferPoster ? ` ${styles.posterError}` : ""}`} role="alert" data-protected-video-error="true">
      <span>{current.error.message || "Не удалось загрузить видео."}</span>
      <button className={styles.retry} type="button" disabled={current.attempt !== attempt} onClick={(event) => {
        event.stopPropagation();
        protectedExerciseVideoAccess.invalidate(src);
        setAttempt((value) => value + 1);
      }}>Повторить загрузку</button>
    </div> : null}
  </>;
});

export default ProtectedExerciseVideo;
