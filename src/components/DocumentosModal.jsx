import { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, query, orderBy
} from "firebase/firestore";
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import "./DocumentosModal.css";

export const TIPOS_DOCUMENTO = [
  { key: "ruc",              label: "RUC / Identificación",            icon: "🪪" },
  { key: "confidencialidad", label: "Acuerdo de Confidencialidad",     icon: "🔒" },
  { key: "contrato",         label: "Contrato / Acuerdo",              icon: "📄" },
  { key: "declaracion",      label: "Estado Financiero / Declaración", icon: "📊" },
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatFecha(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

function getTipo(key) {
  return TIPOS_DOCUMENTO.find(t => t.key === key) || { label: key, icon: "📎" };
}

export default function DocumentosModal({ cliente, onClose }) {
  const { empresaId, currentUser } = useAuth();
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulario de subida
  const [nombre, setNombre]   = useState("");
  const [tipo, setTipo]       = useState(TIPOS_DOCUMENTO[0].key);
  const [archivo, setArchivo] = useState(null);
  const [uploadErr, setUploadErr] = useState("");
  const [progress, setProgress]   = useState(null); // 0-100 | null
  const [uploading, setUploading] = useState(false);

  // Eliminar
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const fileRef = useRef(null);

  const colRef = query(
    collection(db, "empresas", empresaId, "clientes", cliente.id, "documentos"),
    orderBy("createdAt", "desc")
  );

  useEffect(() => {
    const unsub = onSnapshot(colRef, snap => {
      setDocumentos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);  // eslint-disable-line

  function handleFileChange(e) {
    const f = e.target.files[0];
    setUploadErr("");
    if (!f) { setArchivo(null); return; }
    if (f.size > MAX_SIZE) {
      setUploadErr("El archivo supera el límite de 10 MB.");
      setArchivo(null);
      e.target.value = "";
      return;
    }
    setArchivo(f);
  }

  async function handleSubir() {
    if (!nombre.trim()) { setUploadErr("Ingresa un nombre descriptivo."); return; }
    if (!archivo)       { setUploadErr("Selecciona un archivo."); return; }

    setUploading(true);
    setUploadErr("");
    setProgress(0);

    try {
      const storagePath = `empresas/${empresaId}/clientes/${cliente.id}/${Date.now()}-${archivo.name}`;
      const storageRef  = ref(storage, storagePath);
      const task        = uploadBytesResumable(storageRef, archivo);

      await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          resolve
        );
      });

      const url = await getDownloadURL(task.snapshot.ref);

      await addDoc(
        collection(db, "empresas", empresaId, "clientes", cliente.id, "documentos"),
        {
          nombre:      nombre.trim(),
          tipo,
          archivo:     archivo.name,
          url,
          storagePath,
          tamaño:      archivo.size,
          subidoPor:   currentUser?.uid || "",
          createdAt:   serverTimestamp(),
        }
      );

      // Reset form
      setNombre("");
      setTipo(TIPOS_DOCUMENTO[0].key);
      setArchivo(null);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      console.error(err);
      setUploadErr("Error al subir el archivo. Intenta de nuevo.");
      setProgress(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Borrar de Storage
      try {
        await deleteObject(ref(storage, deleteTarget.storagePath));
      } catch {
        // Si el archivo ya no existe en Storage, continuar
      }
      // Borrar metadata de Firestore
      await deleteDoc(
        doc(db, "empresas", empresaId, "clientes", cliente.id, "documentos", deleteTarget.id)
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="documentos-modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Documentos</h2>
            <p className="docs-modal-sub">{cliente.nombre}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Lista de documentos */}
          {loading ? (
            <p className="docs-loading">Cargando documentos...</p>
          ) : documentos.length === 0 ? (
            <div className="docs-empty">
              <div className="docs-empty-icon">📁</div>
              <p>Sin documentos</p>
              <span>Sube el primer documento para este cliente.</span>
            </div>
          ) : (
            <div className="docs-list">
              {documentos.map(d => {
                const t = getTipo(d.tipo);
                return (
                  <div className="doc-item" key={d.id}>
                    <div className="doc-icon">{t.icon}</div>
                    <div className="doc-info">
                      <div className="doc-nombre">{d.nombre}</div>
                      <div className="doc-meta">
                        {t.label} · {d.archivo} · {formatBytes(d.tamaño)} · {formatFecha(d.createdAt)}
                      </div>
                    </div>
                    <div className="doc-actions">
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                        title="Descargar"
                      >
                        ⬇
                      </a>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget(d)}
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulario de subida */}
          <div className="modal-section-label">Subir nuevo documento</div>

          <div className="form-group">
            <label className="form-label">Nombre descriptivo</label>
            <input
              className="form-input"
              value={nombre}
              onChange={e => { setNombre(e.target.value); setUploadErr(""); }}
              placeholder="Ej: RUC actualizado 2026"
              disabled={uploading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo de documento</label>
              <select
                className="form-input"
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                disabled={uploading}
              >
                {TIPOS_DOCUMENTO.map(t => (
                  <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Archivo (máx. 10 MB)</label>
              <input
                ref={fileRef}
                type="file"
                className="form-input docs-file-input"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </div>
          </div>

          {archivo && (
            <p className="docs-file-info">
              {archivo.name} — {formatBytes(archivo.size)}
            </p>
          )}

          {/* Barra de progreso */}
          {progress !== null && (
            <div className="docs-progress-wrap">
              <div className="docs-progress-bar">
                <div className="docs-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="docs-progress-label">{progress}%</span>
            </div>
          )}

          {uploadErr && <p className="field-error">{uploadErr}</p>}

          <button
            className="btn btn-primary"
            onClick={handleSubir}
            disabled={uploading || !archivo || !nombre.trim()}
            style={{ marginTop: "8px" }}
          >
            {uploading ? `Subiendo... ${progress ?? 0}%` : "⬆ Subir documento"}
          </button>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>

      {/* Confirm eliminar */}
      {deleteTarget && (
        <div className="modal-backdrop" style={{ zIndex: 200 }} onClick={() => setDeleteTarget(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">¿Eliminar documento?</div>
            <div className="confirm-sub">
              Se eliminará <strong>{deleteTarget.nombre}</strong> permanentemente.
              Esta acción no se puede deshacer.
            </div>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
