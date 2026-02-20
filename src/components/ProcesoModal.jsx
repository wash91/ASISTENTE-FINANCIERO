import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import "./ProcesoModal.css";

const TIPOS = [
  "Declaración IVA (F.104)",
  "Retenciones en la Fuente (F.103)",
  "Impuesto a la Renta (F.101)",
  "Rel. Dependencia (F.107)",
  "IESS — Planilla",
  "Anexo Transaccional",
  "Otro proceso",
];

function getInitials(nombre) {
  return (nombre || "?")
    .split(" ").filter(Boolean).slice(0, 2)
    .map(w => w[0]).join("").toUpperCase();
}

export default function ProcesoModal({ cliente, dia, obligacion, onSave, onClose, onDocumentos, onCobro, onWhatsapp }) {
  const [tipo, setTipo] = useState(obligacion?.tipo || TIPOS[0]);
  const [notas, setNotas] = useState(obligacion?.notas || "");
  const [saving, setSaving] = useState(false);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isCompletado = obligacion?.estado === "completado";
  const isVencido    = !isCompletado && dia < today;
  const estadoLabel  = isCompletado ? "Completado" : isVencido ? "Vencido" : "Pendiente";
  const estadoBadge  = isCompletado ? "ok"         : isVencido ? "bad"    : "warn";

  async function handleAction(action) {
    setSaving(true);
    try {
      await onSave({ action, tipo, notas, id: obligacion?.id });
    } finally {
      setSaving(false);
    }
  }

  const periodoLabel = format(dia, "MMMM yyyy", { locale: es })
    .replace(/^\w/, c => c.toUpperCase());

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="proceso-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div className="pm-client-info">
            <div className="pm-avatar">{getInitials(cliente.nombre)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="pm-client-nombre">{cliente.nombre}</div>
              <div className="pm-client-ruc">{cliente.ruc || "Sin RUC"}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} type="button">✕</button>
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* Info chips */}
          <div className="pm-chips">
            <div className="pm-chip">
              <span className="pm-chip-label">Período</span>
              <span className="pm-chip-val">{periodoLabel}</span>
            </div>
            <div className="pm-chip">
              <span className="pm-chip-label">Vencimiento</span>
              <span className="pm-chip-val">Día {cliente.vencimientoSRI}</span>
            </div>
            <span className={`badge badge-${estadoBadge}`}>{estadoLabel}</span>
          </div>

          {/* Tipo de proceso */}
          <div className="modal-section-label">Tipo de Proceso</div>
          <div className="form-group">
            <select
              className="form-input"
              value={tipo}
              onChange={e => setTipo(e.target.value)}
            >
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Notas */}
          <div className="modal-section-label">Notas y Observaciones</div>
          <div className="form-group">
            <textarea
              className="form-input"
              rows={3}
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones, recordatorios, detalles del proceso..."
            />
          </div>

          {/* Acciones rápidas */}
          <div className="modal-section-label">Acciones rápidas</div>
          <div className="pm-quick-actions">
            <button
              className="btn btn-ghost pm-action-btn"
              onClick={() => onDocumentos(cliente)}
            >
              📁 Ver documentos
            </button>
            <button
              className="btn btn-ghost pm-action-btn"
              onClick={() => onCobro(cliente)}
            >
              💰 Registrar cobro
            </button>
            <button
              className="btn btn-ghost pm-action-btn"
              onClick={() => onWhatsapp(cliente)}
            >
              💬 Enviar WhatsApp
            </button>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button
              className="btn btn-ghost"
              onClick={() => handleAction("guardar")}
              disabled={saving}
            >
              Guardar notas
            </button>
            <button
              className={`btn ${isCompletado ? "btn-ghost" : "btn-primary"}`}
              onClick={() => handleAction(isCompletado ? "reabrir" : "completar")}
              disabled={saving}
            >
              {saving ? "..." : isCompletado ? "↺ Reabrir" : "✓ Completado"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
