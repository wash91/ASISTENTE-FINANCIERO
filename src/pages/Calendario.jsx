import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  collection, query, where,
  onSnapshot, addDoc, updateDoc,
  doc, serverTimestamp,
} from "firebase/firestore";
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  eachDayOfInterval,
  getDate, isSameMonth, isToday, isBefore, startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import ProcesoModal        from "../components/ProcesoModal";
import DocumentosModal     from "../components/DocumentosModal";
import CobrosModal         from "../components/CobrosModal";
import UsarPlantillaModal  from "../components/UsarPlantillaModal";
import "./Calendario.css";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MAX_VISIBLE = 3;

export default function Calendario() {
  const { empresaId } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Datos
  const [clientes,    setClientes]    = useState([]);   // activos con vencimientoSRI (grid)
  const [clientesTodos, setClientesTodos] = useState([]); // todos activos (para CobrosModal)
  const [obligaciones, setObligaciones] = useState({}); // { clienteId → obligacion }
  const [plantillas,  setPlantillas]  = useState([]);   // activas para WhatsApp picker
  const [loading,     setLoading]     = useState(true);

  // Modal principal
  const [selectedEvent, setSelectedEvent] = useState(null); // { cliente, dia }

  // Sub-modales
  const [documentosTarget, setDocumentosTarget] = useState(null); // cliente
  const [cobrarTarget,     setCobrarTarget]     = useState(null); // cliente
  const [waPickerTarget,   setWaPickerTarget]   = useState(null); // cliente
  const [waUsarTarget,     setWaUsarTarget]     = useState(null); // { plantilla, cliente }

  const periodo = format(currentMonth, "yyyy-MM");

  // ─── Clientes activos ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!empresaId) return;
    const unsub = onSnapshot(
      collection(db, "empresas", empresaId, "clientes"),
      snap => {
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => c.estado === "activo");
        data.sort((a, b) =>
          (a.vencimientoSRI || 99) - (b.vencimientoSRI || 99) ||
          (a.nombre || "").localeCompare(b.nombre || "")
        );
        setClientesTodos(data);
        setClientes(data.filter(c => c.vencimientoSRI));
        setLoading(false);
      }
    );
    return unsub;
  }, [empresaId]);

  // ─── Obligaciones del período actual ──────────────────────────────────────
  useEffect(() => {
    if (!empresaId) return;
    const q = query(
      collection(db, "empresas", empresaId, "obligaciones"),
      where("periodo", "==", periodo)
    );
    const unsub = onSnapshot(q, snap => {
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[data.clienteId] = { id: d.id, ...data };
      });
      setObligaciones(map);
    });
    return unsub;
  }, [empresaId, periodo]);

  // ─── Plantillas WhatsApp activas ──────────────────────────────────────────
  useEffect(() => {
    if (!empresaId) return;
    const unsub = onSnapshot(
      collection(db, "empresas", empresaId, "plantillasWhatsApp"),
      snap => {
        setPlantillas(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(p => p.estado === "activo")
            .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""))
        );
      }
    );
    return unsub;
  }, [empresaId]);

  // ─── Grid del calendario (memoizado) ──────────────────────────────────────
  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end   = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function getEventsForDay(day) {
    if (!isSameMonth(day, currentMonth)) return [];
    const dayNum = getDate(day);
    return clientes.filter(c => c.vencimientoSRI === dayNum);
  }

  const today = startOfDay(new Date());

  function getEstado(clienteId, dia) {
    const ob = obligaciones[clienteId];
    if (ob?.estado === "completado") return "completado";
    if (isBefore(dia, today)) return "vencido";
    return "pendiente";
  }

  // ─── Stats del mes ────────────────────────────────────────────────────────
  const totalEventos = clientes.length;
  const completados  = clientes.filter(c => obligaciones[c.id]?.estado === "completado").length;
  const vencidos     = clientes.filter(c => {
    if (obligaciones[c.id]?.estado === "completado") return false;
    const dia = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), c.vencimientoSRI);
    return isBefore(dia, today);
  }).length;

  // ─── Guardar / actualizar obligación ─────────────────────────────────────
  async function handleSave({ action, tipo, notas, id }) {
    const { cliente, dia } = selectedEvent;

    const base = {
      clienteId:        cliente.id,
      clienteNombre:    cliente.nombre,
      clienteRUC:       cliente.ruc || "",
      tipo,
      notas,
      periodo,
      empresaId,
      fechaVencimiento: dia,
    };

    const existingEstado = obligaciones[cliente.id]?.estado || "pendiente";
    let estado = existingEstado;
    let extras = {};

    if (action === "completar") {
      estado = "completado";
      extras.completadoEn = serverTimestamp();
    } else if (action === "reabrir") {
      estado = "pendiente";
      extras.completadoEn = null;
    }

    if (id) {
      await updateDoc(
        doc(db, "empresas", empresaId, "obligaciones", id),
        { ...base, estado, ...extras, updatedAt: serverTimestamp() }
      );
    } else {
      await addDoc(
        collection(db, "empresas", empresaId, "obligaciones"),
        { ...base, estado, ...extras, createdAt: serverTimestamp() }
      );
    }
    setSelectedEvent(null);
  }

  // ─── Callbacks para ProcesoModal ─────────────────────────────────────────
  function handleDocumentos(cliente) {
    setSelectedEvent(null);
    setDocumentosTarget(cliente);
  }

  function handleCobro(cliente) {
    setSelectedEvent(null);
    setCobrarTarget(cliente);
  }

  function handleWhatsapp(cliente) {
    setSelectedEvent(null);
    setWaPickerTarget(cliente);
  }

  // ─── Título del mes ───────────────────────────────────────────────────────
  const mesCapitalizado = format(currentMonth, "MMMM yyyy", { locale: es })
    .replace(/^\w/, c => c.toUpperCase());

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="calendario-page animate-fadeUp">

      {/* Header */}
      <div className="cal-header">
        <div className="cal-nav">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >←</button>
          <h2 className="cal-month-title">{mesCapitalizado}</h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >→</button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setCurrentMonth(new Date())}
          >Hoy</button>
        </div>

        <div className="cal-stats">
          <div className="cal-stat">
            <div className="cal-stat-val">{totalEventos}</div>
            <div className="cal-stat-label">procesos</div>
          </div>
          <div className="cal-stat cal-stat-ok">
            <div className="cal-stat-val">{completados}</div>
            <div className="cal-stat-label">completados</div>
          </div>
          {vencidos > 0 && (
            <div className="cal-stat cal-stat-bad">
              <div className="cal-stat-val">{vencidos}</div>
              <div className="cal-stat-label">vencidos</div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px", color: "var(--text-muted)" }}>
          Cargando clientes...
        </div>
      ) : (
        <>
          {/* Leyenda */}
          <div className="cal-legend">
            <span className="legend-item"><span className="legend-dot legend-vencido"    />Vencido</span>
            <span className="legend-item"><span className="legend-dot legend-pendiente"  />Pendiente</span>
            <span className="legend-item"><span className="legend-dot legend-completado" />Completado</span>
          </div>

          {/* Grid */}
          <div className="cal-grid-wrap">
            {/* Cabecera días */}
            <div className="cal-day-headers">
              {DIAS.map(d => <div key={d} className="cal-day-header">{d}</div>)}
            </div>

            {/* Celdas */}
            <div className="cal-days">
              {calDays.map((day, i) => {
                const events   = getEventsForDay(day);
                const outMonth = !isSameMonth(day, currentMonth);
                const todayDay = isToday(day);
                const visible  = events.slice(0, MAX_VISIBLE);
                const extra    = events.length - MAX_VISIBLE;

                return (
                  <div
                    key={i}
                    className={[
                      "cal-day",
                      outMonth ? "cal-day-out" : "",
                      todayDay ? "cal-day-today" : "",
                    ].join(" ")}
                  >
                    <div className={`cal-day-num ${todayDay ? "cal-today-num" : ""}`}>
                      {getDate(day)}
                    </div>
                    <div className="cal-events">
                      {visible.map(cliente => {
                        const estado = getEstado(cliente.id, day);
                        return (
                          <button
                            key={cliente.id}
                            className={`cal-event cal-event-${estado}`}
                            onClick={() => setSelectedEvent({ cliente, dia: day })}
                            title={`${cliente.nombre} — Vence día ${cliente.vencimientoSRI}`}
                          >
                            <span className="cal-event-dot" />
                            <span className="cal-event-name">{cliente.nombre}</span>
                          </button>
                        );
                      })}
                      {extra > 0 && (
                        <div className="cal-event-more">+{extra} más</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Empty state */}
          {clientes.length === 0 && (
            <div className="cal-empty">
              <div className="empty-icon">◫</div>
              <div>
                No hay clientes con día de vencimiento SRI configurado.<br />
                Registra clientes con su RUC para ver sus procesos aquí.
              </div>
              <Link to="/clientes" className="btn btn-primary">
                Ir a Clientes →
              </Link>
            </div>
          )}
        </>
      )}

      {/* Modal principal — proceso */}
      {selectedEvent && (
        <ProcesoModal
          cliente={selectedEvent.cliente}
          dia={selectedEvent.dia}
          obligacion={obligaciones[selectedEvent.cliente.id] || null}
          onSave={handleSave}
          onClose={() => setSelectedEvent(null)}
          onDocumentos={handleDocumentos}
          onCobro={handleCobro}
          onWhatsapp={handleWhatsapp}
        />
      )}

      {/* Sub-modal: Documentos */}
      {documentosTarget && (
        <DocumentosModal
          cliente={documentosTarget}
          onClose={() => setDocumentosTarget(null)}
        />
      )}

      {/* Sub-modal: Cobro */}
      {cobrarTarget && (
        <CobrosModal
          clientes={clientesTodos}
          clienteIdInicial={cobrarTarget.id}
          onClose={() => setCobrarTarget(null)}
        />
      )}

      {/* Sub-modal: WhatsApp picker */}
      {waPickerTarget && !waUsarTarget && (
        <div className="modal-backdrop" onClick={() => setWaPickerTarget(null)}>
          <div className="wa-picker-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Seleccionar plantilla</h2>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {waPickerTarget.nombre}
                </p>
              </div>
              <button className="modal-close" onClick={() => setWaPickerTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              {plantillas.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--text-muted)", padding: "8px 0" }}>
                  No hay plantillas activas.{" "}
                  <Link to="/whatsapp" style={{ color: "var(--green)" }}>
                    Crear una →
                  </Link>
                </p>
              ) : (
                <div className="wa-pick-list">
                  {plantillas.map(p => (
                    <button
                      key={p.id}
                      className="wa-pick-item"
                      onClick={() => {
                        setWaUsarTarget({ plantilla: p, cliente: waPickerTarget });
                        setWaPickerTarget(null);
                      }}
                    >
                      <span className="wa-pick-nombre">{p.nombre}</span>
                      <span className="wa-pick-preview">{p.cuerpo}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal: WhatsApp usar plantilla */}
      {waUsarTarget && (
        <UsarPlantillaModal
          plantilla={waUsarTarget.plantilla}
          clientes={[waUsarTarget.cliente]}
          onClose={() => setWaUsarTarget(null)}
        />
      )}
    </div>
  );
}
