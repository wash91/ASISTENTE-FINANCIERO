import "./Dashboard.css";

const STATS = [
  { label: "Ingresos Feb",    value: "$2,840", trend: "↑ +18% vs enero",       color: "var(--green)", glow: "rgba(0,184,148,0.15)",    icon: "💰" },
  { label: "Por Cobrar",      value: "$680",   trend: "4 clientes pendientes",  color: "var(--coral)", glow: "rgba(255,107,107,0.15)",  icon: "⏳" },
  { label: "Clientes Activos",value: "24",     trend: "↑ 2 nuevos este mes",    color: "var(--blue)",  glow: "rgba(74,144,217,0.15)",   icon: "👥" },
  { label: "Procesos Activos",value: "12",     trend: "3 vencen esta semana",   color: "var(--amber)", glow: "rgba(249,199,79,0.15)",   icon: "📋" },
];

const PROCESSES = [
  { status: "red",   name: "Declaración IVA — Formulario 104",  client: "Ferretería Sucre S.A.S.",        date: "Hoy",   badge: "bad" },
  { status: "amber", name: "Retenciones en la Fuente — F.103",  client: "Distribuidora El Oriente",       date: "21 Feb" },
  { status: "amber", name: "Aviso de Entrada MDT",              client: "Constructora Amazonas Cía. Ltda.", date: "22 Feb" },
  { status: "red",   name: "Declaración IVA — Formulario 104",  client: "Comercial Los Andes",            date: "24 Feb" },
  { status: "green", name: "Contrato de Trabajo",               client: "Hotel Macas Real",               date: "Listo", badge: "ok" },
];

const COBROS = [
  { initials: "FS", name: "Ferretería Sucre",    info: "15 días vencido", value: "$120", badge: "bad",  gradient: "linear-gradient(135deg,#F9C74F,#FF6B6B)" },
  { initials: "DO", name: "Distrib. Oriente",    info: "5 días vencido",  value: "$80",  badge: "warn", gradient: "linear-gradient(135deg,#4A90D9,#7c3aed)" },
  { initials: "CA", name: "Constructora Amazonas", info: "Al día",        value: "✓",    badge: "ok",   gradient: "linear-gradient(135deg,var(--green),var(--blue))" },
];

export default function Dashboard() {
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
        {/* Procesos */}
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
                  : p.date
                }
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar derecho */}
        <div className="dashboard-side">
          {/* Cobros */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Cobros Pendientes</div>
            </div>
            {COBROS.map((c, i) => (
              <div className="client-row" key={i}>
                <div className="client-av" style={{ background: c.gradient }}>{c.initials}</div>
                <div>
                  <div className="client-name">{c.name}</div>
                  <div className="client-sub">{c.info}</div>
                </div>
                <span className={`badge badge-${c.badge}`} style={{ marginLeft: "auto" }}>{c.value}</span>
              </div>
            ))}
          </div>

          {/* Proyecto */}
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
