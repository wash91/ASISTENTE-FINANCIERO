import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signOut as secondarySignOut
} from "firebase/auth";
import {
  doc, setDoc, updateDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase/config";
import { secondaryAuth } from "../firebase/secondaryAuth";
import { useAuth } from "../context/AuthContext";
import "./UsuarioModal.css";

export default function UsuarioModal({ editTarget, onClose }) {
  const { empresaId, userProfile } = useAuth();
  const isEdit = !!editTarget;
  const isSelf = isEdit && editTarget.id === userProfile?.uid;

  const [form, setForm] = useState({
    nombre: editTarget?.nombre || "",
    email: editTarget?.email || "",
    password: "",
    rol: editTarget?.rol || "usuario",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(e => ({ ...e, [name]: "" }));
    if (serverError) setServerError("");
  }

  function validate() {
    const errs = {};
    if (!form.nombre.trim()) errs.nombre = "El nombre es requerido";
    if (!isEdit) {
      if (!form.email.trim()) {
        errs.email = "El email es requerido";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errs.email = "Email inválido";
      }
      if (!form.password) {
        errs.password = "La contraseña es requerida";
      } else if (form.password.length < 6) {
        errs.password = "Mínimo 6 caracteres";
      }
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setServerError("");

    try {
      if (isEdit) {
        // Editar: solo nombre y rol
        const ref = doc(db, "empresas", empresaId, "usuarios", editTarget.id);
        await updateDoc(ref, {
          nombre: form.nombre.trim(),
          ...(isSelf ? {} : { rol: form.rol }),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Crear: instancia secundaria para no cerrar sesión del admin
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          form.email.trim(),
          form.password
        );
        const uid = cred.user.uid;
        await secondarySignOut(secondaryAuth);

        // usuarios_index
        await setDoc(doc(db, "usuarios_index", uid), { empresaId });

        // perfil dentro de la empresa
        await setDoc(doc(db, "empresas", empresaId, "usuarios", uid), {
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          rol: form.rol,
          estado: "activo",
          createdAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
      const msgs = {
        "auth/email-already-in-use": "Este email ya está registrado.",
        "auth/invalid-email": "Email inválido.",
        "auth/weak-password": "Contraseña muy débil.",
      };
      setServerError(msgs[err.code] || "Error al guardar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="usuario-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? "Editar Usuario" : "Nuevo Usuario"}
          </h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {/* Nombre */}
            <div className="form-group">
              <label className="form-label">Nombre completo</label>
              <input
                name="nombre"
                className={`form-input ${errors.nombre ? "error" : ""}`}
                value={form.nombre}
                onChange={handleChange}
                placeholder="Ej: María González"
                autoFocus
              />
              {errors.nombre && <p className="field-error">{errors.nombre}</p>}
            </div>

            {/* Email — solo en creación */}
            {!isEdit && (
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  name="email"
                  type="email"
                  className={`form-input ${errors.email ? "error" : ""}`}
                  value={form.email}
                  onChange={handleChange}
                  placeholder="usuario@empresa.com"
                />
                {errors.email && <p className="field-error">{errors.email}</p>}
              </div>
            )}

            {/* Contraseña — solo en creación */}
            {!isEdit && (
              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input
                  name="password"
                  type="password"
                  className={`form-input ${errors.password ? "error" : ""}`}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                />
                {errors.password && <p className="field-error">{errors.password}</p>}
              </div>
            )}

            {/* Rol */}
            <div className="form-group">
              <label className="form-label">Rol</label>
              <select
                name="rol"
                className="form-input"
                value={form.rol}
                onChange={handleChange}
                disabled={isSelf}
              >
                <option value="usuario">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
              {isSelf && (
                <p className="field-note">No puedes cambiar tu propio rol.</p>
              )}
            </div>

            {serverError && (
              <div className="server-error">{serverError}</div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
