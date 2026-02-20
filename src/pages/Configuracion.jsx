import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import "./Configuracion.css";

const MAX_SIZE_MB = 2;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

function validateImage(file) {
  if (!ALLOWED_TYPES.includes(file.type)) return "Solo se permiten imágenes JPG, PNG, WebP o SVG.";
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return `El archivo supera los ${MAX_SIZE_MB}MB permitidos.`;
  return null;
}

const EMPTY_FORM = {
  nombre:    "",
  ruc:       "",
  correo:    "",
  telefono:  "",
  direccion: "",
};

export default function Configuracion() {
  const { empresaId, userProfile } = useAuth();

  const [form,      setForm]      = useState(EMPTY_FORM);
  const [logoURL,   setLogoURL]   = useState(null);
  const [firmaURL,  setFirmaURL]  = useState(null);
  const [logoFile,  setLogoFile]  = useState(null);   // archivo pendiente de subir
  const [firmaFile, setFirmaFile] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState("");

  const logoInputRef  = useRef(null);
  const firmaInputRef = useRef(null);

  const isAdmin = userProfile?.rol === "admin";

  // ─── Cargar datos de la empresa ───────────────────────────────────────────
  useEffect(() => {
    if (!empresaId) return;
    getDoc(doc(db, "empresas", empresaId)).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setForm({
          nombre:    d.nombre    || "",
          ruc:       d.ruc       || "",
          correo:    d.correo    || "",
          telefono:  d.telefono  || "",
          direccion: d.direccion || "",
        });
        setLogoURL(d.logoURL   || null);
        setFirmaURL(d.firmaURL || null);
      }
      setLoading(false);
    });
  }, [empresaId]);

  // ─── Selección de logo ────────────────────────────────────────────────────
  function handleLogoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const err = validateImage(file);
    if (err) { setError(err); return; }
    setError("");
    setLogoFile(file);
    setLogoURL(URL.createObjectURL(file));
  }

  // ─── Selección de firma ───────────────────────────────────────────────────
  function handleFirmaChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const err = validateImage(file);
    if (err) { setError(err); return; }
    setError("");
    setFirmaFile(file);
    setFirmaURL(URL.createObjectURL(file));
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  // ─── Guardar ──────────────────────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre de la empresa es requerido."); return; }
    if (form.ruc && form.ruc.length > 0 && form.ruc.length !== 13) {
      setError("El RUC debe tener 13 dígitos.");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      let finalLogoURL  = logoURL;
      let finalFirmaURL = firmaURL;

      if (logoFile) {
        const logoRef = ref(storage, `empresas/${empresaId}/logo`);
        await uploadBytes(logoRef, logoFile);
        finalLogoURL = await getDownloadURL(logoRef);
        setLogoFile(null);
      }

      if (firmaFile) {
        const firmaRef = ref(storage, `empresas/${empresaId}/firma`);
        await uploadBytes(firmaRef, firmaFile);
        finalFirmaURL = await getDownloadURL(firmaRef);
        setFirmaFile(null);
      }

      await setDoc(
        doc(db, "empresas", empresaId),
        {
          ...form,
          ruc:       form.ruc || null,
          logoURL:   finalLogoURL,
          firmaURL:  finalFirmaURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setLogoURL(finalLogoURL);
      setFirmaURL(finalFirmaURL);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      console.error(err);
      setError("Error al guardar. Verifica tu conexión e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px", color: "var(--text-muted)" }}>
        Cargando configuración...
      </div>
    );
  }

  return (
    <div className="config-page animate-fadeUp">

      {/* Header */}
      <div className="config-header">
        <div>
          <h2 className="section-title">Configuración</h2>
          <p className="section-sub">
            Datos de tu empresa, imagen corporativa y plan activo
          </p>
        </div>
        {isAdmin && (
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        )}
      </div>

      {/* Notificaciones */}
      {saved && (
        <div className="config-success">
          ✓ Cambios guardados correctamente
        </div>
      )}
      {error && (
        <div className="config-error">
          ⚠ {error}
        </div>
      )}

      <form onSubmit={handleSave}>

        {/* ── IDENTIDAD ──────────────────────────────────────────── */}
        <div className="config-card">
          <div className="config-card-title">Identidad de la Empresa</div>
          <div className="config-card-sub">
            Información fiscal y de contacto de tu despacho contable
          </div>

          <div className="config-identity-grid">
            {/* Logo */}
            <div className="logo-upload-wrap">
              <div
                className="logo-zone"
                onClick={() => isAdmin && logoInputRef.current.click()}
                title={isAdmin ? "Clic para cambiar logo" : ""}
                style={{ cursor: isAdmin ? "pointer" : "default" }}
              >
                {logoURL
                  ? <img src={logoURL} alt="Logo empresa" />
                  : (
                    <div className="logo-ph">
                      <div className="logo-ph-icon">⚡</div>
                      <div className="logo-ph-text">Subir logo</div>
                    </div>
                  )
                }
                {isAdmin && <div className="logo-overlay">📷 Cambiar</div>}
              </div>

              {isAdmin && (
                <>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleLogoChange}
                  />
                  <div className="logo-hint">PNG o JPG<br />recomendado 400×400 px</div>
                  {logoURL && (
                    <button
                      type="button"
                      className="logo-remove-btn"
                      onClick={() => { setLogoURL(null); setLogoFile(null); }}
                    >
                      Eliminar logo
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Campos */}
            <div>
              <div className="form-group">
                <label className="form-label">Nombre / Razón Social *</label>
                <input
                  className="form-input"
                  value={form.nombre}
                  onChange={e => set("nombre", e.target.value)}
                  placeholder="Ej: ContaServ — Jonatan Velásquez"
                  disabled={!isAdmin}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">RUC</label>
                  <input
                    className="form-input"
                    value={form.ruc}
                    onChange={e => set("ruc", e.target.value.replace(/\D/g, "").slice(0, 13))}
                    placeholder="0000000000001"
                    maxLength={13}
                    inputMode="numeric"
                    disabled={!isAdmin}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input
                    className="form-input"
                    value={form.telefono}
                    onChange={e => set("telefono", e.target.value)}
                    placeholder="0999 000 000"
                    disabled={!isAdmin}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input
                  className="form-input"
                  type="email"
                  value={form.correo}
                  onChange={e => set("correo", e.target.value)}
                  placeholder="contacto@contaserv.ec"
                  disabled={!isAdmin}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Dirección</label>
                <input
                  className="form-input"
                  value={form.direccion}
                  onChange={e => set("direccion", e.target.value)}
                  placeholder="Ej: Av. Amazonas 123, Macas, Morona Santiago"
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── FIRMA DIGITAL ──────────────────────────────────────── */}
        <div className="config-card">
          <div className="config-card-title">Firma Digital</div>
          <div className="config-card-sub">
            Se utiliza en reportes, acuerdos de confidencialidad y documentos generados por el sistema
          </div>

          <div className="firma-grid">
            {/* Info */}
            <div className="firma-info-text">
              <p>Sube una imagen de tu <strong>firma manuscrita</strong> para que aparezca automáticamente en los documentos exportados.</p>
              <br />
              <p>Recomendaciones:</p>
              <ul style={{ paddingLeft: "16px", marginTop: "6px", lineHeight: "1.8" }}>
                <li>PNG con fondo transparente</li>
                <li>Resolución mínima 600×200 px</li>
                <li>Fondo blanco también funciona</li>
                <li>Máximo {MAX_SIZE_MB}MB</li>
              </ul>
            </div>

            {/* Upload zona */}
            <div>
              <div
                className="firma-zone"
                onClick={() => isAdmin && firmaInputRef.current.click()}
                style={{ cursor: isAdmin ? "pointer" : "default" }}
                title={isAdmin ? "Clic para subir firma" : ""}
              >
                {firmaURL
                  ? <img src={firmaURL} alt="Firma digital" />
                  : (
                    <div className="firma-ph">
                      <div className="firma-ph-icon">✍</div>
                      <div className="firma-ph-text">Clic para subir tu firma</div>
                      <div className="firma-ph-hint">PNG, JPG o WebP — máx {MAX_SIZE_MB}MB</div>
                    </div>
                  )
                }
                {isAdmin && <div className="firma-overlay">📷 Cambiar firma</div>}
              </div>

              {isAdmin && (
                <>
                  <input
                    ref={firmaInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleFirmaChange}
                  />
                  {firmaURL && (
                    <div className="firma-actions">
                      <button
                        type="button"
                        className="logo-remove-btn"
                        onClick={() => { setFirmaURL(null); setFirmaFile(null); }}
                      >
                        Eliminar firma
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── PLAN ───────────────────────────────────────────────── */}
        <div className="config-card">
          <div className="config-card-title">Plan y Cuenta</div>
          <div className="config-card-sub">
            Tu suscripción actual a ContaFlow
          </div>

          <div className="plan-grid">
            <div className="plan-badge">
              <div className="plan-badge-icon">⚡</div>
              <div>
                <div className="plan-badge-name">Plan Profesional</div>
                <div className="plan-badge-sub">ContaFlow — Macas, Ecuador</div>
              </div>
            </div>

            <div className="plan-features">
              {[
                "Clientes ilimitados",
                "Calendario inteligente",
                "Gestión documental",
                "Reportes PDF y Excel",
                "Soporte prioritario",
              ].map(f => (
                <div key={f} className="plan-feature">
                  <span className="plan-feature-dot" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── INFO ROL ───────────────────────────────────────────── */}
        {!isAdmin && (
          <div style={{
            padding: "14px 18px",
            background: "rgba(249,199,79,0.07)",
            border: "1px solid rgba(249,199,79,0.2)",
            borderRadius: "var(--radius-sm)",
            fontSize: "13px",
            color: "var(--amber)",
          }}>
            ⚠ Solo los administradores pueden modificar la configuración de la empresa.
          </div>
        )}

        {/* Botón final (por si el usuario hace scroll) */}
        {isAdmin && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
