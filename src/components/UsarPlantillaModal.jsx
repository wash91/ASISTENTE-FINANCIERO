import { useState, useEffect, useMemo } from "react";
import "./UsarPlantillaModal.css";

// Variables que se auto-rellenan desde el cliente seleccionado
const AUTO_MAP = {
  cliente:        c => c?.nombre || "",
  diaVencimiento: c => c?.vencimientoSRI ? String(c.vencimientoSRI) : "",
};

function getVarNames(cuerpo) {
  const matches = (cuerpo || "").match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, "")))];
}

function applyVars(cuerpo, valores) {
  return (cuerpo || "").replace(/\{\{(\w+)\}\}/g, (_, key) => valores[key] || `{{${key}}}`);
}

export default function UsarPlantillaModal({ plantilla, clientes, onClose }) {
  const varNames = useMemo(() => getVarNames(plantilla.cuerpo), [plantilla.cuerpo]);

  const [clienteId, setClienteId] = useState("");
  const [valores, setValores] = useState(() =>
    Object.fromEntries(varNames.map(v => [v, ""]))
  );
  const [copied, setCopied] = useState(false);

  // Auto-rellenar variables desde el cliente seleccionado
  useEffect(() => {
    const cliente = clientes.find(c => c.id === clienteId) || null;
    setValores(prev => {
      const next = { ...prev };
      varNames.forEach(v => {
        if (AUTO_MAP[v]) next[v] = AUTO_MAP[v](cliente);
      });
      return next;
    });
  }, [clienteId, clientes, varNames]);

  // Preview en tiempo real
  const preview = useMemo(
    () => applyVars(plantilla.cuerpo, valores),
    [plantilla.cuerpo, valores]
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API no disponible — el usuario puede copiar manualmente del preview
    }
  }

  function handleWhatsApp() {
    window.open(
      "https://wa.me/?text=" + encodeURIComponent(preview),
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="usar-modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Usar plantilla</h2>
            <p className="usar-modal-sub">{plantilla.nombre}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Selector de cliente */}
          <div className="form-group">
            <label className="form-label">Seleccionar cliente (opcional)</label>
            <select
              className="form-input"
              value={clienteId}
              onChange={e => setClienteId(e.target.value)}
            >
              <option value="">— Sin cliente específico —</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Variables del mensaje */}
          {varNames.length > 0 && (
            <div className="usar-vars-section">
              <div className="modal-section-label">Variables del mensaje</div>
              {varNames.map(v => (
                <div className="form-group" key={v}>
                  <label className="form-label usar-var-label">
                    <span className="usar-var-chip">{`{{${v}}}`}</span>
                    {AUTO_MAP[v] && (
                      <span className="usar-var-auto">· Auto-relleno</span>
                    )}
                  </label>
                  <input
                    className="form-input"
                    value={valores[v]}
                    onChange={e => setValores(prev => ({ ...prev, [v]: e.target.value }))}
                    placeholder={`Valor para {{${v}}}`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Vista previa */}
          <div className="modal-section-label">Vista previa del mensaje</div>
          <div className="usar-preview">
            {preview.split("\n").map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </div>
        </div>

        <div className="modal-footer usar-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <div className="usar-footer-actions">
            <button
              className={`btn usar-copy-btn ${copied ? "usar-copy-ok" : "btn-ghost"}`}
              onClick={handleCopy}
            >
              {copied ? "Copiado ✓" : "⧉ Copiar mensaje"}
            </button>
            <button className="btn btn-primary" onClick={handleWhatsApp}>
              ↗ Abrir WhatsApp Web
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
