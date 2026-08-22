import { Component } from "react";
import { reportClientError } from "../../utils/errorReporting";
import styles from "./AppErrorBoundary.module.css";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("App runtime error:", error, info);
    void reportClientError(error, { source: "react.error-boundary", feature: "app-shell" });
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className={styles.root}>
        <section className={styles.card}>
          <p className={styles.eyebrow}>Ошибка интерфейса</p>
          <h1 className={styles.title}>Экран не загрузился</h1>
          <p className={styles.copy}>
            Перезагрузи приложение. Если ошибка повторится, открой консоль и пришли текст ошибки.
          </p>
          <button
            type="button"
            className={styles.reload}
            onClick={() => window.location.reload()}
          >
            Перезагрузить
          </button>
        </section>
      </main>
    );
  }
}
