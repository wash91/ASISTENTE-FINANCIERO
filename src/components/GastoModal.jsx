import { useState } from "react";
import {
  collection, addDoc, doc, updateDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { CATEGORIAS_GASTOS } from "../pages/Gastos";
import "./GastoModal.css";

export default function GastoModal({ gasto, clientes, onClose }) {
  const { empresaId } = useAuth();
  const isEdit = !!gasto;
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    tipo:          gasto?.tipo        || "negocio",
    categoria:     gasto?.categoria   || CATEGORIAS_GASTOS[0].key,
    descripcion:   gasto?.descripcion || "",
    monto:         gasto?.monto       != null ? String(gasto.monto) : "",
    fecha:         gasto?.fecha       || today,
    proveedor:     gasto?.proveedor   || "",
    clienteId:     gasto?.clienteId   || "",
    comprobante:   gasto?.comprobante || "",
    notas:         gasto?.notas       || "",
  });
  const [errors, setErrors]       = useState({});
  const [saving, setSaving]       = useState(false);
  const [serverError, setServerError] = useState("");

  const clientesActivos = (clientes || []).filter(c => c.estado === "activo");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(e => ({ ...e, [name]: "" }));
    if (serverError) setServerError("");
  }

  function validate() {
    const errs = {};
    if (!form.descripcion.trim()) errs.descripcion = "La descripción es requerida";
    const monto = parseFloat(form.monto);
    if (!form.monto || isNaN(monto) || monto <= 0) errs.monto = "Ingresa un monto válido mayor a $0";
    if (!form.fecha) errs.fecha = "La fecha es requerida";
    if (form.tipo === "cliente" && !form.clienteId) errs.clienteId = "Selecciona un cliente";
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setServerError("");
    try {
      const cliente = clientesActivos.find(c => c.id === form.clienteId);
      const data = {
        tipo:        form.tipo,
        categoria:   form.categoria,
        descripcion: form.descripcion.trim(),
        monto:       parseFloat(form.monto),
        fecha:       form.fecha,
        proveedor:   form.proveedor.trim(),
        comprobante: form.comprobante.trim(),
        notas:       form.notas.trim(),
        ...(form.tipo === "cliente" && cliente
          ? { clienteId: cliente.id, clienteNombre: cliente.nombre }
          : { clienteId: "", clienteNombre: "" }),
      };

      if (isEdit) {
        await updateDoc(
          doc(db, "empresas", empresaId, "gastos", gasto.id),
          { ...data, updatedAt: serverTimestamp() }
        );
      } else {
        await addDoc(
          collection(db, "empresas", empresaId, "gastos"),
          { ...data, createdAt: serverTimestamp() }
        );
      }
      onClose();
    } catch (err) {
      console.error(err);
      setServerError("Error al guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="gasto-modal">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? "Editar Gasto" : "Nuevo Gasto"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Tipo */}
          <div className="form-group">
            <label className="form-label">Tipo de gasto</label>
            <div className="gasto-tipo-tabs">
              {[
                { key: "negocio", label: "Del negocio" },
                { key: "cliente", label: "Por cliente" },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  className={`gasto-tipo-tab ${form.tipo === t.key ? "active" : ""}`}
                  onClick={() => {
                    setForm(f => ({ ...f, tipo: t.key, clienteId: "" }));
                    if (errors.clienteId) setErrors(e => ({ ...e, clienteId: "" }));
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            {/* Categoría */}
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select name="categoria" className="form-input" value={form.categoria} onChange={handleChange}>
                {CATEGORIAS_GASTOS.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>

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
          </div>

          {/* Descripción */}
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input
              name="descripcion"
              className={`form-input ${errors.descripcion ? "error" : ""}`}
              value={form.descripcion}
              onChange={handleChange}
              placeholder="Ej: Pago arriendo mes de febrero"
              autoFocus
            />
            {errors.descripcion && <p className="field-error">{errors.descripcion}</p>}
          </div>

          <div className="form-row">
            {/* Monto */}
            <div className="form-group">
              <label className="form-label">Monto ($)</label>
              <input
                name="monto"
                type="number"
                min="0.01"
                step="0.01"
                className={`form-input ${errors.monto ? "error" : ""}`}
                value={form.monto}
                onChange={handleChange}
                placeholder="0.00"
              />
              {errors.monto && <p className="field-error">{errors.monto}</p>}
            </div>

            {/* Proveedor */}
            <div className="form-group">
              <label className="form-label">Proveedor (opcional)</label>
              <input
                name="proveedor"
                className="form-input"
                value={form.proveedor}
                onChange={handleChange}
                placeholder="Ej: Inmobiliaria XYZ"
              />
            </div>
          </div>

          {/* Cliente — solo si tipo === cliente */}
          {form.tipo === "cliente" && (
            <div className="form-group">
              <label className="form-label">Cliente</label>
              {clientesActivos.length === 0 ? (
                <div className="gasto-no-clientes">No hay clientes activos registrados.</div>
              ) : (
                <select
                  name="clienteId"
                  className={`form-input ${errors.clienteId ? "error" : ""}`}
                  value={form.clienteId}
                  onChange={handleChange}
                >
                  <option value="">Seleccionar cliente...</option>
                  {clientesActivos.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              )}
              {errors.clienteId && <p className="field-error">{errors.clienteId}</p>}
            </div>
          )}

          {/* Comprobante */}
          <div className="form-group">
            <label className="form-label">N° Comprobante / Factura (opcional)</label>
            <input
              name="comprobante"
              className="form-input"
              value={form.comprobante}
              onChange={handleChange}
              placeholder="Ej: FAC-001-2026"
            />
          </div>

          {/* Notas */}
          <div className="form-group">
            <label className="form-label">Notas (opcional)</label>
            <textarea
              name="notas"
              className="form-input"
              rows={2}
              value={form.notas}
              onChange={handleChange}
              placeholder="Observaciones adicionales..."
            />
          </div>

          {serverError && <div className="server-error">{serverError}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Registrar gasto"}
          </button>
        </div>
      </div>
    </div>
  );
}
