/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import GastoModal from "../components/GastoModal";
import "./Gastos.css";

export const CATEGORIAS_GASTOS = [
  { key: "arriendo",          label: "Arriendo / Local",              color: "#4A90D9" },
  { key: "servicios-basicos", label: "Servicios Básicos",             color: "#F9C74F" },
  { key: "sueldos",           label: "Sueldos / Nómina",              color: "#00B894" },
  { key: "suministros",       label: "Suministros de Oficina",        color: "#a855f7" },
  { key: "transporte",        label: "Transporte / Movilización",     color: "#FF6B6B" },
  { key: "honorarios",        label: "Honorarios / Subcontratación",  color: "#f97316" },
  { key: "impuestos",         label: "Impuestos / Tributos",          color: "#7A8BAA" },
  { key: "otro",              label: "Otro",                          color: "#4A5670" },
];

function getCat(key) {
  return CATEGORIAS_GASTOS.find(c => c.key === key) || CATEGORIAS_GASTOS[CATEGORIAS_GASTOS.length - 1];
}

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

function buildMesOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MESES[d.getMonth()]} ${d.getFullYear()}`;
    opts.push({ value, label });
  }
  return opts;
}

export default function Gastos() {
  const { empresaId } = useAuth();
  const [gastos,   setGastos]   = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filtro,   setFiltro]   = useState("todos");

  const mesOptions = buildMesOptions();
  const [mesActual, setMesActual] = useState(mesOptions[0].value);

  const [modal,        setModal]        = useState(null); // null | "nuevo" | gasto obj
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    const q = query(
      collection(db, "empresas", empresaId, "gastos"),
      orderBy("fecha", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setGastos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    const unsub = onSnapshot(
      collection(db, "empresas", empresaId, "clientes"),
      snap => setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [empresaId]);

  // Gastos del mes seleccionado
  const gastosMes = gastos.filter(g => g.fecha?.startsWith(mesActual));

  // Filtrado adicional por tipo y búsqueda
  const filtered = gastosMes
    .filter(g => filtro === "todos" || g.tipo === filtro)
    .filter(g => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        g.descripcion?.toLowerCase().includes(q) ||
        g.proveedor?.toLowerCase().includes(q) ||
        g.clienteNombre?.toLowerCase().includes(q)
      );
    });

  // Stats del mes
  const totalMes      = gastosMes.reduce((s, g) => s + (g.monto || 0), 0);
  const totalNegocio  = gastosMes.filter(g => g.tipo === "negocio").reduce((s, g) => s + (g.monto || 0), 0);
  const totalCliente  = gastosMes.filter(g => g.tipo === "cliente").reduce((s, g) => s + (g.monto || 0), 0);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "empresas", empresaId, "gastos", deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="gastos-page animate-fadeUp">
      {/* Header */}
      <div className="gastos-header">
        <div>
          <h1 className="section-title">Control de Gastos</h1>
          <p className="section-sub">
            {loading ? "Cargando..." : `Total este mes: $${totalMes.toFixed(2)}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal("nuevo")}>
          + Nuevo Gasto
        </button>
      </div>

      {/* Stats */}
      <div className="gastos-stats stagger">
        <div className="gastos-stat card">
          <div className="gastos-stat-label">Total del mes</div>
          <div className="gastos-stat-value">${totalMes.toFixed(2)}</div>
          <div className="gastos-stat-sub">{gastosMes.length} registros</div>
        </div>
        <div className="gastos-stat card">
          <div className="gastos-stat-label">Gastos del negocio</div>
          <div className="gastos-stat-value">${totalNegocio.toFixed(2)}</div>
          <div className="gastos-stat-sub">
            {gastosMes.filter(g => g.tipo === "negocio").length} registros
          </div>
        </div>
        <div className="gastos-stat card">
          <div className="gastos-stat-label">Gastos por cliente</div>
          <div className="gastos-stat-value gastos-stat-blue">${totalCliente.toFixed(2)}</div>
          <div className="gastos-stat-sub">
            {gastosMes.filter(g => g.tipo === "cliente").length} registros
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="gastos-toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Buscar descripción, proveedor o cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {[
            { key: "todos",   label: "Todos" },
            { key: "negocio", label: "Negocio" },
            { key: "cliente", label: "Por cliente" },
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
          className="gastos-mes-select form-input"
          value={mesActual}
          onChange={e => setMesActual(e.target.value)}
        >
          {mesOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="gastos-empty">
          <div className="empty-icon">◑</div>
          Cargando gastos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="gastos-empty">
          <div className="empty-icon">◑</div>
          <div>
            {search
              ? "No se encontraron resultados."
              : "No hay gastos registrados para este período."}
          </div>
          {!search && (
            <button className="btn btn-primary" onClick={() => setModal("nuevo")}>
              Registrar primer gasto
            </button>
          )}
        </div>
      ) : (
        <div className="gastos-table">
          <div className="gastos-head">
            <div>Descripción</div>
            <div>Categoría</div>
            <div>Tipo</div>
            <div>Fecha</div>
            <div>Monto</div>
            <div></div>
          </div>
          {filtered.map(g => {
            const cat = getCat(g.categoria);
            return (
              <div className="gastos-row" key={g.id}>
                {/* Descripción */}
                <div>
                  <div className="gastos-desc">{g.descripcion}</div>
                  {g.proveedor && (
                    <div className="gastos-proveedor">{g.proveedor}</div>
                  )}
                </div>

                {/* Categoría */}
                <div className="gastos-cat-cell">
                  <span
                    className="gastos-cat-dot"
                    style={{ background: cat.color }}
                  />
                  <span className="gastos-cat-label">{cat.label}</span>
                </div>

                {/* Tipo */}
                <div>
                  {g.tipo === "negocio" ? (
                    <span className="badge badge-ok">Negocio</span>
                  ) : (
                    <div>
                      <span className="badge badge-blue">Cliente</span>
                      {g.clienteNombre && (
                        <div className="gastos-cliente-nombre">{g.clienteNombre}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fecha */}
                <div className="gastos-fecha">
                  {g.fecha ? g.fecha.split("-").reverse().join("/") : "—"}
                </div>

                {/* Monto */}
                <div className="gastos-monto">${(g.monto || 0).toFixed(2)}</div>

                {/* Acciones */}
                <div className="gastos-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setModal(g)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setDeleteTarget(g)}
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
        <GastoModal
          gasto={modal === "nuevo" ? null : modal}
          clientes={clientes}
          onClose={() => setModal(null)}
        />
      )}

      {/* Confirm eliminar */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">¿Eliminar gasto?</div>
            <div className="confirm-sub">
              Se eliminará <strong>{deleteTarget.descripcion}</strong> por{" "}
              <strong>${(deleteTarget.monto || 0).toFixed(2)}</strong>. Esta acción no se puede deshacer.
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
