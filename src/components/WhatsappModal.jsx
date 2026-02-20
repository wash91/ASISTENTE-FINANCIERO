import { useState } from "react";
import { CATEGORIAS_WA } from "../pages/Whatsapp";
import "./WhatsappModal.css";

function getVars(cuerpo) {
  return [...new Set((cuerpo || "").match(/\{\{(\w+)\}\}/g) || [])];
}

export default function WhatsappModal({ plantilla, onSave, onClose }) {
  const editing = !!plantilla;

  const [nombre,    setNombre]    = useState(plantilla?.nombre    || "");
  const [categoria, setCategoria] = useState(plantilla?.categoria || CATEGORIAS_WA[0].key);
  const [estado,    setEstado]    = useState(plantilla?.estado    || "activo");
  const [cuerpo,    setCuerpo]    = useState(plantilla?.cuerpo    || "");
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState({});

  const vars = getVars(cuerpo);

  function validate() {
    const e = {};
    if (!nombre.trim()) e.nombre = "El nombre es obligatorio.";
    if (!cuerpo.trim()) e.cuerpo = "El cuerpo del mensaje es obligatorio.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        ...(editing ? { id: plantilla.id, createdAt: plantilla.createdAt } : {}),
        nombre:    nombre.trim(),
        categoria,
        estado,
        cuerpo:    cuerpo.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wa-modal">
        <div className="modal-header">
          <h2 className="modal-title">{editing ? "Editar Plantilla" : "Nueva Plantilla"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nombre descriptivo</label>
            <input
              className={`form-input ${errors.nombre ? "input-error" : ""}`}
              value={nombre}
              onChange={e => { setNombre(e.target.value); setErrors(v => ({ ...v, nombre: "" })); }}
              placeholder="Ej: Recordatorio cobro pendiente"
              disabled={saving}
            />
            {errors.nombre && <p className="field-error">{errors.nombre}</p>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select
                className="form-input"
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                disabled={saving}
              >
                {CATEGORIAS_WA.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Estado</label>
              <select
                className="form-input"
                value={estado}
                onChange={e => setEstado(e.target.value)}
                disabled={saving}
              >
                <option value="activo">Activa</option>
                <option value="inactivo">Inactiva</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Cuerpo del mensaje</label>
            <textarea
              className={`form-input wa-textarea ${errors.cuerpo ? "input-error" : ""}`}
              value={cuerpo}
              onChange={e => { setCuerpo(e.target.value); setErrors(v => ({ ...v, cuerpo: "" })); }}
              placeholder={`Ej: Hola {{cliente}}, le recordamos que su pago de ${{monto}} por el período {{periodo}} está pendiente. Saludos, ContaServ.`}
              rows={5}
              disabled={saving}
            />
            {errors.cuerpo && <p className="field-error">{errors.cuerpo}</p>}
          </div>

          {/* Variables detectadas en tiempo real */}
          {vars.length > 0 && (
            <div className="wa-vars-preview">
              <span className="wa-vars-label">Variables detectadas:</span>
              {vars.map(v => (
                <span key={v} className="wa-var-chip-modal">{v}</span>
              ))}
            </div>
          )}

          <div className="wa-hint">
            Usa <code>{"{{variable}}"}</code> para insertar datos dinámicos.
            Variables comunes: <code>{"{{cliente}}"}</code>, <code>{"{{monto}}"}</code>,{" "}
            <code>{"{{periodo}}"}</code>, <code>{"{{diaVencimiento}}"}</code>, <code>{"{{fecha}}"}</code>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : "Guardar plantilla"}
          </button>
        </div>
      </div>
    </div>
  );
}
