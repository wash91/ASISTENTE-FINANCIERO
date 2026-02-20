export default function Placeholder({ icon, title, description }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: "16px",
      opacity: 0.6,
    }}>
      <div style={{ fontSize: "52px" }}>{icon}</div>
      <div style={{
        fontFamily: "'Outfit', sans-serif",
        fontSize: "22px",
        fontWeight: "700",
        color: "var(--text)"
      }}>
        {title}
      </div>
      <div style={{ fontSize: "14px", color: "var(--text-muted)", textAlign: "center", maxWidth: "300px" }}>
        {description || "Este módulo está en desarrollo. Próximamente disponible."}
      </div>
      <div style={{
        padding: "8px 16px",
        background: "var(--green-soft)",
        border: "1px solid rgba(0,184,148,0.2)",
        borderRadius: "20px",
        fontSize: "12px",
        color: "var(--green)",
        fontWeight: "600"
      }}>
        Fase 2 — En desarrollo
      </div>
    </div>
  );
}
