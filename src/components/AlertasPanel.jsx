import { useMemo } from "react";
import "./AlertasPanel.css";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

function formatPeriodo(periodo) {
  if (!periodo) return "";
  const [year, month] = periodo.split("-");
  return `${MESES[parseInt(month, 10) - 1]} ${year}`;
}

function computeAlertas(clientes, cobros) {
  const alertas = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const periodoActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  // ── 1. Vencimientos SRI próximos (≤ 5 días) ──────────────────────────────
  for (const c of clientes) {
    if (!c.vencimientoSRI || c.estado !== "activo") continue;
    const dia = c.vencimientoSRI;

    // Calcular próxima fecha de vencimiento
    let fechaVence = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
    if (fechaVence < hoy) {
      fechaVence = new Date(hoy.getFullYear(), hoy.getMonth() + 1, dia);
    }
    const dias = Math.ceil((fechaVence - hoy) / 86_400_000);
    if (dias > 5) continue;

    const urgencia = dias <= 2 ? "alta" : "media";
    const color    = dias <= 2 ? "coral" : "amber";
    const cuando   = dias === 0 ? "Vence hoy" : dias === 1 ? "Vence mañana" : `Vence en ${dias} días`;

    alertas.push({
      id:        `sri-${c.id}`,
      tipo:      "sri",
      urgencia,
      color,
      titulo:    `SRI: ${c.nombre}`,
      subtitulo: `${cuando} · Día ${dia} del mes`,
    });
  }

  // ── 2. Cobros pendientes de meses anteriores ──────────────────────────────
  for (const co of cobros) {
    if (co.estado !== "pendiente") continue;
    if (!co.periodo || co.periodo >= periodoActual) continue;
    alertas.push({
      id:        `cobro-vencido-${co.id}`,
      tipo:      "cobro-vencido",
      urgencia:  "alta",
      color:     "coral",
      titulo:    `Cobro vencido — ${co.clienteNombre}`,
      subtitulo: `${formatPeriodo(co.periodo)} · $${(co.montoPendiente || 0).toFixed(2)} pendiente`,
    });
  }

  // ── 3. Cobros parciales de meses anteriores ───────────────────────────────
  for (const co of cobros) {
    if (co.estado !== "parcial") continue;
    if (!co.periodo || co.periodo >= periodoActual) continue;
    alertas.push({
      id:        `cobro-parcial-${co.id}`,
      tipo:      "cobro-parcial",
      urgencia:  "media",
      color:     "amber",
      titulo:    `Cobro parcial — ${co.clienteNombre}`,
      subtitulo: `${formatPeriodo(co.periodo)} · $${(co.montoPendiente || 0).toFixed(2)} por completar`,
    });
  }

  // ── 4. Clientes activos sin cobro emitido este mes ────────────────────────
  const cobrosEsteMes = new Set(
    cobros.filter(co => co.periodo === periodoActual).map(co => co.clienteId)
  );
  for (const c of clientes) {
    if (c.estado !== "activo") continue;
    if (!(c.servicios || []).length) continue;
    if (cobrosEsteMes.has(c.id)) continue;

    const totalEstimado = (c.servicios || []).reduce((s, sv) => s + (sv.precioAsignado || 0), 0);
    alertas.push({
      id:        `sin-cobro-${c.id}`,
      tipo:      "sin-cobro",
      urgencia:  "baja",
      color:     "blue",
      titulo:    `Sin cobro — ${c.nombre}`,
      subtitulo: `${formatPeriodo(periodoActual)} · $${totalEstimado.toFixed(2)} estimado`,
    });
  }

  // Ordenar: alta → media → baja
  const orden = { alta: 0, media: 1, baja: 2 };
  alertas.sort((a, b) => orden[a.urgencia] - orden[b.urgencia]);

  return alertas;
}

const COLOR_DOT = {
  coral: "var(--coral)",
  amber: "var(--amber)",
  blue:  "var(--blue)",
};

const MAX_VISIBLE = 8;

export default function AlertasPanel({ clientes, cobros }) {
  const alertas = useMemo(
    () => computeAlertas(clientes, cobros),
    [clientes, cobros]
  );

  const visibles = alertas.slice(0, MAX_VISIBLE);
  const resto    = alertas.length - MAX_VISIBLE;

  return (
    <div className="card alertas-panel">
      <div className="card-header">
        <div className="card-title">Alertas</div>
        {alertas.length > 0 && (
          <span className={`badge ${alertas.some(a => a.color === "coral") ? "badge-bad" : "badge-warn"}`}>
            {alertas.length}
          </span>
        )}
      </div>

      {alertas.length === 0 ? (
        <div className="alertas-ok">
          <span className="alertas-ok-icon">✓</span>
          Sin alertas pendientes
        </div>
      ) : (
        <>
          {visibles.map(a => (
            <div className="alerta-row" key={a.id}>
              <span
                className="alerta-dot"
                style={{ background: COLOR_DOT[a.color], boxShadow: `0 0 6px ${COLOR_DOT[a.color]}` }}
              />
              <div className="alerta-info">
                <div className="alerta-titulo">{a.titulo}</div>
                <div className="alerta-sub">{a.subtitulo}</div>
              </div>
            </div>
          ))}
          {resto > 0 && (
            <div className="alertas-mas">y {resto} alerta{resto > 1 ? "s" : ""} más...</div>
          )}
        </>
      )}
    </div>
  );
}
