import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import "./DeclaracionModal.css";

export const FORMULARIOS = [
  { key: "104", label: "F.104 — IVA",              color: "#4A90D9", periodicidad: "mensual" },
  { key: "103", label: "F.103 — Retenciones",      color: "#F9C74F", periodicidad: "mensual" },
  { key: "101", label: "F.101 — Renta Sociedades", color: "#00B894", periodicidad: "anual"   },
  { key: "102", label: "F.102 — Renta Personas",   color: "#7A8BAA", periodicidad: "anual"   },
];

export const CHECKLIST_TEMPLATES = {
  "104": [
    { id: "ventas",        label: "Facturas de ventas del período" },
    { id: "nc_emitidas",   label: "Notas de crédito emitidas" },
    { id: "compras",       label: "Facturas de compras locales" },
    { id: "retenciones",   label: "Comprobantes de retención recibidos" },
    { id: "tarifa0",       label: "Ventas tarifa 0%" },
    { id: "exportaciones", label: "Exportaciones (si aplica)" },
    { id: "liquidaciones", label: "Liquidaciones de compra (si aplica)" },
    { id: "ats",           label: "ATS generado y validado" },
  ],
  "103": [
    { id: "comp_ret",      label: "Comprobantes de retención emitidos" },
    { id: "honorarios",    label: "Retenciones en honorarios profesionales" },
    { id: "bienes",        label: "Retenciones en pagos de bienes" },
    { id: "arrendamientos",label: "Retenciones en arrendamientos" },
    { id: "nomina",        label: "Nómina del período procesada" },
    { id: "exterior",      label: "Pagos al exterior (si aplica)" },
  ],
  "101": [
    { id: "balance",       label: "Balance general al 31/12" },
    { id: "resultados",    label: "Estado de resultados" },
    { id: "libro_mayor",   label: "Libro mayor conciliado" },
    { id: "conciliacion",  label: "Conciliación tributaria" },
    { id: "depreciacion",  label: "Depreciaciones y amortizaciones" },
    { id: "no_deducibles", label: "Gastos no deducibles identificados" },
    { id: "credito_trib",  label: "Crédito tributario año anterior" },
    { id: "patrimonio",    label: "Declaración patrimonial" },
  ],
  "102": [
    { id: "dep_rel",       label: "Ingresos en relación de dependencia" },
    { id: "act_econ",      label: "Ingresos de actividades económicas" },
    { id: "gp_salud",      label: "Gastos personales — salud" },
    { id: "gp_educacion",  label: "Gastos personales — educación" },
    { id: "gp_vivienda",   label: "Gastos personales — vivienda" },
    { id: "gp_alim",       label: "Gastos personales — alimentación" },
    { id: "credito_trib",  label: "Crédito tributario año anterior" },
    { id: "patrimonio",    label: "Información patrimonial" },
  ],
};

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

export function getProgreso(checklist) {
  const aplicables = (checklist || []).filter(i => i.estado !== "na");
  const completados = aplicables.filter(i => i.estado === "ok");
  return {
    completados: completados.length,
    total: aplicables.length,
    pct: aplicables.length ? Math.round(completados.length / aplicables.length * 100) : 0,
  };
}

function getForm(key) {
  return FORMULARIOS.find(f => f.key === key) || FORMULARIOS[0];
}

function formatPeriodoLabel(periodo) {
  if (!periodo) return "—";
  const [anio, mes] = periodo.split("-");
  if (mes === "01" && parseInt(mes) === 1) {
    // Check if it's an annual declaration (anio only, stored as YYYY-01)
  }
  const mesNum = parseInt(mes, 10);
  if (mesNum >= 1 && mesNum <= 12) {
    return `${MESES[mesNum - 1]} ${anio}`;
  }
  return periodo;
}

// ─── Ciclo de estados de ítem: pendiente → ok → na → pendiente ───────────
function nextEstado(e) {
  if (e === "pendiente") return "ok";
  if (e === "ok")        return "na";
  return "pendiente";
}

const ITEM_ICONS = { pendiente: "○", ok: "✓", na: "—" };
const ITEM_CLASSES = { pendiente: "item-pendiente", ok: "item-ok", na: "item-na" };

// ─── MODO CREAR ────────────────────────────────────────────────────────────
function ModoCrear({ clientes, onSave, onClose }) {
  const now = new Date();
  const [clienteId,  setClienteId]  = useState("");
  const [formulario, setFormulario] = useState("104");
  const [mes,        setMes]        = useState(now.getMonth() + 1);
  const [anio,       setAnio]       = useState(now.getFullYear());
  const [saving,     setSaving]     = useState(false);
  const [errors,     setErrors]     = useState({});

  const form = getForm(formulario);
  const esAnual = form.periodicidad === "anual";

  function validate() {
    const e = {};
    if (!clienteId) e.clienteId = "Selecciona un cliente.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCrear() {
    if (!validate()) return;
    setSaving(true);
    const cliente = clientes.find(c => c.id === clienteId);
    // Para anuales usamos enero (01) del año como período canónico
    const periodo = esAnual
      ? `${anio}-01`
      : `${anio}-${String(mes).padStart(2, "0")}`;
    const checklist = CHECKLIST_TEMPLATES[formulario].map(item => ({
      ...item,
      estado: "pendiente",
      nota: "",
    }));
    try {
      await onSave({
        clienteId,
        clienteNombre: cliente?.nombre || "",
        clienteRuc:    cliente?.ruc    || "",
        formulario,
        periodo,
        estado: "borrador",
        checklist,
        notas: "",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="modal-header">
        <h2 className="modal-title">Nueva Declaración</h2>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">Cliente</label>
          <select
            className={`form-input ${errors.clienteId ? "input-error" : ""}`}
            value={clienteId}
            onChange={e => { setClienteId(e.target.value); setErrors({}); }}
            disabled={saving}
          >
            <option value="">— Seleccionar cliente —</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          {errors.clienteId && <p className="field-error">{errors.clienteId}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Formulario</label>
          <select
            className="form-input"
            value={formulario}
            onChange={e => setFormulario(e.target.value)}
            disabled={saving}
          >
            {FORMULARIOS.map(f => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>

        {esAnual ? (
          <div className="form-group">
            <label className="form-label">Año fiscal</label>
            <input
              className="form-input"
              type="number"
              value={anio}
              onChange={e => setAnio(parseInt(e.target.value, 10) || anio)}
              min={2020}
              max={2030}
              disabled={saving}
            />
          </div>
        ) : (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Mes</label>
              <select
                className="form-input"
                value={mes}
                onChange={e => setMes(parseInt(e.target.value, 10))}
                disabled={saving}
              >
                {MESES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Año</label>
              <input
                className="form-input"
                type="number"
                value={anio}
                onChange={e => setAnio(parseInt(e.target.value, 10) || anio)}
                min={2020}
                max={2030}
                disabled={saving}
              />
            </div>
          </div>
        )}

        <div className="decl-form-hint">
          Se creará un checklist de {CHECKLIST_TEMPLATES[formulario].length} ítems
          para <strong>{getForm(formulario).label}</strong> · {esAnual ? `Año ${anio}` : `${MESES[mes - 1]} ${anio}`}.
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleCrear} disabled={saving}>
          {saving ? "Creando..." : "Crear declaración"}
        </button>
      </div>
    </>
  );
}

// ─── MODO VER / EDITAR CHECKLIST ───────────────────────────────────────────
function ModoChecklist({ declaracion, onSave, onClose }) {
  const [checklist, setChecklist] = useState(declaracion.checklist || []);
  const [notas,     setNotas]     = useState(declaracion.notas || "");
  const [estado,    setEstado]    = useState(declaracion.estado || "borrador");
  const [saving,    setSaving]    = useState(false);

  const form     = getForm(declaracion.formulario);
  const progreso = useMemo(() => getProgreso(checklist), [checklist]);

  function toggleItem(id) {
    setChecklist(prev =>
      prev.map(item =>
        item.id === id ? { ...item, estado: nextEstado(item.estado) } : item
      )
    );
  }

  function setNota(id, nota) {
    setChecklist(prev =>
      prev.map(item => item.id === id ? { ...item, nota } : item)
    );
  }

  async function handleGuardar() {
    setSaving(true);
    try {
      await onSave({ id: declaracion.id, checklist, notas, estado });
    } finally {
      setSaving(false);
    }
  }

  const periodoLabel = (() => {
    const f = getForm(declaracion.formulario);
    if (f.periodicidad === "anual") {
      return declaracion.periodo?.split("-")[0] || declaracion.periodo;
    }
    return formatPeriodoLabel(declaracion.periodo);
  })();

  const allDone = progreso.total > 0 && progreso.completados === progreso.total;

  return (
    <>
      <div className="modal-header">
        <div className="decl-header-info">
          <span className="decl-form-chip" style={{ background: `${form.color}22`, color: form.color, borderColor: `${form.color}44` }}>
            {form.label}
          </span>
          <div>
            <div className="decl-cliente-nombre">{declaracion.clienteNombre}</div>
            <div className="decl-cliente-sub">{periodoLabel} · {declaracion.clienteRuc || "Sin RUC"}</div>
          </div>
        </div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>

      <div className="modal-body">
        {/* Progreso */}
        <div className="decl-progress-section">
          <div className="decl-progress-top">
            <span className="decl-progress-label">{progreso.completados} de {progreso.total} ítems completados</span>
            <span className="decl-progress-pct">{progreso.pct}%</span>
          </div>
          <div className="decl-progress-bar">
            <div className="decl-progress-fill" style={{ width: `${progreso.pct}%` }} />
          </div>
          {allDone && estado === "borrador" && (
            <p className="decl-suggest-listo">
              ✓ Todos los ítems completados — considera cambiar el estado a "Listo"
            </p>
          )}
        </div>

        {/* Checklist */}
        <div className="modal-section-label">Checklist de preparación</div>
        <div className="decl-checklist">
          {checklist.map(item => (
            <div key={item.id} className={`decl-item ${ITEM_CLASSES[item.estado]}`}>
              <button
                className="decl-item-toggle"
                onClick={() => toggleItem(item.id)}
                title={`Estado: ${item.estado} — click para cambiar`}
              >
                {ITEM_ICONS[item.estado]}
              </button>
              <div className="decl-item-body">
                <span className="decl-item-label">{item.label}</span>
                {item.estado !== "na" && (
                  <input
                    className="decl-item-nota"
                    type="text"
                    placeholder="Nota opcional..."
                    value={item.nota || ""}
                    onChange={e => setNota(item.id, e.target.value)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Notas generales */}
        <div className="modal-section-label">Notas generales</div>
        <div className="form-group">
          <textarea
            className="form-input"
            rows={3}
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Observaciones, instrucciones o recordatorios para esta declaración..."
          />
        </div>

        {/* Estado */}
        <div className="modal-section-label">Estado de la declaración</div>
        <div className="decl-estado-tabs">
          {[
            { key: "borrador",   label: "Borrador",             cls: "warn" },
            { key: "listo",      label: "Listo para presentar", cls: "blue" },
            { key: "presentado", label: "Presentado",           cls: "ok"   },
          ].map(s => (
            <button
              key={s.key}
              className={`decl-estado-tab ${estado === s.key ? `active-${s.cls}` : ""}`}
              onClick={() => setEstado(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
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

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────
export default function DeclaracionModal({ declaracion, clientes, onSave, onClose }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="decl-modal">
        {declaracion
          ? <ModoChecklist declaracion={declaracion} onSave={onSave} onClose={onClose} />
          : <ModoCrear clientes={clientes} onSave={onSave} onClose={onClose} />
        }
      </div>
    </div>
  );
}
