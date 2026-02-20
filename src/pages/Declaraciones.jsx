import { useState, useEffect } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import DeclaracionModal, {
  FORMULARIOS, getProgreso,
} from "../components/DeclaracionModal";
import "./Declaraciones.css";

const MESES = [
  "Ene","Feb","Mar","Abr","May","Jun",
  "Jul","Ago","Sep","Oct","Nov","Dic",
];

function formatPeriodo(periodo, formulario) {
  if (!periodo) return "—";
  const form = FORMULARIOS.find(f => f.key === formulario);
  const [anio, mes] = periodo.split("-");
  if (form?.periodicidad === "anual") return `Año ${anio}`;
  const m = parseInt(mes, 10);
  return `${MESES[m - 1] || mes} ${anio}`;
}

function getForm(key) {
  return FORMULARIOS.find(f => f.key === key) || FORMULARIOS[0];
}

function getInitials(nombre) {
  return (nombre || "?")
    .split(" ").filter(Boolean).slice(0, 2)
    .map(w => w[0]).join("").toUpperCase();
}

const ESTADO_CFG = {
  borrador:   { label: "Borrador",   badge: "warn", },
  listo:      { label: "Listo",      badge: "blue", },
  presentado: { label: "Presentado", badge: "ok",   },
};

export default function Declaraciones() {
  const { empresaId } = useAuth();
  const [declaraciones, setDeclaraciones] = useState([]);
  const [clientes,      setClientes]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filtro,        setFiltro]        = useState("todos");       // todos|borrador|listo|presentado
  const [filtroForm,    setFiltroForm]    = useState("todos");       // todos|104|103|101|102
  const [modal,         setModal]         = useState(null);          // null | "nuevo" | declaracion obj
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [deleting,      setDeleting]      = useState(false);

  // Suscripción a declaraciones
  useEffect(() => {
    if (!empresaId) return;
    const ref = collection(db, "empresas", empresaId, "declaraciones");
    const unsub = onSnapshot(ref, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        // Primero por estado (borrador > listo > presentado), luego por período desc
        const orden = { borrador: 0, listo: 1, presentado: 2 };
        if (a.estado !== b.estado) return (orden[a.estado] || 0) - (orden[b.estado] || 0);
        return (b.periodo || "").localeCompare(a.periodo || "");
      });
      setDeclaraciones(data);
      setLoading(false);
    });
    return unsub;
  }, [empresaId]);

  // Suscripción a clientes activos
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
  const filtered = declaraciones
    .filter(d => filtro === "todos" || d.estado === filtro)
    .filter(d => filtroForm === "todos" || d.formulario === filtroForm)
    .filter(d => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        d.clienteNombre?.toLowerCase().includes(q) ||
        d.clienteRuc?.includes(search)
      );
    });

  // Crear
  async function handleSave(data) {
    if (data.id) {
      // Actualizar checklist
      const { id, ...rest } = data;
      await updateDoc(
        doc(db, "empresas", empresaId, "declaraciones", id),
        { ...rest, updatedAt: serverTimestamp() }
      );
    } else {
      await addDoc(
        collection(db, "empresas", empresaId, "declaraciones"),
        { ...data, createdAt: serverTimestamp() }
      );
    }
    setModal(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "empresas", empresaId, "declaraciones", deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="decl-page animate-fadeUp">
      {/* Header */}
      <div className="decl-page-header">
        <div>
          <h2 className="section-title">Declaraciones SRI</h2>
          <p className="section-sub">
            {loading
              ? "Cargando..."
              : `${declaraciones.filter(d => d.estado !== "presentado").length} activas · ${declaraciones.length} en total`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal("nuevo")}>
          + Nueva Declaración
        </button>
      </div>

      {/* Toolbar */}
      <div className="decl-toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Buscar por cliente o RUC..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {[
            { key: "todos",      label: "Todas" },
            { key: "borrador",   label: "Borrador" },
            { key: "listo",      label: "Listo" },
            { key: "presentado", label: "Presentado" },
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
          className="form-input decl-form-filter"
          value={filtroForm}
          onChange={e => setFiltroForm(e.target.value)}
        >
          <option value="todos">Todos los formularios</option>
          {FORMULARIOS.map(f => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="decl-empty">
          <div className="empty-icon">◈</div>
          Cargando declaraciones...
        </div>
      ) : filtered.length === 0 ? (
        <div className="decl-empty">
          <div className="empty-icon">◈</div>
          <div>
            {search
              ? "No se encontraron resultados."
              : filtro !== "todos"
                ? `No hay declaraciones en estado "${filtro}".`
                : "Aún no hay declaraciones registradas."}
          </div>
          {!search && filtro === "todos" && (
            <button className="btn btn-primary" onClick={() => setModal("nuevo")}>
              Crear primera declaración
            </button>
          )}
        </div>
      ) : (
        <div className="decl-table">
          {/* Cabecera */}
          <div className="decl-table-head">
            <div>Cliente</div>
            <div>Formulario</div>
            <div>Período</div>
            <div>Progreso</div>
            <div>Estado</div>
            <div></div>
          </div>

          {/* Filas */}
          {filtered.map(d => {
            const form     = getForm(d.formulario);
            const progreso = getProgreso(d.checklist);
            const estadoCfg = ESTADO_CFG[d.estado] || ESTADO_CFG.borrador;
            return (
              <div className="decl-table-row" key={d.id}>
                {/* Cliente */}
                <div className="decl-client-cell">
                  <div className="decl-av">{getInitials(d.clienteNombre)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="decl-client-nombre">{d.clienteNombre}</div>
                    <div className="decl-client-ruc">{d.clienteRuc || "Sin RUC"}</div>
                  </div>
                </div>

                {/* Formulario */}
                <div>
                  <span
                    className="decl-form-tag"
                    style={{ background: `${form.color}1a`, color: form.color, borderColor: `${form.color}40` }}
                  >
                    F.{d.formulario}
                  </span>
                </div>

                {/* Período */}
                <div className="decl-periodo">
                  {formatPeriodo(d.periodo, d.formulario)}
                </div>

                {/* Progreso */}
                <div className="decl-prog-cell">
                  <div className="decl-prog-bar-wrap">
                    <div className="decl-prog-bar">
                      <div
                        className="decl-prog-fill"
                        style={{ width: `${progreso.pct}%` }}
                      />
                    </div>
                    <span className="decl-prog-txt">
                      {progreso.completados}/{progreso.total}
                    </span>
                  </div>
                </div>

                {/* Estado */}
                <div>
                  <span className={`badge badge-${estadoCfg.badge}`}>
                    {estadoCfg.label}
                  </span>
                </div>

                {/* Acciones */}
                <div className="cell-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setModal(d)}
                  >
                    Ver
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setDeleteTarget(d)}
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear / ver checklist */}
      {modal && (
        <DeclaracionModal
          declaracion={modal === "nuevo" ? null : modal}
          clientes={clientes}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Confirm eliminar */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">¿Eliminar declaración?</div>
            <div className="confirm-sub">
              Se eliminará la declaración <strong>F.{deleteTarget.formulario}</strong> de{" "}
              <strong>{deleteTarget.clienteNombre}</strong> — {formatPeriodo(deleteTarget.periodo, deleteTarget.formulario)} permanentemente.
            </div>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
