import { useState } from "react";
import "./ServicioModal.css";

const EMPTY = {
  nombre: "",
  categoria: "declaraciones-sri",
  precioBase: "",
  descripcion: "",
  estado: "activo",
};

export default function ServicioModal({ servicio, categorias, onSave, onClose }) {
  const [form, setForm] = useState(() =>
    servicio
      ? { ...EMPTY, ...servicio, precioBase: servicio.precioBase ?? "" }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: null }));
  }

  function validate() {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "El nombre del servicio es requerido.";
    if (form.precioBase === "" || isNaN(Number(form.precioBase)))
      e.precioBase = "Ingresa un precio base válido.";
    else if (Number(form.precioBase) < 0)
      e.precioBase = "El precio no puede ser negativo.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        precioBase: Number(form.precioBase),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="servicio-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            {servicio ? "Editar Servicio" : "Nuevo Servicio"}
          </div>
          <button className="modal-close" onClick={onClose} type="button">✕</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="modal-body">

          {/* Datos del servicio */}
          <div className="modal-section-label">Datos del Servicio</div>

          <div className="form-group">
            <label className="form-label">Nombre del Servicio *</label>
            <input
              className={`form-input ${errors.nombre ? "error" : ""}`}
              value={form.nombre}
              onChange={e => set("nombre", e.target.value)}
              placeholder="Ej: Declaración IVA (Formulario 104)"
              autoFocus
            />
            {errors.nombre && <div className="field-error">{errors.nombre}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Categoría *</label>
            <select
              className="form-input"
              value={form.categoria}
              onChange={e => set("categoria", e.target.value)}
            >
              {categorias.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Descripción (opcional)</label>
            <textarea
              className="form-input"
              rows={2}
              value={form.descripcion}
              onChange={e => set("descripcion", e.target.value)}
              placeholder="Detalle qué incluye este servicio..."
            />
          </div>

          {/* Precio y estado */}
          <div className="modal-section-label">Precio y Estado</div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Precio Base Mínimo ($) *</label>
              <input
                className={`form-input ${errors.precioBase ? "error" : ""}`}
                type="number"
                min="0"
                step="0.01"
                value={form.precioBase}
                onChange={e => set("precioBase", e.target.value)}
                placeholder="0.00"
              />
              {errors.precioBase && <div className="field-error">{errors.precioBase}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select
                className="form-input"
                value={form.estado}
                onChange={e => set("estado", e.target.value)}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="price-note">
            <span className="price-note-icon">⚠</span>
            Al asignar este servicio a un cliente, el precio cobrado puede ser igual
            o mayor al precio base, pero <strong>nunca menor</strong>.
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando..." : servicio ? "Guardar Cambios" : "Crear Servicio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
