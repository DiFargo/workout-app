import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";

const STORAGE_KEY = "workout_tracker_v1";
const AUTH_KEY = "workout_tracker_logged_in";

const starterPlan = {
  workouts: [
    {
      id: "w1",
      name: "Тренировка 1",
      exercises: [
        {
          id: "e1",
          name: "Жим ногами",
          video: "/videos/1. Жим ногами.MOV",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e2",
          name: "Тяга верхнего блока",
          video: "/videos/Тяга верхнего блока.MOV",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e3",
          name: "Жим лежа с гантелями",
          video: "/videos/Жим лежа с гантелями.MOV",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e4",
          name: "Отведение рук в сторону с гантелями",
          video: "/videos/Отведение рук в сторону с гантелями.MP4",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e5",
          name: "Разгибание рук в кроссовере",
          video: "/videos/Разгибание рук в кроссовере.MOV",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e6",
          name: "Сгибание рук с гантелями",
          video: "/videos/Сгибание рук с гантелями.MOV",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e7",
          name: "Пресс (скручивания обычные)",
          video: "/videos/Пресс (скручивания обычные).MOV",
          sets: [{ reps: 15, weight: "" }]
        }
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
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null);
  const [openVideoId, setOpenVideoId] = useState(null);

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

  function handleLogin(e) {
    e.preventDefault();

    if (login === "admin" && password === "admin") {
      localStorage.setItem(AUTH_KEY, "true");
      setIsLoggedIn(true);
    }
  }

  function logout() {
    localStorage.removeItem(AUTH_KEY);
    setIsLoggedIn(false);
    setSelectedWorkoutId(null);
  }

  const workout = useMemo(() => {
    return plan.workouts.find((w) => w.id === selectedWorkoutId);
  }, [selectedWorkoutId, plan]);

  function updateWorkout(cb) {
    setPlan((p) => ({
      ...p,
      workouts: p.workouts.map((w) =>
        w.id === workout.id ? cb(w) : w
      )
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

  if (!isLoggedIn) {
    return (
      <div className="loginPage">
        <form className="loginCard" onSubmit={handleLogin}>
          <h1>Вход</h1>
          <p>admin / admin</p>

          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Логин"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
          />

          <button>Войти</button>
        </form>
      </div>
    );
  }

  if (!selectedWorkoutId) {
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
        </div>

        <button className="logoutSmall" onClick={logout}>
          ⬅ Выйти
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="workoutHeader">
        <button className="backBtn" onClick={() => setSelectedWorkoutId(null)}>
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
                onClick={() =>
                  setOpenVideoId(openVideoId === e.id ? null : e.id)
                }
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
                onChange={(ev) =>
                  updateSet(e.id, i, "reps", ev.target.value)
                }
              />

              <input
                type="number"
                placeholder="вес"
                value={s.weight}
                onChange={(ev) =>
                  updateSet(e.id, i, "weight", ev.target.value)
                }
              />
            </div>
          ))}

          <button onClick={() => addSet(e.id)}>
            + подход
          </button>
        </div>
      ))}
    </div>
  );
}