import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";

import { auth, db, storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

import { collection, getDocs, doc, setDoc, addDoc } from "firebase/firestore";

const STORAGE_KEY = "workout_tracker_v1";
const ADMIN_EMAIL = "work.kriptonit.il@gmail.com";

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
          video: "",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e9",
          name: "Тяга нижнего блока",
          video: "",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e10",
          name: "Жим лежа в тренажере",
          video: "",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e11",
          name: "Вертикальный жим с гантелями",
          video: "",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e12",
          name: "Разгибание рук в тренажере",
          video: "",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e13",
          name: "Сгибание рук в кроссовере",
          video: "",
          sets: [{ reps: 8, weight: "" }]
        },
        {
          id: "e14",
          name: "Пресс",
          video: "",
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
  const [fullscreenVideo, setFullscreenVideo] = useState(null);

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [usersList, setUsersList] = useState([]);

  const [isSaving, setIsSaving] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openHistoryKey, setOpenHistoryKey] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoggedIn(!!u);

      if (u) {
        loadHistory();
        loadWorkoutsFromFirebase(u.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  useEffect(() => {
    if (page === "admin") {
      loadUsers();
    }
  }, [page]);

  const workout = useMemo(() => {
    return plan.workouts.find((w) => w.id === selectedWorkoutId);
  }, [selectedWorkoutId, plan]);

  const lastExerciseResults = useMemo(() => {
    const result = {};

    history.forEach((historyWorkout) => {
      if (!historyWorkout.exercises) return;

      historyWorkout.exercises.forEach((exercise) => {
        if (!exercise.name || result[exercise.name]) return;

        const lastSet = exercise.sets?.[exercise.sets.length - 1];

        result[exercise.name] = {
          reps: lastSet?.reps || "",
          weight: lastSet?.weight || "",
          date: historyWorkout.date
        };
      });
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
      const result = await signInWithEmailAndPassword(auth, login, password);

      setPage("main");
      setLoginError("");
      setSelectedUserId(null);

      loadHistory();
      loadWorkoutsFromFirebase(result.user.uid);
    } catch {
      setLoginError("Неверный email или пароль");
    }
  }

  async function handleRegister() {
    try {
      const result = await createUserWithEmailAndPassword(auth, login, password);

      await setDoc(doc(db, "users", result.user.uid), {
        email: login,
        role: login === ADMIN_EMAIL ? "admin" : "client"
      });

      setLoginError("");
      setPage("main");
      setSelectedUserId(null);

      loadHistory();
      loadWorkoutsFromFirebase(result.user.uid);
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
    setFullscreenVideo(null);
    setOpenHistoryKey(null);
    setSelectedUserId(null);
    setLogin("");
    setPassword("");
    setLoginError("");
    setHistory([]);
  }

  function goBackToMain() {
    setPage("main");
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
    setFullscreenVideo(null);
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

  async function saveWorkoutToFirebase() {
    if (!workout) return;

    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Пользователь не найден");
      return;
    }

    setIsSaving(true);

    try {
      await addDoc(collection(db, "users", currentUser.uid, "history"), {
        date: new Date().toISOString(),
        userEmail: currentUser.email || "",
        workout: workout.name,
        exercises: workout.exercises.map((exercise) => ({
          name: exercise.name,
          video: exercise.video || "",
          sets: exercise.sets.map((set, index) => ({
            set: index + 1,
            reps: set.reps,
            weight: set.weight
          }))
        }))
      });

      alert("Тренировка сохранена в Firebase ✅");
      resetWorkout();
      loadHistory();
    } catch (e) {
      console.log(e);
      alert("Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  }

  async function loadWorkoutsFromFirebase(userIdFromClick) {
    try {
      const userId = userIdFromClick || selectedUserId || auth.currentUser?.uid;

      if (!userId) return;

      const querySnapshot = await getDocs(
        collection(db, "users", userId, "workouts")
      );

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
      } else {
        setPlan(starterPlan);
      }
    } catch (err) {
      console.log("Ошибка загрузки тренировок:", err);
    }
  }

  async function saveWorkoutsToFirebase() {
    try {
      const userId = selectedUserId || auth.currentUser?.uid;

      if (!userId) {
        alert("Пользователь не найден");
        return;
      }

      for (const workout of plan.workouts) {
        await setDoc(doc(db, "users", userId, "workouts", workout.id), {
          name: workout.name,
          exercises: workout.exercises.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            video: exercise.video || "",
            sets: exercise.sets || [{ reps: 8, weight: "" }]
          }))
        });
      }

      alert("Тренировки пользователя сохранены в Firebase ✅");
    } catch (err) {
      console.log("Ошибка сохранения тренировок:", err);
      alert("Не получилось сохранить тренировки");
    }
  }

  async function loadUsers() {
    try {
      const snapshot = await getDocs(collection(db, "users"));

      const users = [];

      snapshot.forEach((doc) => {
        users.push({
          id: doc.id,
          ...doc.data()
        });
      });

      setUsersList(users);
    } catch (err) {
      console.log("Ошибка загрузки пользователей:", err);
    }
  }

  async function loadHistory() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      console.log("Пользователь ещё не загружен");
      return;
    }

    setHistoryLoading(true);

    try {
      const snapshot = await getDocs(
        collection(db, "users", currentUser.uid, "history")
      );

      const workouts = [];

      snapshot.forEach((doc) => {
        workouts.push({
          id: doc.id,
          ...doc.data()
        });
      });

      workouts.sort((a, b) => new Date(b.date) - new Date(a.date));

      setHistory(workouts);
    } catch (err) {
      console.log("Ошибка загрузки истории:", err);
      alert("Не получилось загрузить историю");
    } finally {
      setHistoryLoading(false);
    }
  }

  function openHistory() {
    setPage("history");
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
    setFullscreenVideo(null);
    setOpenHistoryKey(null);
    loadHistory();
  }

  function openWorkout(id) {
    setSelectedWorkoutId(id);
    setOpenVideoId(null);
    setFullscreenVideo(null);
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

          <button
            className="bigButton"
            onClick={() => {
              loadHistory();
              setPage("profile");
            }}
          >
            👤 Личный кабинет
          </button>

          {user?.email === ADMIN_EMAIL && (
            <button
              className="bigButton"
              onClick={() => {
                setSelectedUserId(null);
                setPage("admin");
              }}
            >
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

  if (page === "profile") {
    const totalWorkouts = history.length;
    const lastWorkout = history[0];
    const exerciseStats = {};

    [...history].reverse().forEach((historyWorkout) => {
      historyWorkout.exercises?.forEach((exercise) => {
        if (!exerciseStats[exercise.name]) {
          exerciseStats[exercise.name] = {
            count: 0,
            bestWeight: 0,
            firstWeight: null,
            lastWeight: 0,
            lastResult: ""
          };
        }

        exercise.sets?.forEach((set) => {
          const weight = Number(set.weight) || 0;
          const reps = Number(set.reps) || 0;

          exerciseStats[exercise.name].count += 1;

          if (exerciseStats[exercise.name].firstWeight === null && weight > 0) {
            exerciseStats[exercise.name].firstWeight = weight;
          }

          if (weight > exerciseStats[exercise.name].bestWeight) {
            exerciseStats[exercise.name].bestWeight = weight;
          }

          exerciseStats[exercise.name].lastWeight = weight;
          exerciseStats[exercise.name].lastResult = `${reps} × ${
            set.weight || "без веса"
          }`;
        });
      });
    });

    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn" onClick={goBackToMain}>
            ← Назад
          </button>

          <h1 className="workoutTitle">Личный кабинет</h1>
        </div>

        <div className="exercise">
          <h3>Профиль</h3>

          <p style={{ textAlign: "center", color: "#aaa" }}>
            {auth.currentUser?.email}
          </p>

          <div className="historySets">
            <div className="historySet">
              <span>Всего тренировок</span>
              <strong>{totalWorkouts}</strong>
            </div>

            <div className="historySet">
              <span>Последняя тренировка</span>
              <strong>
                {lastWorkout
                  ? new Date(lastWorkout.date).toLocaleDateString("ru-RU")
                  : "нет данных"}
              </strong>
            </div>
          </div>
        </div>

        <div className="exercise">
          <h3>Прогресс по упражнениям</h3>

          {Object.keys(exerciseStats).length === 0 && (
            <p style={{ textAlign: "center", color: "#aaa" }}>
              Пока нет данных для прогресса
            </p>
          )}

          {Object.entries(exerciseStats).map(([name, stat]) => {
            const progress =
              stat.firstWeight && stat.lastWeight
                ? Math.round(
                    ((stat.lastWeight - stat.firstWeight) / stat.firstWeight) *
                      100
                  )
                : 0;

            return (
              <div className="historyExercise" key={name}>
                <h4>{name}</h4>

                <div className="historySets">
                  <div className="historySet">
                    <span>Лучший вес</span>
                    <strong>{stat.bestWeight || "нет"} кг</strong>
                  </div>

                  <div className="historySet">
                    <span>Прогресс</span>
                    <strong>
                      {progress > 0
                        ? `+${progress}%`
                        : progress < 0
                        ? `${progress}%`
                        : "0%"}
                    </strong>
                  </div>

                  <div className="historySet">
                    <span>Последний результат</span>
                    <strong>{stat.lastResult}</strong>
                  </div>

                  <div className="historySet">
                    <span>Всего подходов</span>
                    <strong>{stat.count}</strong>
                  </div>
                </div>
              </div>
            );
          })}
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

        {!historyLoading && history.length === 0 && (
          <div className="exercise">
            <h3>История пустая</h3>
            <p style={{ textAlign: "center", color: "#aaa" }}>
              Заверши тренировку, и она появится здесь.
            </p>
          </div>
        )}

        {!historyLoading &&
          history.map((item) => {
            const isOpen = openHistoryKey === item.id;
            const date = new Date(item.date).toLocaleDateString("ru-RU");

            return (
              <div className="historyCard" key={item.id}>
                <button
                  className="historyCardHeader"
                  onClick={() => setOpenHistoryKey(isOpen ? null : item.id)}
                >
                  <span>
                    {date} — {item.workout}
                  </span>
                  <strong>{isOpen ? "−" : "+"}</strong>
                </button>

                {isOpen && (
                  <div className="historyCardBody">
                    {item.exercises?.map((exercise, index) => (
                      <div className="historyExercise" key={index}>
                        <h4>{exercise.name}</h4>

                        <div className="historySets">
                          {exercise.sets?.map((set, setIndex) => (
                            <div className="historySet" key={setIndex}>
                              <span>Подход {set.set || setIndex + 1}</span>
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
            Здесь ты управляешь клиентами и тренировками
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              className="bigButton"
              onClick={() => {
                loadUsers();
                setPage("adminUsers");
              }}
            >
              👥 Пользователи
            </button>

            <button
              className="bigButton"
              onClick={() => {
                setSelectedUserId(auth.currentUser?.uid || null);
                loadWorkoutsFromFirebase(auth.currentUser?.uid);
                setPage("adminWorkouts");
              }}
            >
              🏋️ Мои тренировки
            </button>

            <button className="bigButton">📊 Статистика</button>
          </div>
        </div>
      </div>
    );
  }

  if (page === "adminUsers") {
    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn" onClick={() => setPage("admin")}>
            ← Назад
          </button>

          <h1 className="workoutTitle">Пользователи</h1>
        </div>

        <div className="exercise">
          <h3>Список пользователей</h3>

          {usersList.length === 0 && (
            <p style={{ textAlign: "center", color: "#aaa" }}>
              Пользователей пока нет
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {usersList.map((u) => (
              <button
                key={u.id}
                className="bigButton"
                onClick={() => {
                  setSelectedUserId(u.id);
                  loadWorkoutsFromFirebase(u.id);
                  setPage("adminWorkouts");
                }}
              >
                👤 {u.email || u.id}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (page === "adminWorkouts") {
    const selectedUser = usersList.find((u) => u.id === selectedUserId);

    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn" onClick={() => setPage("admin")}>
            ← Назад
          </button>

          <h1 className="workoutTitle">Управление тренировками</h1>
        </div>

        {selectedUserId && (
          <p style={{ textAlign: "center", color: "#aaa" }}>
            Клиент: {selectedUser?.email || selectedUserId}
          </p>
        )}

        {plan.workouts.map((workout) => (
          <div className="exercise" key={workout.id}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px",
                  borderRadius: "8px"
                }}
                value={workout.name}
                placeholder="Название тренировки"
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
                    workouts: prev.workouts.filter((w) => w.id !== workout.id)
                  }));
                }}
              >
                ✕
              </button>
            </div>

            {workout.exercises.map((exercise) => (
              <div
                key={exercise.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginBottom: "14px",
                  marginTop: "14px"
                }}
              >
                <div
                  style={{ display: "flex", gap: "10px", alignItems: "center" }}
                >
                  <input
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "10px",
                      borderRadius: "8px"
                    }}
                    value={exercise.name}
                    placeholder="Название упражнения"
                    onChange={(e) => {
                      const newName = e.target.value;

                      setPlan((prev) => ({
                        ...prev,
                        workouts: prev.workouts.map((w) =>
                          w.id === workout.id
                            ? {
                                ...w,
                                exercises: w.exercises.map((ex) =>
                                  ex.id === exercise.id
                                    ? { ...ex, name: newName }
                                    : ex
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
                                exercises: w.exercises.filter(
                                  (ex) => ex.id !== exercise.id
                                )
                              }
                            : w
                        )
                      }));
                    }}
                  >
                    ✕
                  </button>
                </div>

                <input
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    opacity: 0.85
                  }}
                  value={exercise.video || ""}
                  placeholder="Путь к видео или Firebase URL"
                  onChange={(e) => {
                    const newVideo = e.target.value;

                    setPlan((prev) => ({
                      ...prev,
                      workouts: prev.workouts.map((w) =>
                        w.id === workout.id
                          ? {
                              ...w,
                              exercises: w.exercises.map((ex) =>
                                ex.id === exercise.id
                                  ? { ...ex, video: newVideo }
                                  : ex
                              )
                            }
                          : w
                      )
                    }));
                  }}
                />

                <input
                  type="file"
                  accept="video/*"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    const storageRef = ref(
                      storage,
                      "videos/" + Date.now() + "-" + file.name
                    );

                    await uploadBytes(storageRef, file);

                    const url = await getDownloadURL(storageRef);

                    setPlan((prev) => ({
                      ...prev,
                      workouts: prev.workouts.map((w) =>
                        w.id === workout.id
                          ? {
                              ...w,
                              exercises: w.exercises.map((ex) =>
                                ex.id === exercise.id
                                  ? { ...ex, video: url }
                                  : ex
                              )
                            }
                          : w
                      )
                    }));

                    alert("Видео загружено ✅");
                  }}
                />

                {exercise.video && (
                  <video
                    src={exercise.video}
                    controls
                    style={{
                      width: "100%",
                      maxHeight: "220px",
                      borderRadius: "10px",
                      marginTop: "8px",
                      background: "#000"
                    }}
                  />
                )}
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
                <div
                  onClick={() => setFullscreenVideo(e.video)}
                  style={{ cursor: "pointer" }}
                >
                  <video className="exerciseVideo" src={e.video} controls />
                </div>
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
          onClick={saveWorkoutToFirebase}
          disabled={isSaving}
        >
          {isSaving ? "Сохраняю..." : "✅ Завершить тренировку"}
        </button>
      </div>

      {fullscreenVideo && (
        <div
          onClick={() => setFullscreenVideo(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
        >
          <button
            onClick={() => setFullscreenVideo(null)}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              fontSize: "28px",
              background: "none",
              color: "white",
              border: "none",
              cursor: "pointer"
            }}
          >
            ✕
          </button>

          <video
            src={fullscreenVideo}
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "900px",
              borderRadius: "12px"
            }}
          />
        </div>
      )}
    </div>
  );
}
