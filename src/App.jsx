import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";

import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";

const STORAGE_KEY = "workout_tracker_v1";
const ADMIN_EMAIL = "work.kriptonit.il@gmail.com";

const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby9cdVvcQ1MOu94jzNWIDxR4ONrKT_WF4mcGmRm8Eyx8b9787ohY6tZhls7eE4Slhjz/exec";

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
          video: "/videos/Жим лежа с гантелями.mp4",
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
        {
          id: "e8",
          name: "Приседания с гантелью",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e9",
          name: "Тяга нижнего блока",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e10",
          name: "Жим лежа в тренажере",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e11",
          name: "Вертикальный жим с гантелями",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e12",
          name: "Разгибание рук в тренажере",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e13",
          name: "Сгибание рук в кроссовере",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e14",
          name: "Пресс",
          sets: [{ reps: 15, weight: "" }]
        }
      ]
    }
  ]
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [plan, setPlan] = useState(starterPlan);
  const [page, setPage] = useState("main");
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null);
  const [openVideoId, setOpenVideoId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openHistoryKey, setOpenHistoryKey] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoggedIn(!!u);
    });

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setPlan(JSON.parse(saved));
      } catch {
        setPlan(starterPlan);
      }
    }

    loadHistory();
    loadWorkoutsFromFirebase();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  const workout = useMemo(() => {
    return plan.workouts.find((w) => w.id === selectedWorkoutId);
  }, [selectedWorkoutId, plan]);

  const groupedHistory = useMemo(() => {
    const groups = {};

    history.forEach((row) => {
      const date = new Date(row.date).toLocaleDateString("ru-RU");
      const key = `${date} — ${row.workout}`;

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(row);
    });

    return Object.entries(groups);
  }, [history]);

  const lastExerciseResults = useMemo(() => {
    const result = {};

    history.forEach((row) => {
      if (!row.exercise) return;

      const exerciseName = row.exercise;

      if (!result[exerciseName]) {
        result[exerciseName] = {
          reps: row.reps,
          weight: row.weight,
          date: row.date
        };
      }
    });

    return result;
  }, [history]);

  function getLastExerciseText(exerciseName) {
    const last = lastExerciseResults[exerciseName];

    if (!last) {
      return "Прошлый раз: нет данных";
    }

    return `Прошлый раз: ${last.reps} × ${last.weight || "без веса"}`;
  }

  async function handleLogin(e) {
    e.preventDefault();

    try {
      await signInWithEmailAndPassword(auth, login, password);
      setPage("main");
      setLoginError("");
      loadHistory();
      loadWorkoutsFromFirebase();
    } catch {
      setLoginError("Неверный email или пароль");
    }
  }

  async function handleRegister() {
    try {
      await createUserWithEmailAndPassword(auth, login, password);
      setLoginError("");
      setPage("main");
      loadHistory();
      loadWorkoutsFromFirebase();
    } catch (err) {
      console.log(err);

      if (err.code === "auth/email-already-in-use") {
        setLoginError("Этот email уже зарегистрирован");
      } else if (err.code === "auth/invalid-email") {
        setLoginError("Неверный формат email");
      } else if (err.code === "auth/weak-password") {
        setLoginError("Пароль должен быть минимум 6 символов");
      } else {
        setLoginError("Ошибка регистрации");
      }
    }
  }

  function logout() {
    signOut(auth);

    setIsLoggedIn(false);
    setUser(null);
    setPage("main");
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
    setOpenHistoryKey(null);
    setLogin("");
    setPassword("");
    setLoginError("");
  }

  function goBackToMain() {
    setPage("main");
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
    setOpenHistoryKey(null);
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

  function resetWorkout() {
    if (!workout) return;

    setPlan((p) => ({
      ...p,
      workouts: p.workouts.map((w) =>
        w.id === workout.id
          ? {
              ...w,
              exercises: w.exercises.map((exercise) => ({
                ...exercise,
                sets: [
                  {
                    reps: exercise.name.includes("Пресс") ? 15 : 8,
                    weight: ""
                  }
                ]
              }))
            }
          : w
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
      resetWorkout();
      loadHistory();
    } catch {
      alert("Ошибка сохранения. Проверь Apps Script.");
    } finally {
      setIsSaving(false);
    }
  }

  async function loadWorkoutsFromFirebase() {
    try {
      const querySnapshot = await getDocs(collection(db, "workouts"));

      const workoutsFromDb = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        workoutsFromDb.push({
          id: doc.id,
          name: data.name || "Без названия",
          exercises: (data.exercises || []).map((exercise) => ({
            ...exercise,
            sets: exercise.sets || [
              {
                reps: exercise.name?.includes("Пресс") ? 15 : 8,
                weight: ""
              }
            ]
          }))
        });
      });

      if (workoutsFromDb.length > 0) {
        setPlan({ workouts: workoutsFromDb });
      }
    } catch (err) {
      console.log("Ошибка загрузки тренировок:", err);
    }
  }
   async function saveWorkoutsToFirebase() {
  try {
    for (const workout of plan.workouts) {
      await setDoc(doc(db, "workouts", workout.id), {
        name: workout.name,
        exercises: workout.exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          video: exercise.video || ""
        }))
      });
    }

    alert("Тренировки сохранены в Firebase ✅");
  } catch (err) {
    console.log("Ошибка сохранения тренировок:", err);
    alert("Не получилось сохранить тренировки");
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
    setOpenHistoryKey(null);
    loadHistory();
  }

  function openWorkout(id) {
    setSelectedWorkoutId(id);
    setOpenVideoId(null);
    loadHistory();
  }

  if (!isLoggedIn) {
    return (
      <div className="loginPage">
        <div className="loginHero">
          <div className="appLogo">W</div>
          <h1>Workout</h1>
          <p>Твой дневник тренировок</p>
        </div>

        <form className="loginCard" onSubmit={handleLogin}>
          <h2>Вход</h2>

          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Email"
          />

          <div className="passwordBox">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Скрыть" : "Показать"}
            </button>
          </div>

          {loginError && <div className="loginError">{loginError}</div>}

          <button className="loginBtn">Войти</button>

          <button
            className="loginBtn"
            type="button"
            onClick={handleRegister}
          >
            Регистрация
          </button>

          <p className="loginHint">Вход через email и пароль</p>
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

          {user?.email === ADMIN_EMAIL && (
            <button className="bigButton" onClick={() => setPage("admin")}>
              ⚙️ Админ-панель
            </button>
          )}
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
          <button className="backBtn" onClick={goBackToMain}>
            ← Назад
          </button>

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
          <button className="backBtn" onClick={() => setPage("workouts")}>
            ← Назад
          </button>

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
          groupedHistory.map(([title, rows]) => {
            const isOpen = openHistoryKey === title;

            return (
              <div className="historyCard" key={title}>
                <button
                  className="historyCardHeader"
                  onClick={() => setOpenHistoryKey(isOpen ? null : title)}
                >
                  <span>{title}</span>
                  <strong>{isOpen ? "−" : "+"}</strong>
                </button>

                {isOpen && (
                  <div className="historyCardBody">
                    {Object.entries(
                      rows.reduce((acc, row) => {
                        if (!acc[row.exercise]) {
                          acc[row.exercise] = [];
                        }

                        acc[row.exercise].push(row);
                        return acc;
                      }, {})
                    ).map(([exerciseName, sets]) => (
                      <div className="historyExercise" key={exerciseName}>
                        <h4>{exerciseName}</h4>

                        <div className="historySets">
                          {sets
                            .sort((a, b) => Number(a.set) - Number(b.set))
                            .map((set, index) => (
                              <div className="historySet" key={index}>
                                <span>Подход {set.set}</span>
                                <strong>
                                  {set.reps} × {set.weight || "без веса"}
                                </strong>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    );
  }

  if (page === "admin") {
    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn" onClick={() => setPage("main")}>
            ← Назад
          </button>

          <h1 className="workoutTitle">Админ-панель</h1>
        </div>

        <div className="exercise">
          <h3>Управление</h3>

          <p style={{ textAlign: "center", color: "#aaa" }}>
            Здесь ты будешь управлять приложением
          </p>

          <button className="bigButton">👥 Пользователи</button>

          <button className="bigButton" onClick={() => setPage("adminWorkouts")}>
            🏋️ Управление тренировками
          </button>

          <button className="bigButton">📊 Статистика</button>
        </div>
      </div>
    );
  }

  if (page === "adminWorkouts") {
    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn" onClick={() => setPage("admin")}>
            ← Назад
          </button>

          <h1 className="workoutTitle">Управление тренировками</h1>
        </div>

        {plan.workouts.map((workout) => (
          <div className="exercise" key={workout.id}>
            <input
  value={workout.name}
  onChange={(e) => {
    const newName = e.target.value;

    setPlan((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) =>
        w.id === workout.id ? { ...w, name: newName } : w
      )
    }));
  }}
/>

<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
  <input
    value={workout.name}
    onChange={(e) => {
      const newName = e.target.value;

      setPlan((prev) => ({
        ...prev,
        workouts: prev.workouts.map((w) =>
          w.id === workout.id ? { ...w, name: newName } : w
        )
      }));
    }}
  />

  <button
    onClick={() => {
      setPlan((prev) => ({
        ...prev,
        workouts: prev.workouts.filter((w) => w.id !== workout.id)
      }));
    }}
  >
    ❌
  </button>
</div>

{workout.exercises.map((exercise) => (
  <div
    key={exercise.id}
    style={{
      display: "flex",
      gap: "10px",
      alignItems: "center",
      marginBottom: "10px"
    }}
  >
    <input
      style={{
        flex: 1,
        minWidth: 0,
        padding: "10px",
        borderRadius: "8px"
      }}
      value={exercise.name}
      onChange={(e) => {
        const newName = e.target.value;

        setPlan((prev) => ({
          ...prev,
          workouts: prev.workouts.map((w) =>
            w.id === workout.id
              ? {
                  ...w,
                  exercises: w.exercises.map((ex) =>
                    ex.id === exercise.id ? { ...ex, name: newName } : ex
                  )
                }
              : w
          )
        }));
      }}
    />

    <button
      style={{
        width: "40px",
        height: "40px",
        minWidth: "40px",
        padding: 0,
        borderRadius: "8px",
        background: "#ff4d4f",
        color: "white",
        border: "none"
      }}
      onClick={() => {
        setPlan((prev) => ({
          ...prev,
          workouts: prev.workouts.map((w) =>
            w.id === workout.id
              ? {
                  ...w,
                  exercises: w.exercises.filter((ex) => ex.id !== exercise.id)
                }
              : w
          )
        }));
      }}
    >
      ✕
    </button>
  </div>
))}
<button
  onClick={() => {
    const newExercise = {
      id: "e" + Date.now(),
      name: "Новое упражнение",
      video: "",
      sets: [{ reps: 8, weight: "" }]
    };

    setPlan((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) =>
        w.id === workout.id
          ? { ...w, exercises: [...w.exercises, newExercise] }
          : w
      )
    }));
  }}
>
  ➕ Добавить упражнение
</button>
          </div>
        ))}
        <button
  className="bigButton"
  onClick={() => {
    const newWorkout = {
      id: "w" + Date.now(),
      name: "Новая тренировка",
      exercises: []
    };

    setPlan((prev) => ({
      ...prev,
      workouts: [...prev.workouts, newWorkout]
    }));
  }}
>
  ➕ Добавить тренировку
</button>
        <button className="bigButton" onClick={saveWorkoutsToFirebase}>
  💾 Сохранить изменения
</button>
      </div>
    );
  }

  if (page === "workouts" && !selectedWorkoutId) {
    return (
      <div className="menuPage">
        <h1 className="menuTitle">Выбери тренировку</h1>

        <div className="menuButtons">
          {plan.workouts.map((w) => (
            <button
              className="bigButton"
              key={w.id}
              onClick={() => openWorkout(w.id)}
            >
              🏋️ {w.name}
            </button>
          ))}

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

  if (!workout) {
    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn" onClick={() => setSelectedWorkoutId(null)}>
            ← Назад
          </button>

          <h1 className="workoutTitle">Тренировка не найдена</h1>
        </div>
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

          <div className="previousInfo subtle">
            {getLastExerciseText(e.name)}
          </div>

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