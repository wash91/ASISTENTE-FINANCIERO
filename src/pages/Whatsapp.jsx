import { useState, useEffect } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import WhatsappModal from "../components/WhatsappModal";
import UsarPlantillaModal from "../components/UsarPlantillaModal";
import "./Whatsapp.css";

export const CATEGORIAS_WA = [
  { key: "cobro",       label: "Cobros",       color: "#FF6B6B" },
  { key: "vencimiento", label: "Vencimiento",  color: "#F9C74F" },
  { key: "declaracion", label: "Declaración",  color: "#4A90D9" },
  { key: "general",     label: "General",      color: "#7A8BAA" },
];

function getVars(cuerpo) {
  return [...new Set((cuerpo || "").match(/\{\{(\w+)\}\}/g) || [])];
}

function getCat(key) {
  return CATEGORIAS_WA.find(c => c.key === key) || CATEGORIAS_WA[3];
}

export default function Whatsapp() {
  const { empresaId } = useAuth();
  const [plantillas, setPlantillas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [modal, setModal] = useState(null);       // null | "nuevo" | plantillaObj
  const [usarTarget, setUsarTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Suscripción a plantillas
  useEffect(() => {
    if (!empresaId) return;
    const ref = collection(db, "empresas", empresaId, "plantillasWhatsApp");
    const unsub = onSnapshot(ref, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      setPlantillas(data);
      setLoading(false);
    });
    return unsub;
  }, [empresaId]);

  // Suscripción a clientes activos (para UsarPlantillaModal)
  useEffect(() => {
    if (!empresaId) return;
    const ref = collection(db, "empresas", empresaId, "clientes");
    const unsub = onSnapshot(ref, snap => {
      setClientes(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => c.estado === "activo")
          .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""))
      );
    });
    return unsub;
  }, [empresaId]);

  // Filtrado local
  const filtered = plantillas
    .filter(p => filtro === "todos" || p.estado === filtro)
    .filter(p => filtroCategoria === "todas" || p.categoria === filtroCategoria)
    .filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.nombre?.toLowerCase().includes(q) ||
        p.cuerpo?.toLowerCase().includes(q)
      );
    });

  async function handleSave(data) {
    if (data.id) {
      const { id, createdAt: _c, ...rest } = data;
      const ref = doc(db, "empresas", empresaId, "plantillasWhatsApp", id);
      await updateDoc(ref, { ...rest, updatedAt: serverTimestamp() });
    } else {
      const ref = collection(db, "empresas", empresaId, "plantillasWhatsApp");
      await addDoc(ref, { ...data, createdAt: serverTimestamp() });
    }
    setModal(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "empresas", empresaId, "plantillasWhatsApp", deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="wa-page animate-fadeUp">
      {/* Header */}
      <div className="wa-header">
        <div>
          <h2 className="section-title">Plantillas WhatsApp</h2>
          <p className="section-sub">
            {loading
              ? "Cargando..."
              : `${plantillas.filter(p => p.estado === "activo").length} activas · ${plantillas.length} en total`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal("nuevo")}>
          + Nueva Plantilla
        </button>
      </div>

      {/* Toolbar */}
      <div className="wa-toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Buscar por nombre o contenido..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {[
            { key: "todos",    label: "Todas" },
            { key: "activo",   label: "Activas" },
            { key: "inactivo", label: "Inactivas" },
          ].map(f => (
            <button
              key={f.key}
              className={`filter-tab ${filtro === f.key ? "active" : ""}`}
              onClick={() => setFiltro(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          className="form-input wa-cat-filter"
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
        >
          <option value="todas">Todas las categorías</option>
          {CATEGORIAS_WA.map(c => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="wa-empty">
          <div className="empty-icon">◈</div>
          Cargando plantillas...
        </div>
      ) : filtered.length === 0 ? (
        <div className="wa-empty">
          <div className="empty-icon">◈</div>
          <div>
            {search
              ? "No se encontraron resultados para tu búsqueda."
              : filtro !== "todos"
                ? `No hay plantillas ${filtro === "activo" ? "activas" : "inactivas"}.`
                : "Aún no hay plantillas registradas."}
          </div>
          {!search && filtro === "todos" && (
            <button className="btn btn-primary" onClick={() => setModal("nuevo")}>
              Crear primera plantilla
            </button>
          )}
        </div>
      ) : (
        <div className="wa-table">
          {/* Cabecera */}
          <div className="wa-table-head">
            <div>Plantilla</div>
            <div>Categoría</div>
            <div>Variables</div>
            <div>Estado</div>
            <div></div>
          </div>

          {/* Filas */}
          {filtered.map(p => {
            const cat  = getCat(p.categoria);
            const vars = getVars(p.cuerpo);
            return (
              <div className="wa-table-row" key={p.id}>
                {/* Plantilla */}
                <div className="wa-name-cell">
                  <div className="wa-icon">💬</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="wa-nombre">{p.nombre}</div>
                    <div className="wa-preview">{p.cuerpo}</div>
                  </div>
                </div>

                {/* Categoría */}
                <div className="wa-cat-cell">
                  <span className="wa-cat-dot" style={{ background: cat.color }} />
                  {cat.label}
                </div>

                {/* Variables */}
                <div className="wa-vars-cell">
                  {vars.length === 0 ? (
                    <span style={{ color: "var(--text-dim)", fontSize: "12px" }}>—</span>
                  ) : (
                    <>
                      {vars.slice(0, 2).map(v => (
                        <span key={v} className="wa-var-chip">{v}</span>
                      ))}
                      {vars.length > 2 && (
                        <span className="wa-var-chip wa-var-more">+{vars.length - 2}</span>
                      )}
                    </>
                  )}
                </div>

                {/* Estado */}
                <div>
                  <span className={`badge badge-${p.estado === "activo" ? "ok" : "warn"}`}>
                    {p.estado === "activo" ? "Activa" : "Inactiva"}
                  </span>
                </div>

                {/* Acciones */}
                <div className="cell-actions">
                  <button
                    className="btn btn-ghost btn-sm wa-usar-btn"
                    onClick={() => setUsarTarget(p)}
                    disabled={p.estado !== "activo"}
                    title="Usar plantilla"
                  >
                    Usar
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setModal(p)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setDeleteTarget(p)}
                    title="Eliminar plantilla"
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
        <WhatsappModal
          plantilla={modal === "nuevo" ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Modal usar plantilla */}
      {usarTarget && (
        <UsarPlantillaModal
          plantilla={usarTarget}
          clientes={clientes}
          onClose={() => setUsarTarget(null)}
        />
      )}

      {/* Confirmación de eliminación */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">¿Eliminar plantilla?</div>
            <div className="confirm-sub">
              Se eliminará <strong>{deleteTarget.nombre}</strong> permanentemente.
              Esta acción no se puede deshacer.
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
