import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { CATEGORIAS } from "../pages/Servicios";
import "./AsignacionModal.css";

function getCatColor(categoria) {
  return CATEGORIAS.find(c => c.key === categoria)?.color || "#7A8BAA";
}

function getCatLabel(categoria) {
  return CATEGORIAS.find(c => c.key === categoria)?.label || categoria;
}

export default function AsignacionModal({ cliente, serviciosCatalogo, onClose }) {
  const { empresaId } = useAuth();

  // Estado local — copia editable de los servicios asignados
  const [localServicios, setLocalServicios] = useState(
    (cliente.servicios || []).map(s => ({ ...s }))
  );

  // Formulario "añadir servicio"
  const [selectedId, setSelectedId] = useState("");
  const [addPrecio, setAddPrecio] = useState("");
  const [addError, setAddError] = useState("");

  // Errores de precio por servicioId
  const [precioErrors, setPrecioErrors] = useState({});

  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  // Servicios del catálogo que aún no están asignados
  const disponibles = serviciosCatalogo.filter(
    s => !localServicios.some(a => a.servicioId === s.id)
  );

  // Cuando cambia el servicio seleccionado en el dropdown, pre-rellenar precio
  function handleSelectServicio(id) {
    setSelectedId(id);
    setAddError("");
    if (id) {
      const svc = serviciosCatalogo.find(s => s.id === id);
      setAddPrecio(svc ? String(svc.precioBase) : "");
    } else {
      setAddPrecio("");
    }
  }

  function handleAddServicio() {
    if (!selectedId) { setAddError("Selecciona un servicio."); return; }
    const svc = serviciosCatalogo.find(s => s.id === selectedId);
    if (!svc) return;
    const precio = parseFloat(addPrecio);
    if (isNaN(precio) || precio < svc.precioBase) {
      setAddError(`El precio mínimo es $${svc.precioBase.toFixed(2)}.`);
      return;
    }
    setLocalServicios(prev => [
      ...prev,
      {
        servicioId:      svc.id,
        nombre:          svc.nombre,
        categoria:       svc.categoria,
        precioBase:      svc.precioBase,
        precioAsignado:  precio,
        estado:          "activo",
        fechaAsignacion: new Date().toISOString(), // placeholder; serverTimestamp en el doc
      }
    ]);
    setSelectedId("");
    setAddPrecio("");
    setAddError("");
  }

  function handleRemove(servicioId) {
    setLocalServicios(prev => prev.filter(s => s.servicioId !== servicioId));
    setPrecioErrors(prev => { const e = { ...prev }; delete e[servicioId]; return e; });
  }

  function handlePrecioChange(servicioId, value) {
    setLocalServicios(prev =>
      prev.map(s => s.servicioId === servicioId
        ? { ...s, precioAsignado: value === "" ? "" : parseFloat(value) || 0 }
        : s
      )
    );
    // Limpiar error si valor válido
    const svc = localServicios.find(s => s.servicioId === servicioId);
    if (svc && parseFloat(value) >= svc.precioBase) {
      setPrecioErrors(prev => { const e = { ...prev }; delete e[servicioId]; return e; });
    }
  }

  function validate() {
    const errs = {};
    for (const s of localServicios) {
      const precio = typeof s.precioAsignado === "number" ? s.precioAsignado : parseFloat(s.precioAsignado);
      if (isNaN(precio) || precio < s.precioBase) {
        errs[s.servicioId] = `Mínimo $${s.precioBase.toFixed(2)}`;
      }
    }
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) { setPrecioErrors(errs); return; }

    setSaving(true);
    setServerError("");
    try {
      const ref = doc(db, "empresas", empresaId, "clientes", cliente.id);
      // Normalizar: guardar precioAsignado como número
      const toSave = localServicios.map(s => ({
        servicioId:      s.servicioId,
        nombre:          s.nombre,
        categoria:       s.categoria,
        precioBase:      s.precioBase,
        precioAsignado:  typeof s.precioAsignado === "number"
                           ? s.precioAsignado
                           : parseFloat(s.precioAsignado),
        estado:          "activo",
        fechaAsignacion: s.fechaAsignacion,
      }));
      await updateDoc(ref, { servicios: toSave, updatedAt: serverTimestamp() });
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
      <div className="asignacion-modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Servicios asignados</h2>
            <p className="asig-modal-sub">{cliente.nombre}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Lista de servicios asignados */}
          {localServicios.length === 0 ? (
            <div className="asig-empty">
              <div className="asig-empty-icon">⊞</div>
              <p>Sin servicios asignados</p>
              <span>Añade servicios del catálogo a este cliente.</span>
            </div>
          ) : (
            <div className="asig-list">
              {localServicios.map(s => (
                <div className="asig-item" key={s.servicioId}>
                  <div className="asig-item-top">
                    <div className="asig-item-name">
                      <span
                        className="asig-cat-dot"
                        style={{ background: getCatColor(s.categoria) }}
                      />
                      {s.nombre}
                    </div>
                    <span className="badge badge-blue" style={{ fontSize: "10px" }}>
                      {getCatLabel(s.categoria)}
                    </span>
                    <button
                      className="asig-remove"
                      onClick={() => handleRemove(s.servicioId)}
                      title="Quitar servicio"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="asig-item-bottom">
                    <span className="asig-base">Base: ${s.precioBase.toFixed(2)}</span>
                    <div className="asig-precio-wrap">
                      <span className="asig-precio-sym">$</span>
                      <input
                        type="number"
                        className={`asig-precio-input form-input ${precioErrors[s.servicioId] ? "error" : ""}`}
                        value={s.precioAsignado}
                        min={s.precioBase}
                        step="0.01"
                        onChange={e => handlePrecioChange(s.servicioId, e.target.value)}
                      />
                    </div>
                    {precioErrors[s.servicioId] && (
                      <span className="field-error">{precioErrors[s.servicioId]}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Añadir servicio */}
          {disponibles.length > 0 && (
            <div className="asig-add-section">
              <div className="modal-section-label">Añadir servicio</div>
              <div className="asig-add-row">
                <select
                  className="form-input asig-select"
                  value={selectedId}
                  onChange={e => handleSelectServicio(e.target.value)}
                >
                  <option value="">Seleccionar servicio...</option>
                  {disponibles.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} (Base: ${s.precioBase.toFixed(2)})
                    </option>
                  ))}
                </select>
                <div className="asig-precio-wrap">
                  <span className="asig-precio-sym">$</span>
                  <input
                    type="number"
                    className="form-input asig-precio-input"
                    value={addPrecio}
                    placeholder="0.00"
                    min={0}
                    step="0.01"
                    onChange={e => { setAddPrecio(e.target.value); setAddError(""); }}
                  />
                </div>
                <button
                  className="btn btn-primary btn-sm asig-add-btn"
                  onClick={handleAddServicio}
                  disabled={!selectedId}
                >
                  + Añadir
                </button>
              </div>
              {addError && <p className="field-error">{addError}</p>}
            </div>
          )}

          {serverError && (
            <div className="server-error" style={{ marginTop: "12px" }}>{serverError}</div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
