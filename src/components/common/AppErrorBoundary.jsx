import { Component } from "react";
import { reportClientError } from "../../utils/errorReporting";
import styles from "./AppErrorBoundary.module.css";
import { auth } from "../../firebase.js";
import { createRuntimeDiagnostic, rememberRuntimeDiagnostic } from "../../utils/runtimeDiagnostics.js";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, sending: false, sent: false, reportStatus: "" };
    this.diagnostic = null;
    this.ownerUid = "";
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.ownerUid = auth.currentUser?.uid || "";
    this.diagnostic = createRuntimeDiagnostic(error, {
      feature: window.history.state?.workoutAppPage,
      version: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown"
    });
    rememberRuntimeDiagnostic(this.ownerUid, this.diagnostic);
    console.error("App runtime error:", error, info);
    void reportClientError(error, { source: "react.error-boundary", feature: "app-shell" });
  }

  sendReport = async () => {
    if (this.state.sending || this.state.sent || !this.diagnostic) return;
    this.setState({ sending: true, reportStatus: "" });
    try {
      const { sendRuntimeDiagnostic } = await import("../../utils/sendRuntimeDiagnostic.js");
      await (this.props.sendDiagnostic || sendRuntimeDiagnostic)(this.diagnostic, this.ownerUid);
      this.setState({ sent: true, reportStatus: "Отчёт отправлен администратору. Спасибо!" });
    } catch {
      this.setState({ reportStatus: "Не удалось подтвердить отправку. Проверьте интернет и повторите — отчёт остался на этом экране." });
    } finally { this.setState({ sending: false }); }
  };

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
            Отправь технический отчёт — администратор сможет разобраться без консоли. Затем попробуй перезагрузить приложение.
          </p>
          <button
            type="button"
            className={styles.reload}
            onClick={() => window.location.reload()}
          >
            Перезагрузить
          </button>
          <button type="button" className={styles.report} disabled={this.state.sending || this.state.sent} onClick={this.sendReport}>
            {this.state.sent ? "Отчёт отправлен" : this.state.sending ? "Отправляем…" : "Отправить отчёт администратору"}
          </button>
          <p className={styles.privacy}>Только технические сведения о сбое. Без содержимого дневника, фото, сообщений и паролей. Данные приложения не очищаются.</p>
          {this.state.reportStatus ? <p className={styles.reportStatus} role="status">{this.state.reportStatus}</p> : null}
        </section>
      </main>
    );
  }
}
