import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetMsg, setResetMsg]   = useState("");

  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !password) {
      setError("Por favor ingresa tu correo y contraseña.");
      return;
    }
    try {
      setError("");
      setLoading(true);
      await login(email, password);
      navigate("/");
    } catch (err) {
      switch (err.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setError("Correo o contraseña incorrectos.");
          break;
        case "auth/too-many-requests":
          setError("Demasiados intentos. Espera unos minutos.");
          break;
        default:
          setError("Error al iniciar sesión. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (!email) {
      setError("Ingresa tu correo para recuperar la contraseña.");
      return;
    }
    try {
      setLoading(true);
      await resetPassword(email);
      setResetMsg("Correo de recuperación enviado. Revisa tu bandeja.");
      setError("");
    } catch {
      setError("No se pudo enviar el correo. Verifica el email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* Fondo decorativo */}
      <div className="login-bg">
        <div className="login-blob login-blob-1" />
        <div className="login-blob login-blob-2" />
        <div className="login-grid" />
      </div>

      <div className="login-container">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">📊</div>
          <div>
            <div className="login-logo-text">
              Asistente <span>Financiero</span>
            </div>
            <div className="login-logo-sub">Sistema de Gestión Contable</div>
          </div>
        </div>

        {/* Card */}
        <div className="login-card">
          <div className="login-card-header">
            <h2 className="login-title">
              {showReset ? "Recuperar contraseña" : "Bienvenido de vuelta"}
            </h2>
            <p className="login-subtitle">
              {showReset
                ? "Ingresa tu correo y te enviamos el enlace"
                : "Ingresa tus credenciales para continuar"}
            </p>
          </div>

          <form onSubmit={showReset ? handleReset : handleLogin} className="login-form">
            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <div className="input-wrap">
                <span className="input-icon">✉</span>
                <input
                  type="email"
                  className={`form-input with-icon ${error ? "error" : ""}`}
                  placeholder="tucorreo@empresa.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  autoComplete="email"
                />
              </div>
            </div>

            {!showReset && (
              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <div className="input-wrap">
                  <span className="input-icon">🔒</span>
                  <input
                    type="password"
                    className={`form-input with-icon ${error ? "error" : ""}`}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    autoComplete="current-password"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="login-error">
                ⚠ {error}
              </div>
            )}

            {resetMsg && (
              <div className="login-success">
                ✓ {resetMsg}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary login-btn"
              disabled={loading}
            >
              {loading
                ? "Procesando..."
                : showReset
                  ? "Enviar correo de recuperación"
                  : "Iniciar Sesión"}
            </button>
          </form>

          <div className="login-footer">
            {showReset ? (
              <button
                className="login-link"
                onClick={() => { setShowReset(false); setError(""); setResetMsg(""); }}
              >
                ← Volver al login
              </button>
            ) : (
              <button
                className="login-link"
                onClick={() => { setShowReset(true); setError(""); }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>
        </div>

        <p className="login-version">Asistente Financiero v1.0 · Macas, Ecuador 🇪🇨</p>
      </div>
    </div>
  );
}
