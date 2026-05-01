import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";

const STORAGE_KEY = "workout_tracker_v1";
const AUTH_KEY = "workout_tracker_logged_in";

const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby9cdVvcQ1MOu94jzNWIDxR4ONrKT_WF4mcGmRm8Eyx8b9787ohY6tZhls7eE4Slhjz/exec";

const starterPlan = {
  workouts: [
    {
      id: "w1",
      name: "Тренировка 1",
      exercises: [
        { id: "e1", name: "Жим ногами", video: "/videos/1. Жим ногами.MOV", sets: [{ reps: 8, weight: "" }] },
        { id: "e2", name: "Тяга верхнего блока", video: "/videos/Тяга верхнего блока.MOV", sets: [{ reps: 8, weight: "" }] },
        { id: "e3", name: "Жим лежа с гантелями", video: "/videos/Жим лежа с гантелями.MOV", sets: [{ reps: 8, weight: "" }] },
        { id: "e4", name: "Отведение рук в сторону с гантелями", video: "/videos/Отведение рук в сторону с гантелями.MP4", sets: [{ reps: 8, weight: "" }] },
        { id: "e5", name: "Разгибание рук в кроссовере", video: "/videos/Разгибание рук в кроссовере.MOV", sets: [{ reps: 8, weight: "" }] },
        { id: "e6", name: "Сгибание рук с гантелями", video: "/videos/Сгибание рук с гантелями.MOV", sets: [{ reps: 8, weight: "" }] },
        { id: "e7", name: "Пресс (скручивания обычные)", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }] }
      ]
    },
    {
      id: "w2",
      name: "Тренировка 2",
      exercises: [
        { id: "e8", name: "Приседания с гантелью", sets: [{ reps: 8, weight: "" }] },
        { id: "e9", name: "Тяга нижнего блока", sets: [{ reps: 8, weight: "" }] },
        { id: "e10", name: "Жим лежа в тренажере", sets: [{ reps: 8, weight: "" }] },
        { id: "e11", name: "Вертикальный жим с гантелями", sets: [{ reps: 8, weight: "" }] },
        { id: "e12", name: "Разгибание рук в тренажере", sets: [{ reps: 8, weight: "" }] },
        { id: "e13", name: "Сгибание рук в кроссовере", sets: [{ reps: 8, weight: "" }] },
        { id: "e14", name: "Пресс", sets: [{ reps: 15, weight: "" }] }
      ]
    }
  ]
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  const [plan, setPlan] = useState(starterPlan);
  const [page, setPage] = useState("main");
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null);
  const [openVideoId, setOpenVideoId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(AUTH_KEY) === "true") {
      setIsLoggedIn(true);
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPlan(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  const workout = useMemo(() => {
    return plan.workouts.find((w) => w.id === selectedWorkoutId);
  }, [selectedWorkoutId, plan]);

  function handleLogin(e) {
    e.preventDefault();

    if (login === "admin" && password === "admin") {
      localStorage.setItem(AUTH_KEY, "true");
      setIsLoggedIn(true);
      setPage("main");
    }
  }

  function logout() {
    localStorage.removeItem(AUTH_KEY);
    setIsLoggedIn(false);
    setPage("main");
    setSelectedWorkoutId(null);
  }

  function goBackToMain() {
    setPage("main");
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
  }

  function updateWorkout(cb) {
    if (!workout) return;

    setPlan((p) => ({
      ...p,
      workouts: p.workouts.map((w) => (w.id === workout.id ? cb(w) : w))
    }));
  }

  function addSet(id) {
    updateWorkout((w) => ({
      ...w,
      exercises: w.exercises.map((e) =>
        e.id === id
          ? { ...e, sets: [...e.sets, { reps: 8, weight: "" }] }
          : e
      )
    }));
  }

  function updateSet(id, i, field, val) {
    updateWorkout((w) => ({
      ...w,
      exercises: w.exercises.map((e) =>
        e.id === id
          ? {
              ...e,
              sets: e.sets.map((s, idx) =>
                idx === i ? { ...s, [field]: val } : s
              )
            }
          : e
      )
    }));
  }

  async function saveWorkoutToGoogle() {
    if (!workout) return;

    setIsSaving(true);

    try {
      const rows = [];

      workout.exercises.forEach((exercise) => {
        exercise.sets.forEach((set, index) => {
          rows.push({
            workout: workout.name,
            exercise: exercise.name,
            set: index + 1,
            reps: set.reps,
            weight: set.weight
          });
        });
      });

      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ rows })
      });

      alert("Тренировка отправлена в Google Таблицу ✅");
    } catch {
      alert("Ошибка сохранения. Проверь Apps Script.");
    } finally {
      setIsSaving(false);
    }
  }

  function loadHistory() {
    setHistoryLoading(true);

    const callbackName = "historyCallback_" + Date.now();

    const script = document.createElement("script");

    window[callbackName] = function (data) {
      setHistory([...data].reverse());
      setHistoryLoading(false);

      delete window[callbackName];
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };

    script.src = `${GOOGLE_SCRIPT_URL}?callback=${callbackName}&t=${Date.now()}`;

    script.onerror = function () {
      setHistoryLoading(false);
      alert("Не получилось загрузить историю");

      delete window[callbackName];
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };

    document.body.appendChild(script);
  }

  function openHistory() {
    setPage("history");
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
    loadHistory();
  }

  const groupedHistory = useMemo(() => {
    const groups = {};

    history.forEach((row) => {
      const date = new Date(row.date).toLocaleDateString("ru-RU");
      const key = `${date} — ${row.workout}`;

      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });

    return Object.entries(groups);
  }, [history]);

  if (!isLoggedIn) {
    return (
      <div className="loginPage">
        <form className="loginCard" onSubmit={handleLogin}>
          <h1>Вход</h1>
          <p>admin / admin</p>

          <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Логин" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" />

          <button>Войти</button>
        </form>
      </div>
    );
  }

  if (page === "main") {
    return (
      <div className="menuPage">
        <h1 className="menuTitle">Главное меню</h1>

        <div className="menuButtons">
          <button className="bigButton" onClick={() => setPage("workouts")}>
            🏋️ Тренировки
          </button>

          <button className="bigButton" onClick={() => setPage("nutrition")}>
            🍽️ Питание
          </button>
        </div>

        <button className="logoutSmall" onClick={logout}>
          ⬅ Выйти
        </button>
      </div>
    );
  }

  if (page === "nutrition") {
    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn" onClick={goBackToMain}>← Назад</button>
          <h1 className="workoutTitle">Питание</h1>
        </div>

        <div className="exercise">
          <h3>Раздел в разработке</h3>
          <p style={{ textAlign: "center", color: "#aaa" }}>
            Здесь позже добавим питание, калории, белки, жиры и углеводы.
          </p>
        </div>
      </div>
    );
  }

  if (page === "history") {
    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn" onClick={() => setPage("workouts")}>← Назад</button>
          <h1 className="workoutTitle">История</h1>
        </div>

        <button className="finishBtn fixed" onClick={loadHistory}>
          🔄 Обновить историю
        </button>

        {historyLoading && (
          <div className="exercise">
            <h3>Загрузка...</h3>
          </div>
        )}

        {!historyLoading && groupedHistory.length === 0 && (
          <div className="exercise">
            <h3>История пустая</h3>
            <p style={{ textAlign: "center", color: "#aaa" }}>
              Заверши тренировку, и она появится здесь.
            </p>
          </div>
        )}

        {!historyLoading &&
          groupedHistory.map(([title, rows]) => (
            <div className="exercise" key={title}>
              <h3>{title}</h3>

              {rows.map((row, index) => (
                <p key={index} style={{ color: "#ddd", fontSize: "16px" }}>
                  {row.exercise} — подход {row.set}: {row.reps} × {row.weight || "без веса"}
                </p>
              ))}
            </div>
          ))}
      </div>
    );
  }

  if (page === "workouts" && !selectedWorkoutId) {
    return (
      <div className="menuPage">
        <h1 className="menuTitle">Выбери тренировку</h1>

        <div className="menuButtons">
          <button className="bigButton" onClick={() => setSelectedWorkoutId("w1")}>
            🏋️ Тренировка 1
          </button>

          <button className="bigButton" onClick={() => setSelectedWorkoutId("w2")}>
            🏋️ Тренировка 2
          </button>

          <button className="bigButton" onClick={openHistory}>
            📊 История
          </button>
        </div>

        <button className="logoutSmall" onClick={goBackToMain}>
          ← Назад
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="workoutHeader">
        <button
          className="backBtn"
          onClick={() => {
            setSelectedWorkoutId(null);
            setOpenVideoId(null);
          }}
        >
          ← Назад
        </button>

        <h1 className="workoutTitle">{workout.name}</h1>
      </div>

      {workout.exercises.map((e) => (
        <div key={e.id} className="exercise">
          <h3>{e.name}</h3>

          {e.video && (
            <>
              <button
                className="showVideoBtn"
                onClick={() => setOpenVideoId(openVideoId === e.id ? null : e.id)}
              >
                🎥 {openVideoId === e.id ? "Скрыть технику" : "Показать технику"}
              </button>

              {openVideoId === e.id && (
                <video className="exerciseVideo" src={e.video} controls />
              )}
            </>
          )}

          {e.sets.map((s, i) => (
            <div key={i}>
              <input
                type="number"
                placeholder="повторы"
                value={s.reps}
                onChange={(ev) => updateSet(e.id, i, "reps", ev.target.value)}
              />

              <input
                type="number"
                placeholder="вес"
                value={s.weight}
                onChange={(ev) => updateSet(e.id, i, "weight", ev.target.value)}
              />
            </div>
          ))}

          <button onClick={() => addSet(e.id)}>+ подход</button>
        </div>
      ))}

      <div className="bottomBar">
        <button
          className="finishBtn fixed"
          onClick={saveWorkoutToGoogle}
          disabled={isSaving}
        >
          {isSaving ? "Сохраняю..." : "✅ Завершить тренировку"}
        </button>
      </div>
    </div>
  );
}