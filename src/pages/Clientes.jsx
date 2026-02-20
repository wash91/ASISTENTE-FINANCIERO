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
import ClienteModal from "../components/ClienteModal";
import AsignacionModal from "../components/AsignacionModal";
import DocumentosModal from "../components/DocumentosModal";
import { CATEGORIAS } from "./Servicios";
import "./Clientes.css";

export default function Clientes() {
  const { empresaId } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [modal, setModal] = useState(null);       // null | "nuevo" | cliente objeto
  const [modalTab, setModalTab] = useState("datos");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [asignacionTarget,  setAsignacionTarget]  = useState(null);
  const [serviciosCatalogo, setServiciosCatalogo] = useState([]);
  const [documentosTarget,  setDocumentosTarget]  = useState(null);

  // Suscripción en tiempo real a Firestore
  useEffect(() => {
    if (!empresaId) return;
    const ref = collection(db, "empresas", empresaId, "clientes");
    const unsub = onSnapshot(ref, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Orden: primero activos, luego por nombre
      data.sort((a, b) => {
        if (a.estado !== b.estado) return a.estado === "activo" ? -1 : 1;
        return (a.nombre || "").localeCompare(b.nombre || "");
      });
      setClientes(data);
      setLoading(false);
    });
    return unsub;
  }, [empresaId]);

  // Suscripción al catálogo de servicios (solo activos)
  useEffect(() => {
    if (!empresaId) return;
    const ref = collection(db, "empresas", empresaId, "servicios");
    const unsub = onSnapshot(ref, snap => {
      setServiciosCatalogo(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => s.estado === "activo")
      );
    });
    return unsub;
  }, [empresaId]);

  // Filtrado local
  const filtered = clientes
    .filter(c => filtro === "todos" || c.estado === filtro)
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.nombre?.toLowerCase().includes(q) ||
        c.ruc?.includes(search) ||
        c.email?.toLowerCase().includes(q)
      );
    });

  const totalActivos = clientes.filter(c => c.estado === "activo").length;

  async function handleSave(data) {
    if (data.id) {
      // Editar
      const { id, createdAt: _createdAt, ...rest } = data; // no sobreescribir createdAt
      const ref = doc(db, "empresas", empresaId, "clientes", id);
      await updateDoc(ref, { ...rest, updatedAt: serverTimestamp() });
    } else {
      // Crear
      const ref = collection(db, "empresas", empresaId, "clientes");
      await addDoc(ref, { ...data, createdAt: serverTimestamp() });
    }
    setModal(null);
    setModalTab("datos");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "empresas", empresaId, "clientes", deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  function getInitials(nombre) {
    return (nombre || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join("")
      .toUpperCase();
  }

  return (
    <div className="clientes-page animate-fadeUp">
      {/* Header */}
      <div className="clientes-header">
        <div>
          <h2 className="section-title">Gestión de Clientes</h2>
          <p className="section-sub">
            {loading ? "Cargando..." : `${totalActivos} activos · ${clientes.length} en total`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setModal("nuevo"); setModalTab("datos"); }}>
          + Nuevo Cliente
        </button>
      </div>

      {/* Toolbar */}
      <div className="clientes-toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Buscar por nombre, RUC o correo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {[
            { key: "todos",    label: "Todos" },
            { key: "activo",   label: "Activos" },
            { key: "inactivo", label: "Inactivos" },
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
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="clientes-empty">
          <div className="empty-icon">◈</div>
          Cargando clientes...
        </div>
      ) : filtered.length === 0 ? (
        <div className="clientes-empty">
          <div className="empty-icon">◈</div>
          <div>
            {search
              ? "No se encontraron resultados para tu búsqueda."
              : filtro !== "todos"
                ? `No hay clientes ${filtro === "activo" ? "activos" : "inactivos"}.`
                : "Aún no hay clientes registrados."}
          </div>
          {!search && filtro === "todos" && (
            <button className="btn btn-primary" onClick={() => { setModal("nuevo"); setModalTab("datos"); }}>
              Registrar primer cliente
            </button>
          )}
        </div>
      ) : (
        <div className="clientes-table">
          {/* Cabecera */}
          <div className="table-head">
            <div>Cliente</div>
            <div>RUC</div>
            <div>Vcto. SRI</div>
            <div>Mensualidad</div>
            <div>Servicios</div>
            <div>Estado</div>
            <div></div>
          </div>

          {/* Filas */}
          {filtered.map(c => (
            <div className="table-row" key={c.id}>
              {/* Cliente */}
              <div className="client-cell">
                <div className="client-av-sm">{getInitials(c.nombre)}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="client-name-sm">{c.nombre}</div>
                  <div className="client-email-sm">{c.email || "Sin correo"}</div>
                </div>
              </div>

              {/* RUC */}
              <div className="cell-ruc">{c.ruc || "—"}</div>

              {/* Vencimiento */}
              <div>
                {c.vencimientoSRI
                  ? <span className="vence-chip">Día {c.vencimientoSRI}</span>
                  : <span style={{ color: "var(--text-dim)", fontSize: "12px" }}>—</span>
                }
              </div>

              {/* Mensualidad */}
              <div className="cell-monto">
                {c.mensualidad != null ? `$${c.mensualidad.toFixed(2)}` : "—"}
              </div>

              {/* Servicios asignados */}
              <div className="servicios-cell">
                {(c.servicios || []).length === 0 ? (
                  <span className="servicios-none">—</span>
                ) : (
                  <>
                    {(c.servicios || []).slice(0, 3).map(s => (
                      <span
                        key={s.servicioId}
                        className="cat-dot"
                        style={{ background: CATEGORIAS.find(cat => cat.key === s.categoria)?.color || "#7A8BAA" }}
                        title={s.nombre}
                      />
                    ))}
                    <span className="servicios-count">{(c.servicios || []).length}</span>
                  </>
                )}
              </div>

              {/* Estado */}
              <div>
                <span className={`badge badge-${c.estado === "activo" ? "ok" : "warn"}`}>
                  {c.estado === "activo" ? "Activo" : "Inactivo"}
                </span>
              </div>

              {/* Acciones */}
              <div className="cell-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDocumentosTarget(c)}
                  title="Documentos"
                >
                  📁
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setAsignacionTarget(c)}
                  title="Gestionar servicios"
                >
                  ⊞
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setModal(c); setModalTab("credenciales"); }}
                  title="Credenciales portales"
                >
                  🔑
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setModal(c); setModalTab("datos"); }}
                >
                  Editar
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setDeleteTarget(c)}
                  title="Eliminar cliente"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal documentos */}
      {documentosTarget && (
        <DocumentosModal
          cliente={documentosTarget}
          onClose={() => setDocumentosTarget(null)}
        />
      )}

      {/* Modal servicios asignados */}
      {asignacionTarget && (
        <AsignacionModal
          cliente={asignacionTarget}
          serviciosCatalogo={serviciosCatalogo}
          onClose={() => setAsignacionTarget(null)}
        />
      )}

      {/* Modal crear/editar */}
      {modal && (
        <ClienteModal
          cliente={modal === "nuevo" ? null : modal}
          onSave={handleSave}
          onClose={() => { setModal(null); setModalTab("datos"); }}
          initialTab={modalTab}
        />
      )}

      {/* Confirmación de eliminación */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">¿Eliminar cliente?</div>
            <div className="confirm-sub">
              Esta acción eliminará a <strong>{deleteTarget.nombre}</strong> del sistema permanentemente.
              Los documentos y obligaciones asociados también se perderán.
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
