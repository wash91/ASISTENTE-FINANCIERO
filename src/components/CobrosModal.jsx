import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import "./CobrosModal.css";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

export default function CobrosModal({ clientes, onClose }) {
  const { empresaId } = useAuth();
  const now = new Date();

  const [clienteId, setClienteId] = useState("");
  const [mes, setMes] = useState(now.getMonth() + 1);       // 1-12
  const [anio, setAnio] = useState(now.getFullYear());
  const [concepto, setConcepto] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  // Solo clientes activos con servicios asignados
  const clientesDisponibles = clientes.filter(
    c => c.estado === "activo" && (c.servicios || []).length > 0
  );

  const clienteSeleccionado = clientesDisponibles.find(c => c.id === clienteId) || null;

  const montoTotal = clienteSeleccionado
    ? (clienteSeleccionado.servicios || []).reduce((s, sv) => s + sv.precioAsignado, 0)
    : 0;

  function buildConcepto(m, a) {
    return `Servicios mensuales — ${MESES[m - 1]} ${a}`;
  }

  function handleClienteChange(id) {
    setClienteId(id);
    if (errors.clienteId) setErrors(e => ({ ...e, clienteId: "" }));
    if (serverError) setServerError("");
  }

  function handleMesChange(v) {
    const m = parseInt(v, 10);
    setMes(m);
    setConcepto(buildConcepto(m, anio));
  }

  function handleAnioChange(v) {
    const a = parseInt(v, 10) || anio;
    setAnio(a);
    setConcepto(buildConcepto(mes, a));
  }

  // Pre-rellenar concepto al seleccionar cliente
  function handleClienteSelect(id) {
    handleClienteChange(id);
    if (!concepto) setConcepto(buildConcepto(mes, anio));
  }

  function validate() {
    const errs = {};
    if (!clienteId) errs.clienteId = "Selecciona un cliente";
    if (!anio || anio < 2000 || anio > 2100) errs.anio = "Año inválido";
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setServerError("");
    try {
      const cliente = clienteSeleccionado;
      const periodoStr = `${anio}-${String(mes).padStart(2, "0")}`;
      const detalles = (cliente.servicios || []).map(s => ({
        nombre:         s.nombre,
        categoria:      s.categoria,
        precioAsignado: s.precioAsignado,
      }));

      await addDoc(collection(db, "empresas", empresaId, "cobros"), {
        clienteId:      cliente.id,
        clienteNombre:  cliente.nombre,
        clienteRuc:     cliente.ruc || "",
        periodo:        periodoStr,
        concepto:       concepto.trim() || buildConcepto(mes, anio),
        detalles,
        montoTotal,
        montoPagado:    0,
        montoPendiente: montoTotal,
        estado:         "pendiente",
        abonos:         [],
        fechaEmision:   serverTimestamp(),
        createdAt:      serverTimestamp(),
      });
      onClose();
    } catch (err) {
      console.error(err);
      setServerError("Error al emitir el cobro. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cobros-modal">
        <div className="modal-header">
          <h2 className="modal-title">Nuevo Cobro</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Cliente */}
          <div className="form-group">
            <label className="form-label">Cliente</label>
            {clientesDisponibles.length === 0 ? (
              <div className="cobros-no-clientes">
                No hay clientes activos con servicios asignados.
                Asigna servicios desde la sección Clientes primero.
              </div>
            ) : (
              <select
                className={`form-input ${errors.clienteId ? "error" : ""}`}
                value={clienteId}
                onChange={e => handleClienteSelect(e.target.value)}
              >
                <option value="">Seleccionar cliente...</option>
                {clientesDisponibles.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} — {c.ruc}
                  </option>
                ))}
              </select>
            )}
            {errors.clienteId && <p className="field-error">{errors.clienteId}</p>}
          </div>

          {/* Período */}
          <div className="cobros-periodo-row">
            <div className="form-group">
              <label className="form-label">Mes</label>
              <select
                className="form-input"
                value={mes}
                onChange={e => handleMesChange(e.target.value)}
              >
                {MESES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Año</label>
              <input
                type="number"
                className={`form-input ${errors.anio ? "error" : ""}`}
                value={anio}
                min={2000}
                max={2100}
                onChange={e => handleAnioChange(e.target.value)}
              />
              {errors.anio && <p className="field-error">{errors.anio}</p>}
            </div>
          </div>

          {/* Desglose servicios */}
          {clienteSeleccionado && (
            <div className="cobros-desglose">
              <div className="modal-section-label">Desglose de servicios</div>
              <div className="cobros-desglose-lista">
                {(clienteSeleccionado.servicios || []).map(s => (
                  <div className="cobros-desglose-item" key={s.servicioId}>
                    <span className="cobros-desglose-nombre">{s.nombre}</span>
                    <span className="cobros-desglose-precio">
                      ${s.precioAsignado.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="cobros-desglose-total">
                <span>Total</span>
                <strong>${montoTotal.toFixed(2)}</strong>
              </div>
            </div>
          )}

          {/* Concepto */}
          <div className="form-group">
            <label className="form-label">Concepto</label>
            <input
              className="form-input"
              value={concepto || buildConcepto(mes, anio)}
              onChange={e => setConcepto(e.target.value)}
              placeholder={buildConcepto(mes, anio)}
            />
          </div>

          {serverError && <div className="server-error">{serverError}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !clienteId || montoTotal <= 0}
          >
            {saving ? "Emitiendo…" : `Emitir cobro · $${montoTotal.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
