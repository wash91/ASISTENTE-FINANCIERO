import { useLocation } from "react-router-dom";
import "./Topbar.css";

const PAGE_INFO = {
  "/":               { icon: "⬡", title: "Dashboard",     sub: "Resumen general del despacho" },
  "/calendario":     { icon: "◫", title: "Calendario",    sub: "Vencimientos y procesos del mes" },
  "/clientes":       { icon: "◈", title: "Clientes",      sub: "Gestión de cartera de clientes" },
  "/proyectos":      { icon: "◭", title: "Proyectos",     sub: "Impugnaciones, auditorías y más" },
  "/facturacion":    { icon: "◎", title: "Facturación",   sub: "Cobros, abonos y saldos pendientes" },
  "/gastos":         { icon: "◑", title: "Gastos",        sub: "Control de gastos del negocio" },
  "/reportes":       { icon: "◰", title: "Reportes",      sub: "PDF y Excel exportables" },
  "/servicios":      { icon: "⊞", title: "Servicios",     sub: "Catálogo y precios base" },
  "/whatsapp":       { icon: "◉", title: "WhatsApp",      sub: "Plantillas de mensajes" },
  "/configuracion":  { icon: "⚙", title: "Configuración", sub: "Empresa y usuarios del sistema" },
  "/usuarios":       { icon: "◎", title: "Usuarios",        sub: "Gestión de acceso y roles del equipo" },
  "/declaraciones":  { icon: "◩", title: "Declaraciones SRI", sub: "Checklist de preparación por cliente y formulario" },
};

export default function Topbar({ onNewClient }) {
  const location = useLocation();
  const info = PAGE_INFO[location.pathname] || PAGE_INFO["/"];

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-icon">{info.icon}</div>
        <div>
          <div className="topbar-title">{info.title}</div>
          <div className="topbar-sub">{info.sub}</div>
        </div>
      </div>
      <div className="topbar-right">
        <button className="btn btn-ghost btn-icon" title="Notificaciones">🔔</button>
        <button className="btn btn-ghost btn-icon" title="Buscar">🔍</button>
        <button className="btn btn-primary" onClick={onNewClient}>
          + Nuevo Cliente
        </button>
      </div>
    </header>
  );
}
