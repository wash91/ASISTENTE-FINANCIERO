import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
/* eslint-disable react-refresh/only-export-components */
import ServicioModal from "../components/ServicioModal";

export const CATEGORIAS = [
  { key: "declaraciones-sri", label: "Declaraciones SRI",   color: "#00B894" },
  { key: "iess-laboral",      label: "IESS / Laboral",      color: "#4A90D9" },
  { key: "societario",        label: "Societario",           color: "#F9C74F" },
  { key: "documentacion",     label: "Documentación",        color: "#FF6B6B" },
  { key: "proyectos",         label: "Proyectos Especiales", color: "#a855f7" },
  { key: "otro",              label: "Otro",                 color: "#7A8BAA" },
];
import "./Servicios.css";

// Iconos por categoría
const CAT_ICONS = {
  "declaraciones-sri": "📋",
  "iess-laboral":      "👥",
  "societario":        "🏢",
  "documentacion":     "📄",
  "proyectos":         "⚖",
  "otro":              "⊞",
};

function getCat(key) {
  return CATEGORIAS.find(c => c.key === key) || CATEGORIAS[CATEGORIAS.length - 1];
}

export default function Servicios() {
  const { empresaId } = useAuth();
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [modal, setModal] = useState(null);       // null | "nuevo" | servicio objeto
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Suscripción en tiempo real
  useEffect(() => {
    if (!empresaId) return;
    const ref = collection(db, "empresas", empresaId, "servicios");
    const unsub = onSnapshot(ref, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        if (a.categoria !== b.categoria) return (a.categoria || "").localeCompare(b.categoria || "");
        return (a.nombre || "").localeCompare(b.nombre || "");
      });
      setServicios(data);
      setLoading(false);
    });
    return unsub;
  }, [empresaId]);

  // Filtrado local
  const filtered = servicios
    .filter(s => filtroCategoria === "todas" || s.categoria === filtroCategoria)
    .filter(s => filtroEstado === "todos" || s.estado === filtroEstado)
    .filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        s.nombre?.toLowerCase().includes(q) ||
        s.descripcion?.toLowerCase().includes(q)
      );
    });

  const totalActivos = servicios.filter(s => s.estado === "activo").length;

  async function handleSave(data) {
    if (data.id) {
      const { id, createdAt: _c, ...rest } = data;
      const ref = doc(db, "empresas", empresaId, "servicios", id);
      await updateDoc(ref, { ...rest, updatedAt: serverTimestamp() });
    } else {
      const ref = collection(db, "empresas", empresaId, "servicios");
      await addDoc(ref, { ...data, createdAt: serverTimestamp() });
    }
    setModal(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "empresas", empresaId, "servicios", deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="servicios-page animate-fadeUp">
      {/* Header */}
      <div className="servicios-header">
        <div>
          <h2 className="section-title">Catálogo de Servicios</h2>
          <p className="section-sub">
            {loading
              ? "Cargando..."
              : `${totalActivos} activos · ${servicios.length} en total`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal("nuevo")}>
          + Nuevo Servicio
        </button>
      </div>

      {/* Toolbar */}
      <div className="servicios-toolbar">
        {/* Búsqueda */}
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Buscar servicio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filtro categoría */}
        <select
          className="form-input"
          style={{ width: "auto", padding: "9px 14px" }}
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
        >
          <option value="todas">Todas las categorías</option>
          {CATEGORIAS.map(c => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>

        {/* Filtro estado */}
        <div className="filter-tabs">
          {[
            { key: "todos",    label: "Todos" },
            { key: "activo",   label: "Activos" },
            { key: "inactivo", label: "Inactivos" },
          ].map(f => (
            <button
              key={f.key}
              className={`filter-tab ${filtroEstado === f.key ? "active" : ""}`}
              onClick={() => setFiltroEstado(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="servicios-empty">
          <div className="empty-icon">⊞</div>
          Cargando servicios...
        </div>
      ) : filtered.length === 0 ? (
        <div className="servicios-empty">
          <div className="empty-icon">⊞</div>
          <div>
            {search
              ? "No se encontraron servicios con esa búsqueda."
              : "No hay servicios que coincidan con los filtros."}
          </div>
          {!search && filtroCategoria === "todas" && filtroEstado === "todos" && (
            <button className="btn btn-primary" onClick={() => setModal("nuevo")}>
              Crear primer servicio
            </button>
          )}
        </div>
      ) : (
        <div className="servicios-table">
          {/* Cabecera */}
          <div className="s-table-head">
            <div>Servicio</div>
            <div>Categoría</div>
            <div>Precio Base</div>
            <div>Estado</div>
            <div></div>
          </div>

          {/* Filas */}
          {filtered.map(s => {
            const cat = getCat(s.categoria);
            return (
              <div className="s-table-row" key={s.id}>
                {/* Servicio */}
                <div className="servicio-cell">
                  <div
                    className="servicio-icon"
                    style={{ background: `${cat.color}18`, color: cat.color }}
                  >
                    {CAT_ICONS[s.categoria] || "⊞"}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="servicio-nombre">{s.nombre}</div>
                    {s.descripcion && (
                      <div className="servicio-desc">{s.descripcion}</div>
                    )}
                  </div>
                </div>

                {/* Categoría */}
                <div>
                  <span
                    className="cat-badge"
                    style={{
                      background: `${cat.color}15`,
                      color: cat.color,
                      border: `1px solid ${cat.color}30`,
                    }}
                  >
                    {cat.label}
                  </span>
                </div>

                {/* Precio */}
                <div className="precio-cell">
                  <div className="precio-valor">
                    ${s.precioBase != null ? s.precioBase.toFixed(2) : "—"}
                  </div>
                  <div className="precio-label">mínimo</div>
                </div>

                {/* Estado */}
                <div>
                  <span className={`badge badge-${s.estado === "activo" ? "ok" : "warn"}`}>
                    {s.estado === "activo" ? "Activo" : "Inactivo"}
                  </span>
                </div>

                {/* Acciones */}
                <div className="s-cell-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setModal(s)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setDeleteTarget(s)}
                    title="Eliminar servicio"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <ServicioModal
          servicio={modal === "nuevo" ? null : modal}
          categorias={CATEGORIAS}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Confirmación de eliminación */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">¿Eliminar servicio?</div>
            <div className="confirm-sub">
              Esta acción eliminará <strong>{deleteTarget.nombre}</strong> del catálogo.
              Los clientes que ya tienen este servicio asignado no se verán afectados.
            </div>
            <div className="confirm-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
