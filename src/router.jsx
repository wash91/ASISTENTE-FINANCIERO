import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";

import Layout       from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";
import Placeholder  from "./components/Placeholder";

import Login         from "./pages/Login";
import Dashboard     from "./pages/Dashboard";
import Clientes      from "./pages/Clientes";
import Servicios     from "./pages/Servicios";
import Calendario    from "./pages/Calendario";
import Configuracion from "./pages/Configuracion";
import Usuarios      from "./pages/Usuarios";
import Facturacion   from "./pages/Facturacion";
import Gastos        from "./pages/Gastos";

// Páginas placeholder para Fase 2+
const pages = {
  Proyectos:   { icon: "◭", title: "Gestión de Proyectos",    desc: "Impugnaciones, auditorías y proyectos con etapas y bitácora." },
  Facturacion: { icon: "◎", title: "Facturación y Cobros",    desc: "Mensualidades, abonos, saldos y historial de pagos." },
  Gastos:      { icon: "◑", title: "Control de Gastos",       desc: "Gastos del negocio y gastos por cliente con rentabilidad real." },
  Reportes:    { icon: "◰", title: "Reportes Exportables",    desc: "PDF y Excel: estados de cuenta, ingresos, vencimientos, custodia." },
  Whatsapp:    { icon: "◉", title: "Plantillas WhatsApp",     desc: "Mensajes personalizados con variables dinámicas por proceso." },
};

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: (
      <PrivateRoute>
        <Layout />
      </PrivateRoute>
    ),
    children: [
      { index: true,            element: <Dashboard /> },
      { path: "calendario",     element: <Calendario /> },
      { path: "clientes",       element: <Clientes /> },
      { path: "proyectos",      element: <Placeholder {...pages.Proyectos} /> },
      { path: "facturacion",    element: <Facturacion /> },
      { path: "gastos",         element: <Gastos /> },
      { path: "reportes",       element: <Placeholder {...pages.Reportes} /> },
      { path: "servicios",      element: <Servicios /> },
      { path: "whatsapp",       element: <Placeholder {...pages.Whatsapp} /> },
      { path: "configuracion",  element: <Configuracion /> },
      { path: "usuarios",       element: <Usuarios /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
