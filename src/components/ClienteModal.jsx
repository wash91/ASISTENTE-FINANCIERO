import { useState } from "react";
import "./ClienteModal.css";

const DIGITO_MAP = { 0: 28, 1: 10, 2: 12, 3: 14, 4: 16, 5: 20, 6: 20, 7: 22, 8: 24, 9: 26 };

function detectarDigitoSRI(ruc) {
  if (!ruc || ruc.length < 10) return null;
  const d = parseInt(ruc[9]);
  if (isNaN(d)) return null;
  return { digito: d, vencimiento: DIGITO_MAP[d] };
}

const PORTALES = [
  { key: "sri",       label: "SRI",       icon: "🏛",  color: "var(--blue)" },
  { key: "iess",      label: "IESS",      icon: "🏥",  color: "var(--green)" },
  { key: "mdt",       label: "MDT / SUT", icon: "💼",  color: "var(--amber)" },
  { key: "supercias", label: "Supercias", icon: "🏢",  color: "#9B7FDB" },
];

const EMPTY_CRED = {
  sri:      { usuario: "", clave: "" },
  iess:     { usuario: "", clave: "" },
  mdt:      { usuario: "", clave: "" },
  supercias: { usuario: "", clave: "" },
  notas:    "",
};

const EMPTY = {
  nombre: "",
  ruc: "",
  email: "",
  telefono: "",
  direccion: "",
  mensualidad: "",
  estado: "activo",
  acuerdoConfidencialidad: false,
  digitoSRI: null,
  vencimientoSRI: null,
  credenciales: EMPTY_CRED,
};

function PortalRow({ portal, cred, onChange }) {
  const [showClave, setShowClave] = useState(false);
  return (
    <div className="cred-portal-row">
      <div className="cred-portal-hdr">
        <span className="cred-portal-icon">{portal.icon}</span>
        <span className="cred-portal-label" style={{ color: portal.color }}>{portal.label}</span>
      </div>
      <div className="cred-portal-fields">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Usuario / Correo</label>
          <input
            className="form-input"
            value={cred.usuario}
            onChange={e => onChange("usuario", e.target.value)}
            placeholder="usuario o correo"
            autoComplete="off"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Contraseña</label>
          <div className="cred-pass-wrap">
            <input
              className="form-input"
              type={showClave ? "text" : "password"}
              value={cred.clave}
              onChange={e => onChange("clave", e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <button
              type="button"
              className="cred-eye-btn"
              onClick={() => setShowClave(s => !s)}
              title={showClave ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showClave ? "🙈" : "👁"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClienteModal({ cliente, onSave, onClose, initialTab = "datos" }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [form, setForm] = useState(() =>
    cliente
      ? {
          ...EMPTY,
          ...cliente,
          mensualidad: cliente.mensualidad ?? "",
          credenciales: { ...EMPTY_CRED, ...(cliente.credenciales || {}) },
        }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  function handleRUC(val) {
    const ruc = val.replace(/\D/g, "").slice(0, 13);
    const sri = detectarDigitoSRI(ruc);
    setForm(f => ({
      ...f,
      ruc,
      digitoSRI: sri?.digito ?? null,
      vencimientoSRI: sri?.vencimiento ?? null,
    }));
    if (errors.ruc) setErrors(e => ({ ...e, ruc: null }));
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: null }));
  }

  function setCred(portal, field, value) {
    setForm(f => ({
      ...f,
      credenciales: {
        ...f.credenciales,
        [portal]: { ...f.credenciales[portal], [field]: value },
      },
    }));
  }

  function validate() {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es requerido.";
    if (form.ruc && form.ruc.length > 0 && form.ruc.length !== 13)
      e.ruc = "El RUC debe tener 13 dígitos.";
    if (form.mensualidad !== "" && isNaN(Number(form.mensualidad)))
      e.mensualidad = "Ingresa un monto válido.";
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
        mensualidad: form.mensualidad !== "" ? Number(form.mensualidad) : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cliente-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            {cliente ? "Editar Cliente" : "Nuevo Cliente"}
          </div>
          <button className="modal-close" onClick={onClose} type="button">✕</button>
        </div>

        {/* Tabs */}
        <div className="cm-tabs">
          <button
            type="button"
            className={`cm-tab ${activeTab === "datos" ? "active" : ""}`}
            onClick={() => setActiveTab("datos")}
          >
            Datos
          </button>
          <button
            type="button"
            className={`cm-tab ${activeTab === "credenciales" ? "active" : ""}`}
            onClick={() => setActiveTab("credenciales")}
          >
            🔑 Credenciales
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="modal-body">

          {/* ── TAB DATOS ── */}
          {activeTab === "datos" && (
            <>
              <div className="modal-section-label">Datos del Contribuyente</div>

              <div className="form-group">
                <label className="form-label">Nombre / Razón Social *</label>
                <input
                  className={`form-input ${errors.nombre ? "error" : ""}`}
                  value={form.nombre}
                  onChange={e => set("nombre", e.target.value)}
                  placeholder="Ej: Ferretería Sucre S.A.S."
                  autoFocus
                />
                {errors.nombre && <div className="field-error">{errors.nombre}</div>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">RUC</label>
                  <input
                    className={`form-input ${errors.ruc ? "error" : ""}`}
                    value={form.ruc}
                    onChange={e => handleRUC(e.target.value)}
                    placeholder="0000000000001"
                    maxLength={13}
                    inputMode="numeric"
                  />
                  {errors.ruc && <div className="field-error">{errors.ruc}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Vencimiento SRI</label>
                  {form.vencimientoSRI ? (
                    <div className="sri-chip">
                      <div className="sri-chip-dot" />
                      Día {form.vencimientoSRI} de cada mes
                    </div>
                  ) : (
                    <div className="sri-chip sri-chip-empty">
                      Auto-detectado al ingresar RUC
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-section-label">Datos de Contacto</div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Correo Electrónico</label>
                  <input
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={e => set("email", e.target.value)}
                    placeholder="correo@empresa.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input
                    className="form-input"
                    value={form.telefono}
                    onChange={e => set("telefono", e.target.value)}
                    placeholder="0999 000 000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Dirección</label>
                <input
                  className="form-input"
                  value={form.direccion}
                  onChange={e => set("direccion", e.target.value)}
                  placeholder="Ej: Av. Amazonas 123, Macas"
                />
              </div>

              <div className="modal-section-label">Datos de Servicio</div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Mensualidad ($)</label>
                  <input
                    className={`form-input ${errors.mensualidad ? "error" : ""}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.mensualidad}
                    onChange={e => set("mensualidad", e.target.value)}
                    placeholder="0.00"
                  />
                  {errors.mensualidad && <div className="field-error">{errors.mensualidad}</div>}
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

              <div className="modal-section-label">Acuerdo Legal</div>

              <label className="checkbox-wrap">
                <input
                  type="checkbox"
                  style={{ display: "none" }}
                  checked={form.acuerdoConfidencialidad}
                  onChange={e => set("acuerdoConfidencialidad", e.target.checked)}
                />
                <div className={`checkbox-box ${form.acuerdoConfidencialidad ? "checked" : ""}`}>
                  {form.acuerdoConfidencialidad && "✓"}
                </div>
                <div>
                  <div className="checkbox-label">Acuerdo de confidencialidad firmado</div>
                  <div className="checkbox-sub">
                    El cliente autorizó el manejo de su información tributaria
                  </div>
                </div>
              </label>
            </>
          )}

          {/* ── TAB CREDENCIALES ── */}
          {activeTab === "credenciales" && (
            <>
              <div className="cred-warning">
                ⚠ Información confidencial — manéjala solo con autorización del cliente.
              </div>

              {PORTALES.map(p => (
                <PortalRow
                  key={p.key}
                  portal={p}
                  cred={form.credenciales[p.key] || { usuario: "", clave: "" }}
                  onChange={(f, v) => setCred(p.key, f, v)}
                />
              ))}

              <div className="form-group" style={{ marginTop: "8px" }}>
                <label className="form-label">Notas adicionales</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Ej: clave RISE, portal Municipio, usuario banco..."
                  value={form.credenciales.notas || ""}
                  onChange={e => setForm(f => ({
                    ...f,
                    credenciales: { ...f.credenciales, notas: e.target.value },
                  }))}
                  style={{ resize: "vertical" }}
                />
              </div>
            </>
          )}

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando..." : cliente ? "Guardar Cambios" : "Registrar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
