import ProtectedExerciseVideo from "../media/ProtectedExerciseVideo.jsx";
import { useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crop, Image, Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { normalizeExerciseVideoCrop } from "../../../functions/exerciseVideoCrop.js";
import { normalizeExerciseVideoPosterTime } from "../../../functions/exerciseVideoPoster.js";
import { exerciseVideoCropStyle, panExerciseVideoCrop } from "../../utils/exerciseVideoCrop.js";
import TrainerEditorSheet from "./TrainerEditorSheet.jsx";
import styles from "./ExerciseVideoCropEditor.module.css";

const centeredCrop = { x: 0.5, y: 0.5, zoom: 1 };
const formatTime = value => {
  const seconds = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
};

function CropDialog({ src, value, posterTime, selectPreview = false, onApply, onClose, disabled }) {
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const dragRef = useRef(null);
  const lastCropRef = useRef(value || { ...centeredCrop });
  const [draft, setDraft] = useState(value || { ...centeredCrop });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const editable = Boolean(!selectPreview && draft && ready && !failed && !disabled);
  const visibleCrop = selectPreview ? value : draft;

  function geometry() {
    const { width, height } = frameRef.current.getBoundingClientRect();
    return { width, height, videoWidth: videoRef.current.videoWidth, videoHeight: videoRef.current.videoHeight };
  }

  function moveBy(dx, dy) {
    if (editable) setDraft(current => panExerciseVideoCrop(current, geometry(), dx, dy));
  }

  function setZoom(zoom) {
    if (editable) setDraft(current => ({ ...current, zoom: Math.min(3, Math.max(1, zoom)) }));
  }

  function startDrag(event) {
    if (!editable || event.button !== 0 || dragRef.current) return;
    videoRef.current.pause();
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, crop: draft, size: geometry() };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event) {
    const drag = dragRef.current;
    if (!editable || !drag || drag.id !== event.pointerId) return;
    setDraft(panExerciseVideoCrop(drag.crop, drag.size, event.clientX - drag.x, event.clientY - drag.y));
  }

  function stopDrag(event) {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const close = () => { videoRef.current?.pause(); onClose(); };
  const arrows = [[ArrowLeft, "влево", -12, 0], [ArrowUp, "вверх", 0, -12], [ArrowDown, "вниз", 0, 12], [ArrowRight, "вправо", 12, 0]];

  return <TrainerEditorSheet title={selectPreview ? "Превью упражнения" : "Кадр видео"} role="dialog" className={styles.dialog} bodyClassName={styles.body} onClose={close}
    footer={<>
      <button type="button" className={styles.cancel} onClick={close}>Отмена</button>
      <button type="button" className={styles.apply} disabled={disabled || !ready || failed || (selectPreview && seeking)} onClick={() => {
        videoRef.current?.pause();
        onApply(selectPreview ? normalizeExerciseVideoPosterTime(videoRef.current.currentTime) : draft);
        close();
      }}>{selectPreview ? "Использовать кадр" : "Применить"}</button>
    </>}>
    {!selectPreview && <div className={styles.modes} role="group" aria-label="Формат кадра">
      <button type="button" aria-pressed={Boolean(draft)} disabled={disabled} onClick={() => setDraft(current => current || lastCropRef.current)}>Квадрат 1:1</button>
      <button type="button" aria-pressed={!draft} disabled={disabled} onClick={() => { if (draft) lastCropRef.current = draft; setDraft(null); }}>Без обрезки</button>
    </div>}
    {selectPreview && <p className={styles.hint}>Выберите момент, в котором хорошо видны положение тела и движение. Этот кадр клиент увидит до запуска видео.</p>}
    <div ref={frameRef} className={`${styles.frame} ${editable ? styles.draggable : ""}`} data-testid="exercise-crop-preview"
      tabIndex={editable ? 0 : undefined} role="group" aria-label={selectPreview ? "Выбранный кадр превью" : "Область кадра"} aria-describedby="exercise-crop-hint"
      onKeyDown={event => {
        const directions = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
        if (directions[event.key] && editable) { event.preventDefault(); moveBy(...directions[event.key]); }
      }}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}
      onLostPointerCapture={() => { dragRef.current = null; }}>
      <ProtectedExerciseVideo ref={videoRef} src={src} playsInline muted preload="auto" className={styles.video} style={exerciseVideoCropStyle(visibleCrop)}
        onLoadedMetadata={event => {
          const video = event.currentTarget;
          setReady(true); setFailed(false); setDuration(video.duration);
          if (selectPreview) {
            const requested = normalizeExerciseVideoPosterTime(posterTime) ?? 0;
            const next = Math.min(requested, Number.isFinite(video.duration) ? Math.max(0, video.duration - .05) : requested);
            video.currentTime = next; setTime(next);
          }
        }}
        onDurationChange={event => setDuration(event.currentTarget.duration)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
        onSeeking={() => setSeeking(true)} onSeeked={() => setSeeking(false)}
        onError={() => { setFailed(true); setReady(false); setPlaying(false); }} />
      {editable && !playing && <div className={styles.grid} aria-hidden="true" />}
      {!ready && <span className={styles.status} role="status">{failed ? "Не удалось загрузить видео" : "Загрузка видео…"}</span>}
    </div>
    <div className={styles.playback}>
      <button type="button" disabled={!ready && !failed} aria-label={failed ? "Повторить загрузку предпросмотра" : playing ? "Приостановить предпросмотр" : "Воспроизвести предпросмотр"}
        onClick={() => {
          const video = videoRef.current;
          if (failed) { setFailed(false); setReady(false); video.load(); }
          else if (video.paused) video.play().catch(() => { setFailed(true); setReady(false); });
          else video.pause();
        }}>{playing ? <Pause aria-hidden="true" /> : failed ? <RotateCcw aria-hidden="true" /> : <Play aria-hidden="true" />}</button>
      <input type="range" aria-label={selectPreview ? "Момент для превью" : "Позиция видео"} min="0" max={Number.isFinite(duration) && duration > 0 ? Math.max(0, duration - .05) : 1} step="0.1"
        value={time} disabled={!ready || failed} onChange={event => {
          const next = Number(event.target.value);
          videoRef.current.pause(); videoRef.current.currentTime = next; setTime(next);
        }} />
      <span>{formatTime(time)} / {formatTime(duration)}</span>
    </div>
    <div className={styles.settings}>
      <p className={styles.hint} id="exercise-crop-hint">{selectPreview
        ? "Перемещайте ползунок или используйте стрелки клавиатуры. Видео у клиента начнётся с начала. Превью сохранится после сохранения упражнения."
        : draft ? "Переместите видео, чтобы выбрать нужную область." : "Весь ролик будет виден без обрезки, с полями по краям."}</p>
      {!selectPreview && draft && <>
        <label className={styles.zoomLabel} htmlFor="exercise-crop-zoom">Масштаб<output>{Math.round(draft.zoom * 100)}%</output></label>
        <div className={styles.zoom}>
          <button type="button" aria-label="Уменьшить масштаб" disabled={!editable || draft.zoom <= 1} onClick={() => setZoom(draft.zoom - .1)}><Minus aria-hidden="true" /></button>
          <input id="exercise-crop-zoom" type="range" aria-label="Приближение" min="1" max="3" step=".01" value={draft.zoom} disabled={!editable} onChange={event => setZoom(Number(event.target.value))} />
          <button type="button" aria-label="Увеличить масштаб" disabled={!editable || draft.zoom >= 3} onClick={() => setZoom(draft.zoom + .1)}><Plus aria-hidden="true" /></button>
        </div>
        <div className={styles.secondary}>
          <details><summary>Сдвинуть кнопками</summary><div className={styles.arrows}>
            {arrows.map(([Icon, label, dx, dy]) => <button key={label} type="button" aria-label={`Сдвинуть кадр ${label}`} disabled={!editable} onClick={() => moveBy(dx, dy)}><Icon aria-hidden="true" /></button>)}
          </div></details>
          <button type="button" className={styles.reset} disabled={!editable} onClick={() => setDraft({ ...centeredCrop })}><RotateCcw aria-hidden="true" />Сбросить</button>
        </div>
      </>}
    </div>
  </TrainerEditorSheet>;
}

// Applying a crop only updates the parent draft; the exercise's Save persists it.
export default function ExerciseVideoCropEditor({ src, value, onChange, posterTime, onPosterChange, disabled = false }) {
  const [open, setOpen] = useState(null);
  const crop = normalizeExerciseVideoCrop(value);
  const selectedPosterTime = normalizeExerciseVideoPosterTime(posterTime);
  return <section className={styles.root} aria-label="Кадр видео" data-testid="exercise-video-crop-editor">
    <div className={styles.thumbnail} aria-hidden="true"><ProtectedExerciseVideo src={src} previewTime={selectedPosterTime} muted playsInline preload="metadata" className={styles.video} style={exerciseVideoCropStyle(crop)} /></div>
    <div className={styles.summary}>
      <strong>Видео в тренировке</strong>
      <span>{crop ? "Выбран квадратный кадр 1:1" : "Весь ролик, без обрезки"}</span>
      <button type="button" disabled={disabled} onClick={() => setOpen("crop")}><Crop size={18} aria-hidden="true" />Настроить кадр</button>
      {onPosterChange && <button type="button" disabled={disabled} onClick={() => setOpen("preview")}><Image size={18} aria-hidden="true" />{selectedPosterTime === null ? "Выбрать превью" : "Изменить превью"}</button>}
      {selectedPosterTime !== null && <span>Превью: {formatTime(selectedPosterTime)}</span>}
    </div>
    <p className={styles.note}>На весь экран — исходное видео. Изменения сохранятся вместе с упражнением.</p>
    {open && <CropDialog src={src} value={crop} posterTime={selectedPosterTime} selectPreview={open === "preview"} disabled={disabled}
      onApply={open === "preview" ? onPosterChange : onChange} onClose={() => setOpen(null)} />}
  </section>;
}
