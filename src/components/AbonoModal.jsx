import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import "./AbonoModal.css";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

function formatPeriodo(periodo) {
  if (!periodo) return "";
  const [year, month] = periodo.split("-");
  return `${MESES[parseInt(month, 10) - 1]} ${year}`;
}

export default function AbonoModal({ cobro, onClose }) {
  const { empresaId } = useAuth();
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    monto: "",
    fecha: today,
    metodo: "transferencia",
    referencia: "",
    nota: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(e => ({ ...e, [name]: "" }));
    if (serverError) setServerError("");
  }

  function validate() {
    const errs = {};
    const monto = parseFloat(form.monto);
    if (!form.monto || isNaN(monto) || monto <= 0) {
      errs.monto = "Ingresa un monto válido mayor a $0";
    } else if (monto > cobro.montoPendiente + 0.001) {
      errs.monto = `El máximo es $${cobro.montoPendiente.toFixed(2)}`;
    }
    if (!form.fecha) errs.fecha = "La fecha es requerida";
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setServerError("");
    try {
      const nuevoAbono = {
        id:         crypto.randomUUID(),
        monto:      parseFloat(form.monto),
        fecha:      form.fecha,
        metodo:     form.metodo,
        referencia: form.referencia.trim(),
        nota:       form.nota.trim(),
      };
      const nuevosAbonos = [...(cobro.abonos || []), nuevoAbono];
      const montoPagado   = nuevosAbonos.reduce((s, a) => s + a.monto, 0);
      const montoPendiente = Math.max(0, cobro.montoTotal - montoPagado);
      const estado =
        montoPendiente <= 0                  ? "pagado"   :
        montoPagado    >  0                  ? "parcial"  :
                                               "pendiente";

      const ref = doc(db, "empresas", empresaId, "cobros", cobro.id);
      await updateDoc(ref, {
        abonos: nuevosAbonos,
        montoPagado,
        montoPendiente,
        estado,
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (err) {
      console.error(err);
      setServerError("Error al registrar el pago. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const refLabel =
    form.metodo === "cheque"       ? "N° de cheque"        :
    form.metodo === "transferencia"? "Referencia / comprobante" :
                                     null;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="abono-modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Registrar Pago</h2>
            <p className="abono-modal-sub">
              {cobro.clienteNombre} · {formatPeriodo(cobro.periodo)}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Resumen pendiente */}
          <div className="abono-resumen">
            <div className="abono-resumen-item">
              <span>Total cobro</span>
              <strong>${cobro.montoTotal.toFixed(2)}</strong>
            </div>
            <div className="abono-resumen-item">
              <span>Ya pagado</span>
              <strong className="text-green">${cobro.montoPagado.toFixed(2)}</strong>
            </div>
            <div className="abono-resumen-item abono-resumen-highlight">
              <span>Pendiente</span>
              <strong className="text-coral">${cobro.montoPendiente.toFixed(2)}</strong>
            </div>
          </div>

          {/* Monto */}
          <div className="form-group">
            <label className="form-label">Monto a pagar ($)</label>
            <input
              name="monto"
              type="number"
              min="0.01"
              step="0.01"
              max={cobro.montoPendiente}
              className={`form-input ${errors.monto ? "error" : ""}`}
              value={form.monto}
              onChange={handleChange}
              placeholder={`Máx. $${cobro.montoPendiente.toFixed(2)}`}
              autoFocus
            />
            {errors.monto && <p className="field-error">{errors.monto}</p>}
          </div>

          <div className="form-row">
            {/* Fecha */}
            <div className="form-group">
              <label className="form-label">Fecha</label>
              <input
                name="fecha"
                type="date"
                className={`form-input ${errors.fecha ? "error" : ""}`}
                value={form.fecha}
                onChange={handleChange}
              />
              {errors.fecha && <p className="field-error">{errors.fecha}</p>}
            </div>

            {/* Método */}
            <div className="form-group">
              <label className="form-label">Método de pago</label>
              <select name="metodo" className="form-input" value={form.metodo} onChange={handleChange}>
                <option value="transferencia">Transferencia bancaria</option>
                <option value="efectivo">Efectivo</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          {/* Referencia — solo si no es efectivo */}
          {refLabel && (
            <div className="form-group">
              <label className="form-label">{refLabel}</label>
              <input
                name="referencia"
                className="form-input"
                value={form.referencia}
                onChange={handleChange}
                placeholder="Opcional"
              />
            </div>
          )}

          {/* Nota */}
          <div className="form-group">
            <label className="form-label">Nota (opcional)</label>
            <textarea
              name="nota"
              className="form-input"
              rows={2}
              value={form.nota}
              onChange={handleChange}
              placeholder="Observaciones del pago..."
            />
          </div>

          {serverError && <div className="server-error">{serverError}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Registrando…" : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
