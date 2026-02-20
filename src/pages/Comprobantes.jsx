import { useState, useEffect, useRef, useMemo } from "react";
import {
  collection, onSnapshot, addDoc, query,
  orderBy, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import "./Comprobantes.css";

/* ── Catálogo de tipos ───────────────────────────────────────────────────── */
const COD_DOC = {
  "01": "Factura",
  "03": "Liq. de Compra",
  "04": "Nota de Crédito",
  "05": "Nota de Débito",
  "06": "Guía de Remisión",
  "07": "Retención",
};

const COD_COLORS = {
  "01": { bg: "rgba(0,184,148,0.12)",   color: "#00B894", border: "rgba(0,184,148,0.25)" },
  "03": { bg: "rgba(249,199,79,0.12)",  color: "#F9C74F", border: "rgba(249,199,79,0.25)" },
  "04": { bg: "rgba(74,144,217,0.12)",  color: "#4A90D9", border: "rgba(74,144,217,0.25)" },
  "05": { bg: "rgba(255,107,107,0.12)", color: "#FF6B6B", border: "rgba(255,107,107,0.25)" },
  "06": { bg: "rgba(168,85,247,0.12)",  color: "#a855f7", border: "rgba(168,85,247,0.25)" },
  "07": { bg: "rgba(249,115,22,0.12)",  color: "#f97316", border: "rgba(249,115,22,0.25)" },
};

/* ── Parser XML SRI (DOMParser nativo) ──────────────────────────────────── */
function parseComprobanteXML(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  if (doc.querySelector("parsererror")) throw new Error("XML inválido o corrupto");

  const get = (el, tag) =>
    el?.getElementsByTagName(tag)?.[0]?.textContent?.trim() || "";

  const infoTrib = doc.getElementsByTagName("infoTributaria")[0];
  if (!infoTrib) throw new Error("No es un comprobante SRI (falta infoTributaria)");

  const codDoc         = get(infoTrib, "codDoc");
  const claveAcceso    = get(infoTrib, "claveAcceso");
  const rucEmisor      = get(infoTrib, "ruc");
  const razonSocialEmisor = get(infoTrib, "razonSocial");

  if (!claveAcceso) throw new Error("Clave de acceso no encontrada");

  let rucReceptor = "";
  let razonSocialReceptor = "";
  let fechaRaw = "";
  let importeTotal = 0;
  let totalIVA = 0;

  if (codDoc === "01" || codDoc === "03") {
    const info = doc.getElementsByTagName("infoFactura")[0]
                 || doc.getElementsByTagName("infoLiquidacionCompra")[0];
    rucReceptor          = get(info, "identificacionComprador");
    razonSocialReceptor  = get(info, "razonSocialComprador");
    fechaRaw             = get(info, "fechaEmision");
    importeTotal         = parseFloat(get(info, "importeTotal") || "0");
    for (const imp of Array.from(doc.getElementsByTagName("totalImpuesto"))) {
      if (get(imp, "codigo") === "2") totalIVA += parseFloat(get(imp, "valor") || "0");
    }
  } else if (codDoc === "04") {
    const info = doc.getElementsByTagName("infoNotaCredito")[0];
    rucReceptor         = get(info, "identificacionComprador");
    razonSocialReceptor = get(info, "razonSocialComprador");
    fechaRaw            = get(info, "fechaEmision");
    importeTotal        = parseFloat(get(info, "valorModificacion") || "0");
    for (const imp of Array.from(doc.getElementsByTagName("totalImpuesto"))) {
      if (get(imp, "codigo") === "2") totalIVA += parseFloat(get(imp, "valor") || "0");
    }
  } else if (codDoc === "05") {
    const info = doc.getElementsByTagName("infoNotaDebito")[0];
    rucReceptor         = get(info, "identificacionComprador");
    razonSocialReceptor = get(info, "razonSocialComprador");
    fechaRaw            = get(info, "fechaEmision");
    importeTotal        = parseFloat(get(info, "valorTotal") || "0");
  } else if (codDoc === "07") {
    const info = doc.getElementsByTagName("infoCompRetencion")[0];
    rucReceptor         = get(info, "identificacionSujetoRetenido");
    razonSocialReceptor = get(info, "razonSocialSujetoRetenido");
    fechaRaw            = get(info, "fechaEmision");
    for (const r of Array.from(doc.getElementsByTagName("impuesto"))) {
      importeTotal += parseFloat(get(r, "valorRetenido") || "0");
    }
  } else if (codDoc === "06") {
    const info = doc.getElementsByTagName("infoGuiaRemision")[0];
    fechaRaw = get(info, "fechaIniTransporte");
  }

  // DD/MM/YYYY → YYYY-MM-DD
  const [d, m, y] = (fechaRaw || "").split("/");
  const fecha = y && m && d
    ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
    : "";

  return {
    claveAcceso, codDoc,
    tipo: COD_DOC[codDoc] || "Desconocido",
    rucEmisor, razonSocialEmisor,
    rucReceptor, razonSocialReceptor,
    fecha,
    importeTotal: Math.round(importeTotal * 100) / 100,
    totalIVA: Math.round(totalIVA * 100) / 100,
  };
}

/* ── Helper ─────────────────────────────────────────────────────────────── */
function formatFecha(str) {
  if (!str) return "—";
  const d = new Date(str + "T00:00:00");
  if (isNaN(d)) return str;
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

function TipoChip({ codDoc }) {
  const s = COD_COLORS[codDoc] || COD_COLORS["01"];
  return (
    <span
      className="comp-tipo-chip"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {COD_DOC[codDoc] || codDoc}
    </span>
  );
}

/* ── Modal de subida ────────────────────────────────────────────────────── */
function UploadModal({ results, total, done, uploading, onClose, onReset }) {
  const pct = total ? Math.round(done / total * 100) : 0;
  const nuevos    = results.filter(r => r.status === "ok").length;
  const dups      = results.filter(r => r.status === "dup").length;
  const errores   = results.filter(r => r.status === "error").length;

  return (
    <div className="modal-backdrop" onClick={e => !uploading && e.target === e.currentTarget && onClose()}>
      <div className="comp-upload-modal">
        <div className="modal-header">
          <h2 className="modal-title">Subir Comprobantes XML</h2>
          {!uploading && <button className="modal-close" onClick={onClose}>✕</button>}
        </div>

        <div className="modal-body">
          {uploading && (
            <div className="comp-upload-prog">
              <div className="comp-upload-prog-bar">
                <div className="comp-upload-prog-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="comp-upload-prog-txt">
                Procesando {done}/{total}...
              </span>
            </div>
          )}

          {!uploading && results.length > 0 && (
            <div className="comp-upload-summary">
              {nuevos > 0  && <span className="comp-sum-item ok"  >✓ {nuevos} nuevo{nuevos !== 1 ? "s" : ""}</span>}
              {dups > 0    && <span className="comp-sum-item dup" >◎ {dups} duplicado{dups !== 1 ? "s" : ""}</span>}
              {errores > 0 && <span className="comp-sum-item err" >✕ {errores} error{errores !== 1 ? "es" : ""}</span>}
            </div>
          )}

          <div className="comp-upload-list">
            {results.map((r, i) => (
              <div key={i} className={`comp-upload-item comp-item-${r.status}`}>
                <span className="comp-item-icon">
                  {r.status === "ok" ? "✓" : r.status === "dup" ? "◎" : "✕"}
                </span>
                <div className="comp-item-info">
                  <span className="comp-item-name">{r.filename}</span>
                  <span className="comp-item-msg">{r.msg}</span>
                </div>
              </div>
            ))}
            {uploading && done < total && (
              <div className="comp-upload-item comp-item-pending">
                <span className="comp-item-icon comp-spin">↻</span>
                <span className="comp-item-name">Procesando...</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onReset} disabled={uploading}>
            Subir más
          </button>
          <button className="btn btn-primary" onClick={onClose} disabled={uploading}>
            {uploading ? "Procesando..." : "Cerrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Página principal ───────────────────────────────────────────────────── */
export default function Comprobantes() {
  const { empresaId } = useAuth();
  const fileRef = useRef(null);

  const [comprobantes, setComprobantes] = useState([]);
  const [clientes,     setClientes]     = useState([]);
  const [search,       setSearch]       = useState("");
  const [filtroTipo,   setFiltroTipo]   = useState("todos");
  const [filtroAnio,   setFiltroAnio]   = useState(new Date().getFullYear());

  // Upload state
  const [showUpload,    setShowUpload]    = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [uploadTotal,   setUploadTotal]   = useState(0);
  const [uploadDone,    setUploadDone]    = useState(0);

  useEffect(() => {
    if (!empresaId) return;
    const u1 = onSnapshot(
      query(collection(db, "empresas", empresaId, "comprobantes"), orderBy("fecha", "desc")),
      s => setComprobantes(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const u2 = onSnapshot(
      collection(db, "empresas", empresaId, "clientes"),
      s => setClientes(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { u1(); u2(); };
  }, [empresaId]);

  const clavesSet = useMemo(
    () => new Set(comprobantes.map(c => c.claveAcceso)),
    [comprobantes]
  );

  const aniosDisponibles = useMemo(() => {
    const actual = new Date().getFullYear();
    const fromData = [...new Set(comprobantes.map(c => c.fecha?.slice(0, 4)).filter(Boolean))].map(Number);
    const set = new Set([actual, actual - 1, actual - 2, ...fromData]);
    return [...set].sort((a, b) => b - a);
  }, [comprobantes]);

  /* ── Upload ──────────────────────────────────────────────────────────── */
  async function handleFiles(files) {
    const fileArr = Array.from(files);
    if (!fileArr.length) return;

    setUploadTotal(fileArr.length);
    setUploadDone(0);
    setUploadResults([]);
    setUploading(true);
    setShowUpload(true);

    const results = [];
    const processedInBatch = new Set();

    for (const file of fileArr) {
      let xmlString = "";
      try {
        xmlString = await file.text();
        const parsed = parseComprobanteXML(xmlString);

        if (clavesSet.has(parsed.claveAcceso) || processedInBatch.has(parsed.claveAcceso)) {
          results.push({ filename: file.name, status: "dup", msg: "Ya existe en el sistema" });
          setUploadResults([...results]);
          setUploadDone(prev => prev + 1);
          continue;
        }

        processedInBatch.add(parsed.claveAcceso);

        // Upload to Storage
        const xmlRef = ref(storage, `empresas/${empresaId}/xmls/${parsed.claveAcceso}.xml`);
        await uploadString(xmlRef, xmlString, "raw", { contentType: "application/xml" });
        const xmlUrl = await getDownloadURL(xmlRef);

        // Auto-match cliente
        const cliente = clientes.find(c =>
          c.ruc && (c.ruc === parsed.rucEmisor || c.ruc === parsed.rucReceptor)
        );

        await addDoc(collection(db, "empresas", empresaId, "comprobantes"), {
          ...parsed,
          xmlUrl,
          clienteId:    cliente?.id    || "",
          clienteNombre: cliente?.nombre || "",
          createdAt: serverTimestamp(),
        });

        results.push({ filename: file.name, status: "ok", msg: `${parsed.tipo} — ${parsed.razonSocialEmisor}` });
      } catch (err) {
        results.push({ filename: file.name, status: "error", msg: err.message || "Error al procesar" });
      }

      setUploadResults([...results]);
      setUploadDone(prev => prev + 1);
    }

    setUploading(false);
    // Reset input so same files can be re-selected
    if (fileRef.current) fileRef.current.value = "";
  }

  function resetUpload() {
    setUploadResults([]);
    setUploadTotal(0);
    setUploadDone(0);
    setShowUpload(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  /* ── Filtrado ────────────────────────────────────────────────────────── */
  const filtered = comprobantes.filter(c => {
    if (filtroTipo !== "todos" && c.codDoc !== filtroTipo) return false;
    if (c.fecha?.slice(0, 4) !== String(filtroAnio)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (c.razonSocialEmisor   || "").toLowerCase().includes(q) ||
        (c.razonSocialReceptor || "").toLowerCase().includes(q) ||
        (c.rucEmisor           || "").includes(search) ||
        (c.rucReceptor         || "").includes(search) ||
        (c.claveAcceso         || "").includes(search)
      );
    }
    return true;
  });

  const totalImporte = filtered.reduce((s, c) => s + (c.importeTotal || 0), 0);
  const totalIVA     = filtered.reduce((s, c) => s + (c.totalIVA     || 0), 0);

  return (
    <div className="comp-page">
      {/* Header */}
      <div className="comp-page-header">
        <div>
          <h1 className="comp-page-title">Comprobantes Electrónicos</h1>
          <p className="comp-page-sub">
            {filtered.length} comprobante{filtered.length !== 1 ? "s" : ""}
            {totalImporte > 0 && ` · $${totalImporte.toFixed(2)} total`}
            {totalIVA > 0     && ` · $${totalIVA.toFixed(2)} IVA`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
          + Subir XMLs
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".xml,application/xml,text/xml"
          style={{ display: "none" }}
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* Toolbar */}
      <div className="comp-toolbar">
        <input
          className="form-input comp-search"
          placeholder="🔍 Buscar emisor, receptor, clave..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="form-input comp-filter-select"
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
        >
          <option value="todos">Todos los tipos</option>
          {Object.entries(COD_DOC).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          className="form-input comp-filter-select"
          value={filtroAnio}
          onChange={e => setFiltroAnio(parseInt(e.target.value))}
        >
          {aniosDisponibles.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      {/* Instrucciones si está vacío y aún no hay comprobantes */}
      {comprobantes.length === 0 && (
        <div className="comp-onboarding">
          <div className="comp-onb-icon">⊙</div>
          <h3>Sin comprobantes aún</h3>
          <p>
            Descarga tus XMLs desde el portal <strong>SRI en línea</strong> y
            súbelos aquí haciendo clic en <strong>+ Subir XMLs</strong>.
            El sistema los parsea automáticamente y extrae emisor, tipo, monto e IVA.
          </p>
          <ol className="comp-onb-steps">
            <li>Ingresa a <code>sri.gob.ec</code> → Comprobantes electrónicos</li>
            <li>Descarga los XMLs de facturas o retenciones</li>
            <li>Haz clic en <strong>+ Subir XMLs</strong> y selecciona los archivos</li>
          </ol>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => fileRef.current?.click()}>
            + Subir XMLs
          </button>
        </div>
      )}

      {/* Tabla */}
      {comprobantes.length > 0 && (
        <>
          {filtered.length === 0 ? (
            <div className="comp-empty">
              <span style={{ fontSize: 28 }}>⊙</span>
              <p>Sin resultados con ese filtro.</p>
            </div>
          ) : (
            <div className="comp-table">
              <div className="comp-table-head">
                <span>Tipo</span>
                <span>Emisor</span>
                <span>Receptor</span>
                <span>Fecha</span>
                <span>Total ($)</span>
                <span>IVA ($)</span>
                <span />
              </div>

              {filtered.map(c => (
                <div key={c.id} className="comp-table-row">
                  <TipoChip codDoc={c.codDoc} />

                  <div className="comp-razon-cell">
                    <span className="comp-razon">{c.razonSocialEmisor || "—"}</span>
                    <span className="comp-ruc">{c.rucEmisor}</span>
                  </div>

                  <div className="comp-razon-cell">
                    <span className="comp-razon">{c.razonSocialReceptor || "—"}</span>
                    <span className="comp-ruc">{c.rucReceptor}</span>
                  </div>

                  <span className="comp-fecha">{formatFecha(c.fecha)}</span>

                  <span className="comp-monto">${(c.importeTotal || 0).toFixed(2)}</span>

                  <span className="comp-iva">
                    {(c.totalIVA || 0) > 0 ? `$${c.totalIVA.toFixed(2)}` : "—"}
                  </span>

                  <div className="comp-actions">
                    {c.xmlUrl && (
                      <a
                        className="btn btn-ghost comp-xml-btn"
                        href={c.xmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver XML"
                      >
                        XML
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal de upload */}
      {showUpload && (
        <UploadModal
          results={uploadResults}
          total={uploadTotal}
          done={uploadDone}
          uploading={uploading}
          onClose={() => { if (!uploading) resetUpload(); }}
          onReset={resetUpload}
        />
      )}
    </div>
  );
}
