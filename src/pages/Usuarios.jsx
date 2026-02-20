import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import UsuarioModal from "../components/UsuarioModal";
import "./Usuarios.css";

export default function Usuarios() {
  const { userProfile, empresaId } = useAuth();
  const isAdmin = userProfile?.rol === "admin";

  const [usuarios, setUsuarios] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  useEffect(() => {
    if (!empresaId) return;
    const ref = collection(db, "empresas", empresaId, "usuarios");
    const unsub = onSnapshot(ref, snap => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [empresaId]);

  async function toggleEstado(usuario) {
    const nuevoEstado = usuario.estado === "activo" ? "inactivo" : "activo";
    const ref = doc(db, "empresas", empresaId, "usuarios", usuario.id);
    await updateDoc(ref, { estado: nuevoEstado, updatedAt: serverTimestamp() });
  }

  function handleEdit(usuario) {
    setEditTarget(usuario);
    setShowModal(true);
  }

  function handleNuevo() {
    setEditTarget(null);
    setShowModal(true);
  }

  const activos = usuarios.filter(u => u.estado === "activo").length;

  if (!isAdmin) {
    return (
      <div className="usuarios-page animate-fadeUp">
        <div className="acceso-restringido card">
          <div className="acceso-icon">🔒</div>
          <h2 className="acceso-title">Acceso Restringido</h2>
          <p className="acceso-sub">
            Solo los administradores pueden gestionar usuarios del sistema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="usuarios-page animate-fadeUp">
      {/* Header */}
      <div className="usuarios-header">
        <div>
          <h1 className="section-title">Gestión de Usuarios</h1>
          <p className="section-sub">
            {activos} activo{activos !== 1 ? "s" : ""} · {usuarios.length} en total
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleNuevo}>
          + Nuevo Usuario
        </button>
      </div>

      {/* Tabla */}
      <div className="usuarios-card card">
        {usuarios.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◎</div>
            <p className="empty-title">Sin usuarios registrados</p>
            <p className="empty-sub">
              Crea el primer usuario del equipo para comenzar.
            </p>
          </div>
        ) : (
          <table className="usuarios-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => {
                const isSelf = u.id === userProfile?.uid;
                const initials = u.nombre
                  ? u.nombre.substring(0, 2).toUpperCase()
                  : "??";
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <div className={`user-av ${u.rol === "admin" ? "av-admin" : "av-user"}`}>
                          {initials}
                        </div>
                        <div>
                          <div className="user-cell-name">
                            {u.nombre}
                            {isSelf && <span className="self-tag">tú</span>}
                          </div>
                          <div className="user-cell-email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.rol === "admin" ? "badge-ok" : "badge-blue"}`}>
                        {u.rol === "admin" ? "Administrador" : "Usuario"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.estado === "activo" ? "badge-ok" : "badge-warn"}`}>
                        <span className={`estado-dot ${u.estado === "activo" ? "dot-green" : "dot-amber"}`} />
                        {u.estado === "activo" ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleEdit(u)}
                          disabled={isSelf}
                          title={isSelf ? "No puedes editar tu propio perfil aquí" : "Editar"}
                        >
                          Editar
                        </button>
                        <button
                          className={`btn btn-sm ${u.estado === "activo" ? "btn-danger" : "btn-ghost"}`}
                          onClick={() => toggleEstado(u)}
                          disabled={isSelf}
                          title={isSelf ? "No puedes desactivarte a ti mismo" : ""}
                        >
                          {u.estado === "activo" ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <UsuarioModal
          editTarget={editTarget}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
