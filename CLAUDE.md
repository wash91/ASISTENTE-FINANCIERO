# ContaFlow — Sistema de Gestión Contable
## Briefing completo para desarrollo

---

## DESCRIPCIÓN DEL PROYECTO

Sistema web de gestión contable profesional para contadores independientes en Ecuador.
Construido con React + Vite + Firebase. Diseño dark con colores #00B894 (verde) y #1A2235 (navy).
Tipografías: Outfit (títulos) + Plus Jakarta Sans (cuerpo).

**Propietario:** Jonatan Velásquez — ContaServ, Macas, Morona Santiago, Ecuador
**Firebase project:** contador-1dd17

---

## STACK TÉCNICO

- React + Vite (JavaScript)
- Firebase: Auth + Firestore + Storage
- react-router-dom (rutas)
- date-fns (fechas)
- Sin librerías de UI externas — CSS puro con variables

---

## CREDENCIALES FIREBASE

```js
const firebaseConfig = {
  apiKey: "AIzaSyCY5imlb30rIyiceXqYgYD0Y-qx8aXuaDg",
  authDomain: "contador-1dd17.firebaseapp.com",
  projectId: "contador-1dd17",
  storageBucket: "contador-1dd17.firebasestorage.app",
  messagingSenderId: "709500167777",
  appId: "1:709500167777:web:506bea328264da156e6c20",
  measurementId: "G-9EG9G6FVNH"
};
```

---

## PALETA DE COLORES (CSS Variables)

```css
--navy:       #1A2235   /* fondo principal */
--navy-light: #243049   /* cards y modales */
--navy-mid:   #1e2a40   /* sidebar */
--green:      #00B894   /* acento principal */
--green-soft: rgba(0,184,148,0.08)
--green-glow: rgba(0,184,148,0.18)
--amber:      #F9C74F   /* advertencia */
--coral:      #FF6B6B   /* error/urgente */
--blue:       #4A90D9   /* info */
--text:       #E8EEF8
--text-muted: #7A8BAA
--text-dim:   #4A5670
--border:     rgba(255,255,255,0.07)
--radius:     18px
```

---

## ESTRUCTURA DE ARCHIVOS

```
src/
├── firebase/
│   └── config.js              ← inicializa Firebase (Auth, Firestore, Storage)
├── context/
│   └── AuthContext.jsx        ← login, logout, resetPassword, userProfile, empresaId
├── styles/
│   └── global.css             ← variables CSS, botones, cards, badges, animaciones
├── components/
│   ├── Layout.jsx             ← wrapper con Sidebar + Topbar + <Outlet />
│   ├── Sidebar.jsx            ← sidebar expandible al hover (72px → 230px)
│   ├── Sidebar.css
│   ├── Topbar.jsx             ← header con ícono+título de página y botón "Nuevo Cliente"
│   ├── Topbar.css
│   ├── PrivateRoute.jsx       ← redirige a /login si no hay sesión
│   └── Placeholder.jsx        ← página temporal para módulos en desarrollo
├── pages/
│   ├── Login.jsx              ← pantalla de login con diseño ContaFlow
│   ├── Login.css
│   ├── Dashboard.jsx          ← stats, procesos próximos, cobros, proyecto activo
│   └── Dashboard.css
├── router.jsx                 ← todas las rutas con PrivateRoute
├── App.jsx                    ← AuthProvider + AppRouter
├── main.jsx
└── index.css
```

---

## ARQUITECTURA FIRESTORE (Multi-Tenant)

```
empresas/{empresaId}/
  ├── (doc raíz)              ← nombre, RUC, logo, firma, plan
  ├── usuarios/{uid}          ← nombre, rol (admin|usuario), clientesAsignados[]
  ├── clientes/{clienteId}    ← datos cliente, dígito SRI, mensualidad, servicios
  │   └── obligaciones/{id}  ← proceso mensual: tipo, periodo, estado, cobro, docs
  ├── servicios/{id}          ← catálogo: nombre, precioBase, categoría
  ├── proyectos/{id}          ← impugnaciones/auditorías con etapas y bitácora
  ├── cobros/{id}             ← pagos registrados con abonos parciales
  ├── gastos/{id}             ← gastos negocio + gastos por cliente
  ├── comprobantes/{id}       ← XMLs descargados del SRI
  └── plantillasWhatsApp/{id} ← mensajes con variables dinámicas
```

---

## MÓDULOS DEL SISTEMA (15 módulos)

| # | Módulo | Estado |
|---|--------|--------|
| M-00 | Configuración empresa (nombre, RUC, logo, firma) | Fase 1 |
| M-01 | Autenticación y roles (admin/usuario) | Fase 1 |
| M-02 | Registro de clientes + detección dígito RUC + acuerdo confidencialidad | Fase 1 |
| M-03 | Catálogo de servicios con precio base mínimo | Fase 1 |
| M-10 | Calendario inteligente como centro de operaciones | Fase 1 |
| M-04 | Asignación de servicios por cliente | Fase 2 |
| M-05 | Facturación y cobros con abonos parciales | Fase 2 |
| M-13 | Gestión de gastos (negocio + por cliente) | Fase 2 |
| M-08 | Alertas y recordatorios automáticos | Fase 2 |
| M-06 | Gestión documental con custodia | Fase 3 |
| M-09 | Plantillas WhatsApp con variables dinámicas | Fase 3 |
| M-11 | Pre-declaración SRI (formularios 104, 103, 101, 102) | Fase 4 |
| M-12 | Proyectos con etapas, bitácora y cobro por etapas | Fase 4 |
| M-07 | Reportes exportables PDF/Excel | Fase 4 |
| M-14 | Integración SRI: descarga masiva XML | Fase 5 |

---

## REGLAS DE NEGOCIO IMPORTANTES

1. **Dígito RUC → día de vencimiento SRI:**
   `{0:28, 1:10, 2:12, 3:14, 4:16, 5:20, 6:20, 7:22, 8:24, 9:26}`
   Se detecta automáticamente al ingresar el RUC del cliente.

2. **Precios mínimos:** Usuarios pueden cobrar MÁS que el precio base del catálogo, NUNCA menos.

3. **Flujo del calendario:** clic en evento → gestionar proceso → adjuntar doc → registrar cobro → enviar WhatsApp → proceso desaparece del calendario activo (queda en historial).

4. **Multi-tenant:** cada empresa tiene su propio `empresaId` aislado en Firestore. Preparado para SaaS.

5. **Credenciales SRI:** almacenadas cifradas, solo accesibles por admin, requieren autorización firmada del cliente.

---

## ESTADO ACTUAL DEL PROYECTO (Fase 1 en desarrollo)

Los siguientes archivos YA EXISTEN y están funcionales:
- `src/firebase/config.js` — configurado con las credenciales reales
- `src/context/AuthContext.jsx` — login/logout/resetPassword funcionando
- `src/styles/global.css` — variables y estilos base completos
- `src/components/` — Layout, Sidebar, Topbar, PrivateRoute, Placeholder
- `src/pages/Login.jsx` + `Login.css` — pantalla de login completa
- `src/pages/Dashboard.jsx` + `Dashboard.css` — dashboard con datos mock
- `src/router.jsx` — rutas completas con PrivateRoute
- `src/App.jsx` + `main.jsx` + `index.css`

**Completados:**
- M-01 Autenticación y roles (admin/usuario) ✓
- M-02 Registro de clientes + detección RUC + acuerdo confidencialidad ✓ (incluye credenciales AES-GCM, documentos, asignación de servicios)

**Siguiente tarea:** M-03 Servicios — catálogo con precio base mínimo.

---

## NOTAS DE ESTILO

- Sidebar se expande al hacer hover (72px → 230px) con animación suave
- Todos los modales tienen animación `modalPop` (scale + translateY)
- Cards tienen glow de color en hover según su tipo
- Barras de progreso con gradiente verde y box-shadow luminoso
- Indicadores de estado: punto rojo/amarillo/verde con box-shadow de color
- Nunca usar librerías de componentes externas (Ant Design, Material UI, etc.)
- Todo el CSS en archivos `.css` separados por componente
