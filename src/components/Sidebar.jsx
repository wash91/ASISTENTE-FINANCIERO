import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Sidebar.css";

const NAV = [
  {
    label: "Principal",
    items: [
      { to: "/",           icon: "⬡", text: "Dashboard",   badge: null },
      { to: "/calendario", icon: "◫", text: "Calendario",  badge: { count: 5, type: "red" } },
      { to: "/clientes",   icon: "◈", text: "Clientes",    badge: null },
      { to: "/proyectos",  icon: "◭", text: "Proyectos",   badge: { count: 3, type: "green" } },
    ]
  },
  {
    label: "Finanzas",
    items: [
      { to: "/facturacion",   icon: "◎", text: "Facturación",   badge: null },
      { to: "/gastos",        icon: "◑", text: "Gastos",        badge: null },
      { to: "/declaraciones", icon: "◩", text: "Declaraciones", badge: null },
      { to: "/reportes",      icon: "◰", text: "Reportes",      badge: null },
      { to: "/comprobantes",  icon: "⊙", text: "XML SRI",       badge: null },
    ]
  },
  {
    label: "Sistema",
    items: [
      { to: "/servicios",      icon: "⊞", text: "Servicios",     badge: null },
      { to: "/whatsapp",       icon: "◉", text: "WhatsApp",      badge: null },
      { to: "/usuarios",       icon: "◎", text: "Usuarios",      badge: null, adminOnly: true },
      { to: "/configuracion",  icon: "⚙", text: "Configuración", badge: null },
    ]
  }
];

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const { userProfile, logout } = useAuth();
  const isAdmin = userProfile?.rol === "admin";
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const initials = userProfile?.nombre
    ? userProfile.nombre.substring(0, 2).toUpperCase()
    : "JV";

  return (
    <aside
      className={`sidebar ${expanded ? "sidebar-expanded" : ""}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">📊</div>
        <div className={`logo-text ${expanded ? "visible" : ""}`}>
          Asistente<br/><span>Financiero</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map(section => (
          <div key={section.label} className="nav-section">
            <div className={`nav-section-label ${expanded ? "visible" : ""}`}>
              {section.label}
            </div>
            {section.items.filter(item => !item.adminOnly || isAdmin).map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <div className="nav-icon">{item.icon}</div>
                <span className={`nav-text ${expanded ? "visible" : ""}`}>
                  {item.text}
                </span>
                {item.badge && (
                  <span className={`nav-badge nav-badge-${item.badge.type} ${expanded ? "visible" : ""}`}>
                    {item.badge.count}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer usuario */}
      <div className="sidebar-footer">
        <div className="user-avatar">{initials}</div>
        <div className={`user-info ${expanded ? "visible" : ""}`}>
          <div className="user-name">{userProfile?.nombre || "Usuario"}</div>
          <div className="user-role">
            {userProfile?.rol === "admin" ? "Administrador" : "Usuario"}
          </div>
        </div>
        <button
          className={`logout-btn ${expanded ? "visible" : ""}`}
          onClick={handleLogout}
          title="Cerrar sesión"
        >
          ⏻
        </button>
      </div>
    </aside>
  );
}
