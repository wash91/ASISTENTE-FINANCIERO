import { useState, useEffect } from "react";
import {
  collection, onSnapshot, query, where, orderBy,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import "./Reportes.css";

const MESES_NOMBRES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const FORMULARIOS_LABEL = { "104": "F.104 — IVA", "103": "F.103 — Retenciones", "101": "F.101 — Renta", "102": "F.102 — RISE" };
const ESTADO_COBRO_LABEL = { pendiente: "Pendiente", parcial: "Parcial", pagado: "Pagado" };
const ESTADO_DECL_LABEL  = { borrador: "Borrador", listo: "Listo", presentado: "Presentado" };
const ESTADO_PROY_LABEL  = { activo: "Activo", completado: "Completado", suspendido: "Suspendido" };

function aniosDisponibles() {
  const a = new Date().getFullYear();
  return [a, a - 1, a - 2, a - 3];
}

function formatPeriodo(p) {
  if (!p) return "—";
  const [y, m] = p.split("-");
  const mn = parseInt(m, 10);
  if (!mn) return p;
  return `${MESES_NOMBRES[mn - 1] || ""} ${y}`;
}

function progDecl(checklist) {
  if (!checklist || !checklist.length) return 0;
  const activos = checklist.filter(i => i.estado !== "na");
  const ok      = checklist.filter(i => i.estado === "ok");
  return activos.length ? Math.round(ok.length / activos.length * 100) : 0;
}

function progProy(etapas) {
  if (!etapas || !etapas.length) return { completadas: 0, total: 0, cobrado: 0, pendiente: 0 };
  const completadas   = etapas.filter(e => e.estado === "completado").length;
  const cobrado       = etapas.reduce((s, e) => s + (e.montoPagado || 0), 0);
  const presupuestado = etapas.reduce((s, e) => s + (e.montoPresupuestado || 0), 0);
  return { completadas, total: etapas.length, cobrado, pendiente: presupuestado - cobrado };
}

/* ── PDF ───────────────────────────────────────────────────────────────────── */
function printReporte(titulo, subtitulo, htmlTable) {
  const win = window.open("", "_blank", "width=960,height=680");
  if (!win) { alert("Permite ventanas emergentes para exportar PDF."); return; }
  win.document.write(`<!DOCTYPE html><html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 28px 32px; }
    .rpt-logo { font-size: 22px; font-weight: 900; color: #1A2235; }
    .rpt-logo span { color: #00B894; }
    h1 { font-size: 17px; font-weight: 700; margin: 14px 0 3px; }
    .sub { font-size: 11px; color: #666; border-bottom: 2px solid #1A2235; padding-bottom: 10px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1A2235; color: #fff; padding: 8px 10px; text-align: left; font-size: 10.5px; font-weight: 700; letter-spacing: 0.4px; }
    td { padding: 7px 10px; border-bottom: 1px solid #e8e8e8; font-size: 11px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .total-row td { font-weight: 700; border-top: 2px solid #1A2235; background: #eef2f7 !important; }
    .footer { margin-top: 18px; font-size: 10px; color: #aaa; text-align: right; }
    @media print { button { display: none !important; } }
  </style>
</head>
<body>
  <div class="rpt-logo">Conta<span>Flow</span></div>
  <h1>${titulo}</h1>
  <p class="sub">${subtitulo} &nbsp;·&nbsp; ${new Date().toLocaleDateString("es-EC", { day:"2-digit", month:"long", year:"numeric" })}</p>
  ${htmlTable}
  <div class="footer">ContaFlow — Sistema de Gestión Contable</div>
  <script>setTimeout(() => window.print(), 350);<\/script>
</body></html>`);
  win.document.close();
}

function buildTable(headers, rows, totalRow) {
  const ths  = headers.map(h => `<th>${h}</th>`).join("");
  const tds  = rows.map(r => `<tr>${r.map(v => `<td>${v ?? "—"}</td>`).join("")}</tr>`).join("");
  const trow = totalRow
    ? `<tr class="total-row">${totalRow.map(v => `<td>${v ?? ""}</td>`).join("")}</tr>`
    : "";
  return `<table><thead><tr>${ths}</tr></thead><tbody>${tds}${trow}</tbody></table>`;
}

/* ── CSV ───────────────────────────────────────────────────────────────────── */
function downloadCSV(filename, headers, rows) {
  const bom = "\uFEFF";
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))];
  const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── ReporteCard ───────────────────────────────────────────────────────────── */
function ReporteCard({ icon, titulo, desc, color, filters, onPDF, onCSV }) {
  return (
    <div className="rpt-card" style={{ borderLeftColor: color }}>
      <div className="rpt-card-top">
        <div
          className="rpt-card-icon"
          style={{ background: `linear-gradient(135deg, ${color}22, ${color}44)`, color }}
        >
          {icon}
        </div>
        <div className="rpt-card-body">
          <h3 className="rpt-card-titulo">{titulo}</h3>
          <p className="rpt-card-desc">{desc}</p>
          {filters && <div className="rpt-filter-row">{filters}</div>}
        </div>
      </div>
      <div className="rpt-card-actions">
        <button className="btn btn-ghost rpt-btn" onClick={onPDF}>PDF</button>
        <button className="btn btn-primary rpt-btn" onClick={onCSV}>CSV / Excel</button>
      </div>
    </div>
  );
}

/* ── Página principal ──────────────────────────────────────────────────────── */
export default function Reportes() {
  const { empresaId } = useAuth();

  const [cobros,       setCobros]       = useState([]);
  const [clientes,     setClientes]     = useState([]);
  const [proyectos,    setProyectos]    = useState([]);
  const [declaraciones,setDeclaraciones]= useState([]);

  // Filtros R1 — Ingresos
  const hoy = new Date();
  const [r1Mes,  setR1Mes]  = useState(hoy.getMonth() + 1);
  const [r1Anio, setR1Anio] = useState(hoy.getFullYear());

  // Filtros R2 — Estado de cuenta
  const [r2Cliente, setR2Cliente] = useState("");
  const [r2Mes,     setR2Mes]     = useState(0);  // 0 = todos los meses
  const [r2Anio,    setR2Anio]    = useState(hoy.getFullYear());

  // Filtros R4 — Proyectos
  const [r4Estado, setR4Estado] = useState("todos");

  // Filtros R5 — Declaraciones
  const [r5Form,  setR5Form]  = useState("todos");
  const [r5Anio,  setR5Anio]  = useState(hoy.getFullYear());

  // Suscripciones
  useEffect(() => {
    if (!empresaId) return;
    const u1 = onSnapshot(
      query(collection(db, "empresas", empresaId, "cobros"), orderBy("fechaEmision", "desc")),
      s => setCobros(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const u2 = onSnapshot(
      collection(db, "empresas", empresaId, "clientes"),
      s => setClientes(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>a.nombre?.localeCompare(b.nombre)))
    );
    const u3 = onSnapshot(
      collection(db, "empresas", empresaId, "proyectos"),
      s => setProyectos(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const u4 = onSnapshot(
      collection(db, "empresas", empresaId, "declaraciones"),
      s => setDeclaraciones(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { u1(); u2(); u3(); u4(); };
  }, [empresaId]);

  const clientesActivos = clientes.filter(c => c.estado === "activo");

  /* ── R1: Resumen de Ingresos ─────────────────────────────────────────────── */
  function r1Data() {
    const periodoStr = `${r1Anio}-${String(r1Mes).padStart(2, "0")}`;
    return cobros.filter(c => c.periodo === periodoStr);
  }

  function exportPDF_R1() {
    const data = r1Data();
    const mesLabel = `${MESES_NOMBRES[r1Mes - 1]} ${r1Anio}`;
    const headers = ["Cliente", "RUC", "Concepto", "Total ($)", "Pagado ($)", "Pendiente ($)", "Estado"];
    const rows = data.map(c => [
      c.clienteNombre, c.clienteRuc || "—", c.concepto || "—",
      (c.montoTotal || 0).toFixed(2),
      (c.montoPagado || 0).toFixed(2),
      (c.montoPendiente || 0).toFixed(2),
      ESTADO_COBRO_LABEL[c.estado] || c.estado,
    ]);
    const totT = data.reduce((s,c) => s + (c.montoTotal||0), 0);
    const totP = data.reduce((s,c) => s + (c.montoPagado||0), 0);
    const totPe= data.reduce((s,c) => s + (c.montoPendiente||0), 0);
    const totalRow = ["TOTAL", "", "", totT.toFixed(2), totP.toFixed(2), totPe.toFixed(2), ""];
    printReporte(
      "Resumen de Ingresos",
      `Período: ${mesLabel} · ${data.length} cobro(s)`,
      buildTable(headers, rows, totalRow)
    );
  }

  function exportCSV_R1() {
    const data = r1Data();
    const mesLabel = `${MESES_NOMBRES[r1Mes - 1]}_${r1Anio}`;
    const headers = ["Cliente","RUC","Concepto","Total","Pagado","Pendiente","Estado"];
    const rows = data.map(c => [
      c.clienteNombre, c.clienteRuc||"", c.concepto||"",
      (c.montoTotal||0).toFixed(2),
      (c.montoPagado||0).toFixed(2),
      (c.montoPendiente||0).toFixed(2),
      ESTADO_COBRO_LABEL[c.estado]||c.estado,
    ]);
    downloadCSV(`ingresos_${mesLabel}.csv`, headers, rows);
  }

  /* ── R2: Estado de cuenta por cliente ───────────────────────────────────── */
  function r2Data() {
    return cobros.filter(c => {
      if (r2Cliente && c.clienteId !== r2Cliente) return false;
      if (!c.periodo) return false;
      const [y, m] = c.periodo.split("-");
      if (parseInt(y) !== r2Anio) return false;
      if (r2Mes !== 0 && parseInt(m) !== r2Mes) return false;
      return true;
    });
  }

  function exportPDF_R2() {
    const data = r2Data();
    const cliente = clientes.find(c => c.id === r2Cliente);
    const nombreCliente = cliente?.nombre || "Todos los clientes";
    const anioLabel = r2Mes !== 0 ? `${MESES_NOMBRES[r2Mes-1]} ${r2Anio}` : String(r2Anio);
    const headers = ["Cliente", "Período", "Concepto", "Total ($)", "Pagado ($)", "Pendiente ($)", "Estado"];
    const rows = data.map(c => [
      c.clienteNombre, formatPeriodo(c.periodo), c.concepto||"—",
      (c.montoTotal||0).toFixed(2),
      (c.montoPagado||0).toFixed(2),
      (c.montoPendiente||0).toFixed(2),
      ESTADO_COBRO_LABEL[c.estado]||c.estado,
    ]);
    const totT  = data.reduce((s,c) => s+(c.montoTotal||0),0);
    const totP  = data.reduce((s,c) => s+(c.montoPagado||0),0);
    const totPe = data.reduce((s,c) => s+(c.montoPendiente||0),0);
    printReporte(
      "Estado de Cuenta",
      `${nombreCliente} · ${anioLabel}`,
      buildTable(headers, rows, ["TOTAL","","",totT.toFixed(2),totP.toFixed(2),totPe.toFixed(2),""])
    );
  }

  function exportCSV_R2() {
    const data = r2Data();
    const cliente = clientes.find(c => c.id === r2Cliente);
    const slug = cliente ? cliente.nombre.replace(/\s+/g,"_").toLowerCase() : "clientes";
    const headers = ["Cliente","RUC","Período","Concepto","Total","Pagado","Pendiente","Estado"];
    const rows = data.map(c => [
      c.clienteNombre, c.clienteRuc||"", formatPeriodo(c.periodo), c.concepto||"",
      (c.montoTotal||0).toFixed(2),(c.montoPagado||0).toFixed(2),(c.montoPendiente||0).toFixed(2),
      ESTADO_COBRO_LABEL[c.estado]||c.estado,
    ]);
    downloadCSV(`estado_cuenta_${slug}_${r2Anio}.csv`, headers, rows);
  }

  /* ── R3: Clientes Activos ────────────────────────────────────────────────── */
  function exportPDF_R3() {
    const headers = ["Nombre","RUC","Mensualidad ($)","Venc. SRI","Servicios","Estado"];
    const rows = clientesActivos.map(c => [
      c.nombre, c.ruc||"—",
      (c.mensualidad||0).toFixed(2),
      c.vencimientoSRI ? `Día ${c.vencimientoSRI}` : "—",
      (c.servicios||[]).map(s=>s.nombre).join(", ") || "—",
      c.estado === "activo" ? "Activo" : "Inactivo",
    ]);
    printReporte(
      "Clientes Activos",
      `${clientesActivos.length} cliente(s)`,
      buildTable(headers, rows, null)
    );
  }

  function exportCSV_R3() {
    const headers = ["Nombre","RUC","Mensualidad","Vencimiento SRI","Servicios","Estado"];
    const rows = clientesActivos.map(c => [
      c.nombre, c.ruc||"",
      (c.mensualidad||0).toFixed(2),
      c.vencimientoSRI ? `Día ${c.vencimientoSRI}` : "",
      (c.servicios||[]).map(s=>s.nombre).join(" | ") || "",
      c.estado,
    ]);
    downloadCSV(`clientes_activos_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
  }

  /* ── R4: Proyectos ───────────────────────────────────────────────────────── */
  function r4Data() {
    return proyectos.filter(p => r4Estado === "todos" || p.estado === r4Estado);
  }

  function exportPDF_R4() {
    const data = r4Data();
    const headers = ["Cliente","Título","Tipo","Etapas","Cobrado ($)","Pendiente ($)","Vencimiento","Estado"];
    const rows = data.map(p => {
      const pg = progProy(p.etapas || []);
      return [
        p.clienteNombre, p.titulo, p.tipo||"—",
        `${pg.completadas}/${pg.total}`,
        pg.cobrado.toFixed(2),
        pg.pendiente.toFixed(2),
        p.fechaVencimiento || "—",
        ESTADO_PROY_LABEL[p.estado]||p.estado,
      ];
    });
    const totCobrado   = data.reduce((s,p) => s + progProy(p.etapas||[]).cobrado, 0);
    const totPendiente = data.reduce((s,p) => s + progProy(p.etapas||[]).pendiente, 0);
    printReporte(
      "Proyectos",
      `${data.length} proyecto(s) · Filtro: ${r4Estado}`,
      buildTable(headers, rows, ["TOTAL","","","",totCobrado.toFixed(2),totPendiente.toFixed(2),"",""])
    );
  }

  function exportCSV_R4() {
    const data = r4Data();
    const headers = ["Cliente","Título","Tipo","Etapas completadas","Total etapas","Cobrado","Pendiente","Vencimiento","Estado"];
    const rows = data.map(p => {
      const pg = progProy(p.etapas || []);
      return [
        p.clienteNombre, p.titulo, p.tipo||"",
        pg.completadas, pg.total,
        pg.cobrado.toFixed(2), pg.pendiente.toFixed(2),
        p.fechaVencimiento||"", ESTADO_PROY_LABEL[p.estado]||p.estado,
      ];
    });
    downloadCSV(`proyectos_${r4Estado}_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
  }

  /* ── R5: Declaraciones SRI ──────────────────────────────────────────────── */
  function r5Data() {
    return declaraciones.filter(d => {
      if (r5Form !== "todos" && d.formulario !== r5Form) return false;
      if (!d.periodo) return false;
      const [y] = d.periodo.split("-");
      return parseInt(y) === r5Anio;
    });
  }

  function exportPDF_R5() {
    const data = r5Data();
    const headers = ["Cliente","RUC","Formulario","Período","Estado","Progreso"];
    const rows = data.map(d => [
      d.clienteNombre, d.clienteRuc||"—",
      FORMULARIOS_LABEL[d.formulario]||d.formulario,
      formatPeriodo(d.periodo),
      ESTADO_DECL_LABEL[d.estado]||d.estado,
      `${progDecl(d.checklist)}%`,
    ]);
    printReporte(
      "Declaraciones SRI",
      `Año ${r5Anio}${r5Form !== "todos" ? ` · ${FORMULARIOS_LABEL[r5Form]||r5Form}` : ""} · ${data.length} declaración(es)`,
      buildTable(headers, rows, null)
    );
  }

  function exportCSV_R5() {
    const data = r5Data();
    const headers = ["Cliente","RUC","Formulario","Período","Estado","Progreso (%)"];
    const rows = data.map(d => [
      d.clienteNombre, d.clienteRuc||"",
      FORMULARIOS_LABEL[d.formulario]||d.formulario,
      formatPeriodo(d.periodo),
      ESTADO_DECL_LABEL[d.estado]||d.estado,
      progDecl(d.checklist),
    ]);
    downloadCSV(`declaraciones_${r5Anio}_${r5Form}.csv`, headers, rows);
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */
  const anios = aniosDisponibles();

  return (
    <div className="rpt-page">
      <div className="rpt-page-header">
        <div>
          <h1 className="rpt-page-title">Reportes Exportables</h1>
          <p className="rpt-page-sub">Genera y descarga reportes en PDF o CSV/Excel</p>
        </div>
      </div>

      <div className="rpt-cards">

        {/* R1 — Resumen de Ingresos */}
        <ReporteCard
          icon="◰"
          titulo="Resumen de Ingresos"
          desc="Cobros del período agrupados por cliente con totales."
          color="#00B894"
          filters={
            <>
              <select className="form-input rpt-filter-select" value={r1Mes} onChange={e => setR1Mes(parseInt(e.target.value))}>
                {MESES_NOMBRES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select className="form-input rpt-filter-select" value={r1Anio} onChange={e => setR1Anio(parseInt(e.target.value))}>
                {anios.map(a => <option key={a}>{a}</option>)}
              </select>
              <span className="rpt-filter-count">{r1Data().length} cobro(s)</span>
            </>
          }
          onPDF={exportPDF_R1}
          onCSV={exportCSV_R1}
        />

        {/* R2 — Estado de Cuenta */}
        <ReporteCard
          icon="◎"
          titulo="Estado de Cuenta"
          desc="Historial de cobros filtrado por cliente y período."
          color="#4A90D9"
          filters={
            <>
              <select className="form-input rpt-filter-select" value={r2Cliente} onChange={e => setR2Cliente(e.target.value)}>
                <option value="">— Todos los clientes —</option>
                {clientesActivos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <select className="form-input rpt-filter-select" value={r2Mes} onChange={e => setR2Mes(parseInt(e.target.value))}>
                <option value={0}>Todos los meses</option>
                {MESES_NOMBRES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select className="form-input rpt-filter-select" value={r2Anio} onChange={e => setR2Anio(parseInt(e.target.value))}>
                {anios.map(a => <option key={a}>{a}</option>)}
              </select>
              <span className="rpt-filter-count">{r2Data().length} cobro(s)</span>
            </>
          }
          onPDF={exportPDF_R2}
          onCSV={exportCSV_R2}
        />

        {/* R3 — Clientes Activos */}
        <ReporteCard
          icon="◈"
          titulo="Clientes Activos"
          desc="Listado completo de clientes con RUC, mensualidad y servicios asignados."
          color="#F9C74F"
          filters={
            <span className="rpt-filter-count">{clientesActivos.length} cliente(s) activo(s)</span>
          }
          onPDF={exportPDF_R3}
          onCSV={exportCSV_R3}
        />

        {/* R4 — Proyectos */}
        <ReporteCard
          icon="◭"
          titulo="Proyectos"
          desc="Proyectos con etapas completadas, montos cobrados y pendientes."
          color="#a855f7"
          filters={
            <>
              <select className="form-input rpt-filter-select" value={r4Estado} onChange={e => setR4Estado(e.target.value)}>
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="completado">Completados</option>
                <option value="suspendido">Suspendidos</option>
              </select>
              <span className="rpt-filter-count">{r4Data().length} proyecto(s)</span>
            </>
          }
          onPDF={exportPDF_R4}
          onCSV={exportCSV_R4}
        />

        {/* R5 — Declaraciones SRI */}
        <ReporteCard
          icon="◩"
          titulo="Declaraciones SRI"
          desc="Estado del checklist de preparación por cliente, formulario y año."
          color="#FF6B6B"
          filters={
            <>
              <select className="form-input rpt-filter-select" value={r5Form} onChange={e => setR5Form(e.target.value)}>
                <option value="todos">Todos los formularios</option>
                <option value="104">F.104 — IVA</option>
                <option value="103">F.103 — Retenciones</option>
                <option value="101">F.101 — Renta</option>
                <option value="102">F.102 — RISE</option>
              </select>
              <select className="form-input rpt-filter-select" value={r5Anio} onChange={e => setR5Anio(parseInt(e.target.value))}>
                {anios.map(a => <option key={a}>{a}</option>)}
              </select>
              <span className="rpt-filter-count">{r5Data().length} declaración(es)</span>
            </>
          }
          onPDF={exportPDF_R5}
          onCSV={exportCSV_R5}
        />

      </div>
    </div>
  );
}
