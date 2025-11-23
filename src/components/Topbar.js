// src/components/Topbar.js
import { Link, useLocation } from "react-router-dom";

export default function Topbar({ onLogout }) {
  const { pathname } = useLocation();
  const Item = ({ to, children }) => (
    <Link
      to={to}
      style={{
        padding: "8px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.25)",
        color: "#f7ead2",
        textDecoration: "none",
        fontWeight: 700,
        background: pathname === to ? "rgba(255,255,255,.12)" : "transparent"
      }}
    >
      {children}
    </Link>
  );

  return (
    <div className="topbar">
      <div className="title">meu-tcc • Plataforma Gamificada</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Item to="/dashboard">Início</Item>
        <Item to="/goals">Metas</Item>
        <Item to="/ranking">Ranking</Item>
        <Item to="/feedback">Feedback 360º</Item>
        <Item to="/shop">Loja</Item>
        <button className="logout" onClick={onLogout}>Sair</button>
      </div>
    </div>
  );
}
