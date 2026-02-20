import { useState, useEffect } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import CobrosModal from "../components/CobrosModal";
import AbonoModal from "../components/AbonoModal";
import "./Facturacion.css";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

function formatPeriodo(periodo) {
  if (!periodo) return "—";
  const [year, month] = periodo.split("-");
  return `${MESES[parseInt(month, 10) - 1]} ${year}`;
}

const ESTADO_INFO = {
  pendiente: { label: "Pendiente", cls: "badge-bad"  },
  parcial:   { label: "Parcial",   cls: "badge-warn" },
  pagado:    { label: "Pagado",    cls: "badge-ok"   },
};

export default function Facturacion() {
  const { empresaId } = useAuth();
  const [cobros,   setCobros]   = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filtro,   setFiltro]   = useState("todos");

  const [showNuevo,    setShowNuevo]    = useState(false);
  const [abonoTarget,  setAbonoTarget]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  // Suscripción cobros
  useEffect(() => {
    if (!empresaId) return;
    const q = query(
      collection(db, "empresas", empresaId, "cobros"),
      orderBy("fechaEmision", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setCobros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [empresaId]);

  // Suscripción clientes (para el modal de nuevo cobro)
  useEffect(() => {
    if (!empresaId) return;
    const unsub = onSnapshot(
      collection(db, "empresas", empresaId, "clientes"),
      snap => setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [empresaId]);

  // Filtrado
  const filtered = cobros
    .filter(c => filtro === "todos" || c.estado === filtro)
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.clienteNombre?.toLowerCase().includes(q) ||
        c.clienteRuc?.includes(search) ||
        c.periodo?.includes(search)
      );
    });

  // Stats
  const now = new Date();
  const periodoActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const totalPendiente = cobros
    .filter(c => c.estado === "pendiente")
    .reduce((s, c) => s + (c.montoPendiente || 0), 0);

  const totalParcial = cobros
    .filter(c => c.estado === "parcial")
    .reduce((s, c) => s + (c.montoPendiente || 0), 0);

  const cobradoEsteMes = cobros
    .filter(c => c.periodo === periodoActual)
    .reduce((s, c) => s + (c.montoPagado || 0), 0);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "empresas", empresaId, "cobros", deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="facturacion-page animate-fadeUp">
      {/* Header */}
      <div className="fact-header">
        <div>
          <h1 className="section-title">Facturación y Cobros</h1>
          <p className="section-sub">
            {loading
              ? "Cargando..."
              : `${cobros.filter(c => c.estado !== "pagado").length} pendientes · $${(totalPendiente + totalParcial).toFixed(2)} por cobrar`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNuevo(true)}>
          + Nuevo Cobro
        </button>
      </div>

      {/* Stats */}
      <div className="fact-stats stagger">
        <div className="fact-stat-card card">
          <div className="fact-stat-label">Por cobrar (pendiente)</div>
          <div className="fact-stat-value">${totalPendiente.toFixed(2)}</div>
          <div className="fact-stat-count">
            {cobros.filter(c => c.estado === "pendiente").length} cobros
          </div>
        </div>
        <div className="fact-stat-card card">
          <div className="fact-stat-label">Pago parcial</div>
          <div className="fact-stat-value fact-stat-amber">${totalParcial.toFixed(2)}</div>
          <div className="fact-stat-count">
            {cobros.filter(c => c.estado === "parcial").length} cobros
          </div>
        </div>
        <div className="fact-stat-card card">
          <div className="fact-stat-label">Cobrado este mes</div>
          <div className="fact-stat-value fact-stat-green">${cobradoEsteMes.toFixed(2)}</div>
          <div className="fact-stat-count">{formatPeriodo(periodoActual)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="fact-toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Buscar por cliente, RUC o período..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {[
            { key: "todos",     label: "Todos" },
            { key: "pendiente", label: "Pendiente" },
            { key: "parcial",   label: "Parcial" },
            { key: "pagado",    label: "Pagado" },
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
        <div className="fact-empty">
          <div className="empty-icon">◎</div>
          Cargando cobros...
        </div>
      ) : filtered.length === 0 ? (
        <div className="fact-empty">
          <div className="empty-icon">◎</div>
          <div>
            {search
              ? "No se encontraron resultados."
              : filtro !== "todos"
                ? `No hay cobros con estado "${filtro}".`
                : "Aún no hay cobros registrados."}
          </div>
          {!search && filtro === "todos" && (
            <button className="btn btn-primary" onClick={() => setShowNuevo(true)}>
              Emitir primer cobro
            </button>
          )}
        </div>
      ) : (
        <div className="fact-table">
          <div className="fact-head">
            <div>Cliente</div>
            <div>Período</div>
            <div>Total</div>
            <div>Pagado</div>
            <div>Pendiente</div>
            <div>Estado</div>
            <div></div>
          </div>
          {filtered.map(c => {
            const pct = c.montoTotal > 0
              ? Math.min(100, (c.montoPagado / c.montoTotal) * 100)
              : 0;
            const ei = ESTADO_INFO[c.estado] || ESTADO_INFO.pendiente;
            return (
              <div className="fact-row" key={c.id}>
                {/* Cliente */}
                <div className="fact-cliente">
                  <div className="fact-cliente-nombre">{c.clienteNombre}</div>
                  {c.clienteRuc && (
                    <div className="fact-cliente-ruc">{c.clienteRuc}</div>
                  )}
                </div>

                {/* Período */}
                <div className="fact-periodo">{formatPeriodo(c.periodo)}</div>

                {/* Total */}
                <div className="fact-monto">${(c.montoTotal || 0).toFixed(2)}</div>

                {/* Pagado + barra */}
                <div>
                  <div className="fact-monto-green">${(c.montoPagado || 0).toFixed(2)}</div>
                  <div className="fact-progress-bar">
                    <div className="fact-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Pendiente */}
                <div className={`fact-monto ${c.montoPendiente > 0 ? "fact-monto-coral" : ""}`}>
                  ${(c.montoPendiente || 0).toFixed(2)}
                </div>

                {/* Estado */}
                <div>
                  <span className={`badge ${ei.cls}`}>{ei.label}</span>
                </div>

                {/* Acciones */}
                <div className="fact-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setAbonoTarget(c)}
                    disabled={c.estado === "pagado"}
                    title={c.estado === "pagado" ? "Cobro completado" : "Registrar pago"}
                  >
                    Abonar
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setDeleteTarget(c)}
                    title="Eliminar cobro"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nuevo cobro */}
      {showNuevo && (
        <CobrosModal
          clientes={clientes}
          onClose={() => setShowNuevo(false)}
        />
      )}

      {/* Modal abono */}
      {abonoTarget && (
        <AbonoModal
          cobro={abonoTarget}
          onClose={() => setAbonoTarget(null)}
        />
      )}

      {/* Confirm eliminar */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">¿Eliminar cobro?</div>
            <div className="confirm-sub">
              Se eliminará el cobro de <strong>{deleteTarget.clienteNombre}</strong>{" "}
              por <strong>${(deleteTarget.montoTotal || 0).toFixed(2)}</strong> ({formatPeriodo(deleteTarget.periodo)}).
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
