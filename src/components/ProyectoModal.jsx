import { useState, useEffect } from "react";
import {
  doc, addDoc, updateDoc, collection, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import EtapaCobroModal from "./EtapaCobroModal";
import "./ProyectoModal.css";

export const TIPOS_PROYECTO = [
  "Impugnación IESS",
  "Impugnación Tributaria",
  "Auditoría Tributaria",
  "Consultoría Especial",
  "Revisión de Declaraciones",
  "Otro",
];

export function getProgreso(etapas) {
  const total = etapas.length;
  const completadas = etapas.filter(e => e.estado === "completado").length;
  const totalPresupuestado = etapas.reduce((s, e) => s + (e.montoPresupuestado || 0), 0);
  const totalCobrado = etapas.reduce((s, e) => s + (e.montoPagado || 0), 0);
  return {
    completadas, total,
    pct: total ? Math.round(completadas / total * 100) : 0,
    totalPresupuestado, totalCobrado,
  };
}

const ESTADO_CICLO = { pendiente: "en_progreso", en_progreso: "completado", completado: "pendiente" };
const ESTADO_LABEL = { pendiente: "Pendiente", en_progreso: "En progreso", completado: "Completado" };
const ESTADO_CLASS = { pendiente: "badge-warn", en_progreso: "badge-info", completado: "badge-ok" };

const ESTADO_PROYECTO_LABEL = { activo: "Activo", completado: "Completado", suspendido: "Suspendido" };
const ESTADO_PROYECTO_CLASS = { activo: "badge-ok", completado: "badge-info", suspendido: "badge-warn" };

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function hoy() {
  return new Date().toISOString();
}

/* ─────────────── MODO CREAR ─────────────── */
function ModoCrear({ clientes, onSave, onClose }) {
  const [clienteId,        setClienteId]        = useState("");
  const [tipo,             setTipo]             = useState(TIPOS_PROYECTO[0]);
  const [titulo,           setTitulo]           = useState("");
  const [descripcion,      setDescripcion]      = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState("");

  async function handleSubmit() {
    if (!clienteId) { setError("Selecciona un cliente."); return; }
    if (!titulo.trim()) { setError("Ingresa un título."); return; }
    setSaving(true);
    try {
      const cliente = clientes.find(c => c.id === clienteId);
      await onSave({
        clienteId,
        clienteNombre: cliente?.nombre || "",
        clienteRuc:    cliente?.ruc || "",
        tipo,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        fechaVencimiento,
        estado: "activo",
        etapas:   [],
        bitacora: [],
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">Cliente</label>
          <select
            className={`form-input ${error && !clienteId ? "input-error" : ""}`}
            value={clienteId}
            onChange={e => { setClienteId(e.target.value); setError(""); }}
            disabled={saving}
          >
            <option value="">— seleccionar —</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Tipo de proyecto</label>
          <select
            className="form-input"
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            disabled={saving}
          >
            {TIPOS_PROYECTO.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Título</label>
          <input
            className={`form-input ${error && !titulo.trim() ? "input-error" : ""}`}
            value={titulo}
            onChange={e => { setTitulo(e.target.value); setError(""); }}
            placeholder="Ej: Impugnación multa IESS — Mar 2026"
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Descripción (opcional)</label>
          <textarea
            className="form-input pm-textarea"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Detalle adicional del proyecto..."
            rows={2}
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Fecha de vencimiento (opcional)</label>
          <input
            className="form-input"
            type="date"
            value={fechaVencimiento}
            onChange={e => setFechaVencimiento(e.target.value)}
            disabled={saving}
          />
        </div>

        {error && <p className="field-error">{error}</p>}
      </div>

      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? "Creando..." : "Crear proyecto"}
        </button>
      </div>
    </>
  );
}

/* ─────────────── MODO DETALLE ─────────────── */
function ModoDetalle({ proyecto, clientes, onSave, onClose }) {
  const [tab,             setTab]             = useState("etapas");
  const [etapas,          setEtapas]          = useState(proyecto.etapas || []);
  const [bitacora,        setBitacora]        = useState(proyecto.bitacora || []);
  const [tipo,            setTipo]            = useState(proyecto.tipo || TIPOS_PROYECTO[0]);
  const [titulo,          setTitulo]          = useState(proyecto.titulo || "");
  const [descripcion,     setDescripcion]     = useState(proyecto.descripcion || "");
  const [fechaVenc,       setFechaVenc]       = useState(proyecto.fechaVencimiento || "");
  const [estadoProyecto,  setEstadoProyecto]  = useState(proyecto.estado || "activo");
  const [cobrarEtapa,     setCobrarEtapa]     = useState(null);
  const [saving,          setSaving]          = useState(false);

  // Nueva etapa inline
  const [addingEtapa,     setAddingEtapa]     = useState(false);
  const [nuevaNombre,     setNuevaNombre]     = useState("");
  const [nuevaMonto,      setNuevaMonto]      = useState("");

  // Nota manual bitácora
  const [notaManual,      setNotaManual]      = useState("");
  const [addingNota,      setAddingNota]      = useState(false);

  const prog = getProgreso(etapas);

  function addBitacora(desc, et = etapas, bi = bitacora) {
    const entrada = { id: genId(), fecha: hoy(), descripcion: desc };
    const nuevaBit = [entrada, ...bi];
    setBitacora(nuevaBit);
    return nuevaBit;
  }

  function cambiarEstadoEtapa(etapaId) {
    const updated = etapas.map(e => {
      if (e.id !== etapaId) return e;
      const nuevo = ESTADO_CICLO[e.estado] || "pendiente";
      return { ...e, estado: nuevo };
    });
    const etapa = updated.find(e => e.id === etapaId);
    setEtapas(updated);
    setBitacora(prev => {
      const entrada = { id: genId(), fecha: hoy(), descripcion: `Etapa "${etapa.nombre}" → ${ESTADO_LABEL[etapa.estado]}` };
      return [entrada, ...prev];
    });
  }

  function agregarEtapa() {
    if (!nuevaNombre.trim()) return;
    const monto = parseFloat(nuevaMonto) || 0;
    const nueva = {
      id:                  genId(),
      nombre:              nuevaNombre.trim(),
      orden:               etapas.length,
      estado:              "pendiente",
      montoPresupuestado:  monto,
      montoPagado:         0,
      abonos:              [],
    };
    const updated = [...etapas, nueva];
    setEtapas(updated);
    setBitacora(prev => {
      const entrada = { id: genId(), fecha: hoy(), descripcion: `Etapa agregada: "${nueva.nombre}"` };
      return [entrada, ...prev];
    });
    setNuevaNombre("");
    setNuevaMonto("");
    setAddingEtapa(false);
  }

  function eliminarEtapa(etapaId) {
    const etapa = etapas.find(e => e.id === etapaId);
    const updated = etapas.filter(e => e.id !== etapaId);
    setEtapas(updated);
    setBitacora(prev => {
      const entrada = { id: genId(), fecha: hoy(), descripcion: `Etapa eliminada: "${etapa.nombre}"` };
      return [entrada, ...prev];
    });
  }

  function handleCobro(etapa, abono) {
    const updated = etapas.map(e => {
      if (e.id !== etapa.id) return e;
      const abonos = [...(e.abonos || []), abono];
      const montoPagado = abonos.reduce((s, a) => s + (a.monto || 0), 0);
      return { ...e, abonos, montoPagado };
    });
    setEtapas(updated);
    setBitacora(prev => {
      const entrada = { id: genId(), fecha: hoy(), descripcion: `Cobro registrado en "${etapa.nombre}": $${abono.monto.toFixed(2)} (${abono.metodo})` };
      return [entrada, ...prev];
    });
    setCobrarEtapa(null);
  }

  function agregarNotaManual() {
    if (!notaManual.trim()) return;
    setBitacora(prev => {
      const entrada = { id: genId(), fecha: hoy(), descripcion: notaManual.trim() };
      return [entrada, ...prev];
    });
    setNotaManual("");
    setAddingNota(false);
  }

  async function handleGuardar() {
    setSaving(true);
    try {
      await onSave(proyecto, { etapas, bitacora, tipo, titulo, descripcion, fechaVencimiento: fechaVenc, estado: estadoProyecto });
    } finally {
      setSaving(false);
    }
  }

  const cliente = clientes.find(c => c.id === proyecto.clienteId);

  return (
    <>
      {cobrarEtapa && (
        <EtapaCobroModal
          etapa={cobrarEtapa}
          onSave={handleCobro}
          onClose={() => setCobrarEtapa(null)}
        />
      )}

      <div className="modal-body pm-detail-body">
        {/* Info header */}
        <div className="pm-detail-header">
          <div className="pm-detail-meta">
            <span className={`badge ${ESTADO_PROYECTO_CLASS[estadoProyecto] || "badge-ok"}`}>
              {ESTADO_PROYECTO_LABEL[estadoProyecto]}
            </span>
            <span className="pm-detail-tipo">{tipo}</span>
          </div>
          <p className="pm-detail-cliente">{proyecto.clienteNombre}</p>
        </div>

        {/* Tabs */}
        <div className="pm-tabs">
          {["etapas","bitacora","datos"].map(t => (
            <button
              key={t}
              className={`pm-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "etapas" ? "Etapas" : t === "bitacora" ? "Bitácora" : "Datos"}
            </button>
          ))}
        </div>

        {/* ── Tab Etapas ── */}
        {tab === "etapas" && (
          <div className="pm-tab-content">
            {/* Progreso global */}
            {etapas.length > 0 && (
              <div className="pm-prog-global">
                <div className="pm-prog-bar-wrap">
                  <div className="pm-prog-bar">
                    <div className="pm-prog-fill" style={{ width: `${prog.pct}%` }} />
                  </div>
                  <span className="pm-prog-txt">{prog.pct}%</span>
                </div>
                <p className="pm-prog-sub">
                  {prog.completadas}/{prog.total} etapas completadas
                  {prog.totalPresupuestado > 0 && ` · $${prog.totalCobrado.toFixed(2)} cobrado de $${prog.totalPresupuestado.toFixed(2)}`}
                </p>
              </div>
            )}

            {/* Lista etapas */}
            {etapas.length === 0 && !addingEtapa && (
              <p className="pm-empty-hint">Sin etapas aún. Agrega la primera etapa.</p>
            )}

            {etapas.map((e, i) => (
              <div key={e.id} className="pm-etapa-card">
                <div className="pm-etapa-top">
                  <span className="pm-etapa-num">#{i + 1}</span>
                  <span className="pm-etapa-nombre">{e.nombre}</span>
                  <button
                    className={`badge badge-btn ${ESTADO_CLASS[e.estado] || "badge-warn"}`}
                    onClick={() => cambiarEstadoEtapa(e.id)}
                    title="Clic para cambiar estado"
                  >
                    {ESTADO_LABEL[e.estado]}
                  </button>
                </div>
                <div className="pm-etapa-bottom">
                  <span className="pm-etapa-montos">
                    ${(e.montoPresupuestado || 0).toFixed(2)} presupuestado
                    {e.montoPagado > 0 && ` · $${e.montoPagado.toFixed(2)} cobrado`}
                  </span>
                  <div className="pm-etapa-actions">
                    <button
                      className="btn btn-ghost pm-etapa-btn"
                      onClick={() => setCobrarEtapa(e)}
                      disabled={e.montoPresupuestado <= 0 || e.montoPagado >= e.montoPresupuestado}
                    >
                      💰 Cobro
                    </button>
                    <button
                      className="btn btn-ghost pm-etapa-btn pm-etapa-del"
                      onClick={() => eliminarEtapa(e.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Inline agregar etapa */}
            {addingEtapa ? (
              <div className="pm-add-etapa">
                <input
                  className="form-input pm-add-input"
                  placeholder="Nombre de la etapa"
                  value={nuevaNombre}
                  onChange={e => setNuevaNombre(e.target.value)}
                  autoFocus
                />
                <input
                  className="form-input pm-add-input pm-add-monto"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Monto $"
                  value={nuevaMonto}
                  onChange={e => setNuevaMonto(e.target.value)}
                />
                <div className="pm-add-btns">
                  <button className="btn btn-primary" onClick={agregarEtapa}>Agregar</button>
                  <button className="btn btn-ghost" onClick={() => { setAddingEtapa(false); setNuevaNombre(""); setNuevaMonto(""); }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-ghost pm-add-etapa-btn" onClick={() => setAddingEtapa(true)}>
                + Agregar etapa
              </button>
            )}
          </div>
        )}

        {/* ── Tab Bitácora ── */}
        {tab === "bitacora" && (
          <div className="pm-tab-content">
            {bitacora.length === 0 && !addingNota && (
              <p className="pm-empty-hint">Sin entradas en la bitácora.</p>
            )}

            {bitacora.map(b => {
              const d = new Date(b.fecha);
              const fechaStr = isNaN(d) ? b.fecha : d.toLocaleDateString("es-EC", { day:"2-digit", month:"short", year:"numeric" });
              return (
                <div key={b.id} className="pm-bit-entry">
                  <span className="pm-bit-fecha">📅 {fechaStr}</span>
                  <span className="pm-bit-desc">{b.descripcion}</span>
                </div>
              );
            })}

            {addingNota ? (
              <div className="pm-add-nota">
                <textarea
                  className="form-input pm-nota-textarea"
                  placeholder="Nota manual..."
                  rows={2}
                  value={notaManual}
                  onChange={e => setNotaManual(e.target.value)}
                  autoFocus
                />
                <div className="pm-add-btns">
                  <button className="btn btn-primary" onClick={agregarNotaManual}>Guardar nota</button>
                  <button className="btn btn-ghost" onClick={() => { setAddingNota(false); setNotaManual(""); }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-ghost pm-add-etapa-btn" onClick={() => setAddingNota(true)}>
                + Agregar nota manual
              </button>
            )}
          </div>
        )}

        {/* ── Tab Datos ── */}
        {tab === "datos" && (
          <div className="pm-tab-content">
            <div className="form-group">
              <label className="form-label">Tipo de proyecto</label>
              <select className="form-input" value={tipo} onChange={e => setTipo(e.target.value)}>
                {TIPOS_PROYECTO.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Título</label>
              <input className="form-input" value={titulo} onChange={e => setTitulo(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción</label>
              <textarea
                className="form-input pm-textarea"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                rows={2}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha de vencimiento</label>
                <input className="form-input" type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Estado</label>
                <select className="form-input" value={estadoProyecto} onChange={e => setEstadoProyecto(e.target.value)}>
                  <option value="activo">Activo</option>
                  <option value="completado">Completado</option>
                  <option value="suspendido">Suspendido</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cerrar</button>
        <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </>
  );
}

/* ─────────────── MODAL PRINCIPAL ─────────────── */
export default function ProyectoModal({ proyecto, clientes, onSave, onClose }) {
  const esNuevo = proyecto === null;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`proyecto-modal ${esNuevo ? "" : "proyecto-modal-lg"}`}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{esNuevo ? "Nuevo Proyecto" : proyecto.titulo}</h2>
            {!esNuevo && <p className="pm-header-sub">{proyecto.clienteNombre}</p>}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {esNuevo
          ? <ModoCrear clientes={clientes} onSave={onSave} onClose={onClose} />
          : <ModoDetalle proyecto={proyecto} clientes={clientes} onSave={onSave} onClose={onClose} />
        }
      </div>
    </div>
  );
}
