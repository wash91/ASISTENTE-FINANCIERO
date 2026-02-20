import { useState, useEffect } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc,
  doc, serverTimestamp, query, where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import ProyectoModal, { getProgreso, TIPOS_PROYECTO } from "../components/ProyectoModal";
import "./Proyectos.css";

const ESTADO_CLASS  = { activo: "badge-ok", completado: "badge-info", suspendido: "badge-warn" };
const ESTADO_LABEL  = { activo: "Activo", completado: "Completado", suspendido: "Suspendido" };
const TIPO_COLORS = {
  "Impugnación IESS":       { bg: "rgba(249,199,79,0.12)",  color: "#F9C74F",  border: "rgba(249,199,79,0.25)"  },
  "Impugnación Tributaria": { bg: "rgba(249,199,79,0.12)",  color: "#F9C74F",  border: "rgba(249,199,79,0.25)"  },
  "Auditoría Tributaria":   { bg: "rgba(74,144,217,0.12)",  color: "#4A90D9",  border: "rgba(74,144,217,0.25)"  },
  "Consultoría Especial":   { bg: "rgba(0,184,148,0.10)",   color: "#00B894",  border: "rgba(0,184,148,0.20)"   },
  "Revisión de Declaraciones":{ bg: "rgba(74,144,217,0.10)",color: "#4A90D9",  border: "rgba(74,144,217,0.20)"  },
  "Otro":                   { bg: "rgba(122,139,170,0.10)", color: "#7A8BAA",  border: "rgba(122,139,170,0.20)" },
};

function TipoChip({ tipo }) {
  const s = TIPO_COLORS[tipo] || TIPO_COLORS["Otro"];
  return (
    <span className="proy-tipo-chip" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {tipo}
    </span>
  );
}

function formatFecha(str) {
  if (!str) return "—";
  const d = new Date(str + "T00:00:00");
  if (isNaN(d)) return str;
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(nombre) {
  if (!nombre) return "??";
  return nombre.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export default function Proyectos() {
  const { empresaId } = useAuth();
  const [proyectos,  setProyectos]  = useState([]);
  const [clientes,   setClientes]   = useState([]);
  const [search,     setSearch]     = useState("");
  const [filtro,     setFiltro]     = useState("todos");
  const [modal,      setModal]      = useState(null); // null | { proyecto: obj|null }
  const [deleteId,   setDeleteId]   = useState(null);

  useEffect(() => {
    if (!empresaId) return;
    const unsubP = onSnapshot(
      collection(db, "empresas", empresaId, "proyectos"),
      snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => {
          const order = { activo: 0, suspendido: 1, completado: 2 };
          return (order[a.estado] ?? 3) - (order[b.estado] ?? 3) ||
            ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        });
        setProyectos(data);
      }
    );
    const unsubC = onSnapshot(
      query(collection(db, "empresas", empresaId, "clientes"), where("estado", "==", "activo")),
      snap => setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubP(); unsubC(); };
  }, [empresaId]);

  const proyectosFiltrados = proyectos.filter(p => {
    if (filtro !== "todos" && p.estado !== filtro) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (p.titulo || "").toLowerCase().includes(q) ||
        (p.clienteNombre || "").toLowerCase().includes(q) ||
        (p.tipo || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activos    = proyectos.filter(p => p.estado === "activo").length;
  const completados = proyectos.filter(p => p.estado === "completado").length;

  async function handleSave(proyecto, data) {
    if (!proyecto) {
      // Crear
      await addDoc(collection(db, "empresas", empresaId, "proyectos"), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setModal(null);
    } else {
      // Actualizar
      await updateDoc(doc(db, "empresas", empresaId, "proyectos", proyecto.id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      setModal(null);
    }
  }

  async function handleDelete(id) {
    await updateDoc(doc(db, "empresas", empresaId, "proyectos", id), {
      estado: "suspendido",
      updatedAt: serverTimestamp(),
    });
    setDeleteId(null);
  }

  const TABS = [
    { key: "todos",      label: "Todos" },
    { key: "activo",     label: "Activos" },
    { key: "completado", label: "Completados" },
    { key: "suspendido", label: "Suspendidos" },
  ];

  return (
    <div className="proy-page">
      {/* Header */}
      <div className="proy-page-header">
        <div>
          <h1 className="proy-page-title">Gestión de Proyectos</h1>
          <p className="proy-page-sub">
            {activos} activo{activos !== 1 ? "s" : ""} · {completados} completado{completados !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ proyecto: null })}>
          + Nuevo Proyecto
        </button>
      </div>

      {/* Toolbar */}
      <div className="proy-toolbar">
        <input
          className="form-input proy-search"
          placeholder="🔍 Buscar proyectos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="proy-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`proy-tab ${filtro === t.key ? "active" : ""}`}
              onClick={() => setFiltro(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {proyectosFiltrados.length === 0 ? (
        <div className="proy-empty">
          <span style={{ fontSize: 32 }}>◭</span>
          <p>{proyectos.length === 0 ? "Sin proyectos registrados aún." : "No hay proyectos con ese filtro."}</p>
        </div>
      ) : (
        <div className="proy-table">
          {/* Head */}
          <div className="proy-table-head">
            <span>Cliente / Título</span>
            <span>Tipo</span>
            <span>Etapas</span>
            <span>Progreso</span>
            <span>Vence</span>
            <span>Estado</span>
            <span />
          </div>

          {/* Rows */}
          {proyectosFiltrados.map(p => {
            const prog = getProgreso(p.etapas || []);
            return (
              <div key={p.id} className="proy-table-row">
                {/* Cliente + Título */}
                <div className="proy-client-cell">
                  <div className="proy-av">{initials(p.clienteNombre)}</div>
                  <div className="proy-client-info">
                    <span className="proy-client-nombre">{p.clienteNombre}</span>
                    <span className="proy-titulo">{p.titulo}</span>
                  </div>
                </div>

                {/* Tipo */}
                <TipoChip tipo={p.tipo} />

                {/* Etapas */}
                <span className="proy-etapas-txt">
                  {prog.completadas}/{prog.total}
                </span>

                {/* Progreso */}
                <div className="proy-prog-cell">
                  <div className="proy-prog-bar-wrap">
                    <div className="proy-prog-bar">
                      <div className="proy-prog-fill" style={{ width: `${prog.pct}%` }} />
                    </div>
                    <span className="proy-prog-txt">{prog.pct}%</span>
                  </div>
                </div>

                {/* Vence */}
                <span className="proy-fecha">{formatFecha(p.fechaVencimiento)}</span>

                {/* Estado */}
                <span className={`badge ${ESTADO_CLASS[p.estado] || "badge-ok"}`}>
                  {ESTADO_LABEL[p.estado] || p.estado}
                </span>

                {/* Acciones */}
                <div className="proy-actions">
                  <button
                    className="btn btn-ghost proy-action-btn"
                    onClick={() => setModal({ proyecto: p })}
                  >
                    Ver
                  </button>
                  <button
                    className="btn btn-ghost proy-action-del"
                    onClick={() => setDeleteId(p.id)}
                    title="Suspender"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear / detalle */}
      {modal && (
        <ProyectoModal
          proyecto={modal.proyecto}
          clientes={clientes}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Confirm suspender */}
      {deleteId && (
        <div className="modal-backdrop" onClick={() => setDeleteId(null)}>
          <div className="proy-confirm" onClick={e => e.stopPropagation()}>
            <h3>¿Suspender proyecto?</h3>
            <p>El proyecto pasará a estado "Suspendido". Puedes reactivarlo desde la vista de detalle.</p>
            <div className="proy-confirm-btns">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: "var(--coral)", borderColor: "var(--coral)" }} onClick={() => handleDelete(deleteId)}>
                Suspender
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
