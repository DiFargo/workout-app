import { Component } from "react";

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
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 20,
          background: "#0b0f0d",
          color: "#f7f8f5",
          fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        }}
      >
        <section
          style={{
            width: "min(420px, 100%)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 24,
            padding: 22,
            background: "rgba(255,255,255,0.055)",
            boxShadow: "0 22px 55px rgba(0,0,0,0.34)"
          }}
        >
          <p style={{ margin: "0 0 8px", color: "rgba(255,255,255,0.58)", fontSize: 13, fontWeight: 800 }}>
            Ошибка интерфейса
          </p>
          <h1 style={{ margin: "0 0 10px", fontSize: 24, lineHeight: 1.08 }}>
            Экран не загрузился
          </h1>
          <p style={{ margin: "0 0 18px", color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}>
            Перезагрузи приложение. Если ошибка повторится, открой консоль и пришли текст ошибки.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              width: "100%",
              minHeight: 48,
              border: 0,
              borderRadius: 16,
              background: "#9d7cff",
              color: "#fff",
              fontSize: 15,
              fontWeight: 900,
              cursor: "pointer"
            }}
          >
            Перезагрузить
          </button>
        </section>
      </main>
    );
  }
}
