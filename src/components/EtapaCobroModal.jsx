import { useState } from "react";
import "./EtapaCobroModal.css";

const METODOS = [
  { key: "transferencia", label: "Transferencia bancaria" },
  { key: "efectivo",      label: "Efectivo" },
  { key: "cheque",        label: "Cheque" },
];

export default function EtapaCobroModal({ etapa, onSave, onClose }) {
  const montoPendiente = Math.max(0,
    (etapa.montoPresupuestado || 0) - (etapa.montoPagado || 0)
  );

  const hoy = new Date().toISOString().split("T")[0];

  const [monto,      setMonto]      = useState("");
  const [fecha,      setFecha]      = useState(hoy);
  const [metodo,     setMetodo]     = useState("transferencia");
  const [referencia, setReferencia] = useState("");
  const [nota,       setNota]       = useState("");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit() {
    const m = parseFloat(monto);
    if (!m || m <= 0) {
      setError("Ingresa un monto válido mayor a cero.");
      return;
    }
    if (m > montoPendiente + 0.01) {
      setError(`El máximo pendiente es $${montoPendiente.toFixed(2)}.`);
      return;
    }
    setSaving(true);
    try {
      await onSave(etapa, { fecha, monto: m, metodo, referencia: referencia.trim(), nota: nota.trim() });
    } finally {
      setSaving(false);
    }
  }

  const metodoLabel = METODOS.find(m => m.key === metodo)?.label || "";

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="etapa-cobro-modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Registrar Cobro</h2>
            <p className="etapa-cobro-sub">{etapa.nombre}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Resumen */}
          <div className="etapa-cobro-resumen">
            <div className="etapa-cobro-res-item">
              <span className="etapa-cobro-res-label">Presupuestado</span>
              <span className="etapa-cobro-res-val">${(etapa.montoPresupuestado || 0).toFixed(2)}</span>
            </div>
            <div className="etapa-cobro-res-item">
              <span className="etapa-cobro-res-label">Ya cobrado</span>
              <span className="etapa-cobro-res-val ok">${(etapa.montoPagado || 0).toFixed(2)}</span>
            </div>
            <div className="etapa-cobro-res-item">
              <span className="etapa-cobro-res-label">Pendiente</span>
              <span className="etapa-cobro-res-val warn">${montoPendiente.toFixed(2)}</span>
            </div>
          </div>

          {/* Formulario */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Monto a cobrar ($)</label>
              <input
                className={`form-input ${error ? "input-error" : ""}`}
                type="number"
                step="0.01"
                min="0.01"
                max={montoPendiente}
                value={monto}
                onChange={e => { setMonto(e.target.value); setError(""); }}
                placeholder="0.00"
                disabled={saving}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha</label>
              <input
                className="form-input"
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Método de pago</label>
            <select
              className="form-input"
              value={metodo}
              onChange={e => setMetodo(e.target.value)}
              disabled={saving}
            >
              {METODOS.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              {metodo === "transferencia" ? "Nro. de comprobante" : metodo === "cheque" ? "Nro. de cheque" : "Referencia (opcional)"}
            </label>
            <input
              className="form-input"
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              placeholder="Opcional"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Nota (opcional)</label>
            <input
              className="form-input"
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Observación interna"
              disabled={saving}
            />
          </div>

          {error && <p className="field-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || montoPendiente <= 0}>
            {saving ? "Registrando..." : "Registrar cobro"}
          </button>
        </div>
      </div>
    </div>
  );
}
