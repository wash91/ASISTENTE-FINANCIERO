import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import AlertasPanel from "../components/AlertasPanel";
import "./Dashboard.css";

// Mock — se reemplazarán en módulos futuros (M-10 Calendario, M-12 Proyectos)
const PROCESSES = [
  { status: "red",   name: "Declaración IVA — Formulario 104",   client: "Ferretería Sucre S.A.S.",         date: "Hoy",   badge: "bad" },
  { status: "amber", name: "Retenciones en la Fuente — F.103",   client: "Distribuidora El Oriente",        date: "21 Feb" },
  { status: "amber", name: "Aviso de Entrada MDT",               client: "Constructora Amazonas Cía. Ltda.", date: "22 Feb" },
  { status: "red",   name: "Declaración IVA — Formulario 104",   client: "Comercial Los Andes",             date: "24 Feb" },
  { status: "green", name: "Contrato de Trabajo",                client: "Hotel Macas Real",                date: "Listo", badge: "ok" },
];

export default function Dashboard() {
  const { empresaId } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [cobros,   setCobros]   = useState([]);

  useEffect(() => {
    if (!empresaId) return;
    const unsub = onSnapshot(
      collection(db, "empresas", empresaId, "clientes"),
      snap => setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    const unsub = onSnapshot(
      collection(db, "empresas", empresaId, "cobros"),
      snap => setCobros(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [empresaId]);

  // Stats en tiempo real
  const clientesActivos = clientes.filter(c => c.estado === "activo").length;
  const porCobrar = cobros
    .filter(c => c.estado !== "pagado")
    .reduce((s, c) => s + (c.montoPendiente || 0), 0);

  // Cobros pendientes reales para la card derecha
  const cobrosPendientes = cobros
    .filter(c => c.estado !== "pagado")
    .sort((a, b) => (a.periodo || "").localeCompare(b.periodo || ""))
    .slice(0, 3);

  const STATS = [
    { label: "Ingresos Feb",     value: "$2,840",                          trend: "↑ +18% vs enero",                                    color: "var(--green)", glow: "rgba(0,184,148,0.15)",   icon: "💰" },
    { label: "Por Cobrar",       value: `$${porCobrar.toFixed(2)}`,        trend: `${cobros.filter(c => c.estado !== "pagado").length} cobros pendientes`, color: "var(--coral)", glow: "rgba(255,107,107,0.15)", icon: "⏳" },
    { label: "Clientes Activos", value: String(clientesActivos),           trend: `${clientes.length} en total`,                        color: "var(--blue)",  glow: "rgba(74,144,217,0.15)",  icon: "👥" },
    { label: "Procesos Activos", value: "12",                              trend: "3 vencen esta semana",                               color: "var(--amber)", glow: "rgba(249,199,79,0.15)",  icon: "📋" },
  ];

  function getInitials(nombre) {
    return (nombre || "?").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).toUpperCase().join("");
  }

  return (
    <div className="dashboard animate-fadeUp">
      {/* Stats */}
      <div className="stats-grid stagger">
        {STATS.map(s => (
          <div className="stat-card" key={s.label} style={{ "--glow": s.glow }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-trend" style={{ color: s.color }}>{s.trend}</div>
            <div className="stat-icon">{s.icon}</div>
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div className="dashboard-grid">
        {/* Procesos — mock hasta M-10 */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Procesos Próximos a Vencer</div>
              <div className="card-sub">Febrero 2026</div>
            </div>
            <a href="/calendario" className="btn btn-ghost" style={{ fontSize: "12px", padding: "7px 13px" }}>
              Ver calendario →
            </a>
          </div>
          {PROCESSES.map((p, i) => (
            <div className="proc-row" key={i}>
              <div className={`proc-dot dot-${p.status}`} />
              <div className="proc-info">
                <div className="proc-name">{p.name}</div>
                <div className="proc-client">{p.client}</div>
              </div>
              <div className="proc-date">
                {p.badge
                  ? <span className={`badge badge-${p.badge}`}>{p.date}</span>
                  : p.date}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar derecho */}
        <div className="dashboard-side">
          {/* Alertas — M-08 */}
          <AlertasPanel clientes={clientes} cobros={cobros} />

          {/* Cobros pendientes — datos reales */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Cobros Pendientes</div>
              {cobrosPendientes.length > 0 && (
                <a href="/facturacion" className="btn btn-ghost" style={{ fontSize: "11px", padding: "5px 10px" }}>
                  Ver todos →
                </a>
              )}
            </div>
            {cobrosPendientes.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", padding: "8px 0" }}>
                Sin cobros pendientes ✓
              </p>
            ) : (
              cobrosPendientes.map(c => {
                const gradient =
                  c.estado === "pendiente"
                    ? "linear-gradient(135deg,#F9C74F,#FF6B6B)"
                    : "linear-gradient(135deg,#4A90D9,#7c3aed)";
                return (
                  <div className="client-row" key={c.id}>
                    <div className="client-av" style={{ background: gradient }}>
                      {getInitials(c.clienteNombre)}
                    </div>
                    <div>
                      <div className="client-name">{c.clienteNombre}</div>
                      <div className="client-sub">{c.periodo}</div>
                    </div>
                    <span
                      className={`badge badge-${c.estado === "pendiente" ? "bad" : "warn"}`}
                      style={{ marginLeft: "auto" }}
                    >
                      ${(c.montoPendiente || 0).toFixed(2)}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Proyecto — mock hasta M-12 */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Proyecto Activo</div>
              <span className="badge badge-warn">35%</span>
            </div>
            <div className="proj-type-tag">IMPUGNACIÓN IESS</div>
            <div className="proj-name">Garzón Cárdenas</div>
            <div className="proj-ruc">RUC 1400253553001</div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: "35%" }} />
            </div>
            <div className="progress-meta">
              <span>2 / 5 etapas</span>
              <span>Vence 15 Mar</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
