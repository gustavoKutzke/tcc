import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { computeLevel } from "../lib/gamification";

export default function Sidebar() {
  const loc = useLocation();
  const [userData, setUserData] = useState(null);

  // Carrega informações do usuário logado
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return setUserData(null);
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const base = { uid: u.uid, ...snap.data() };
        setUserData(base);

        // Atualiza em tempo real (mudança de pontos, etc.)
        onSnapshot(ref, (s2) => {
          if (s2.exists()) setUserData({ uid: u.uid, ...s2.data() });
        });
      } else {
        setUserData({
          uid: u.uid,
          name: u.displayName || "",
          email: u.email || "",
          role: "colaborador",
          points: 0,
        });
      }
    });
    return () => unsub();
  }, []);

  const level = userData ? computeLevel(Number(userData.points || 0)) : null;

  return (
    <aside style={sidebar}>
      <div style={brand}>
        <span style={{ fontWeight: 900 }}>MeuTCC</span>
      </div>

      {userData && (
        <div style={profileBox}>
          <div>
            <div style={{ fontWeight: 900 }}>{userData.name || userData.email}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              {userData.role === "gestor" ? "Gestor" : "Colaborador"}
            </div>
          </div>

          {level && (
            <div style={badgeLevelStyle(level.key)} title={`Nível ${level.label}`}>
              {level.label}
            </div>
          )}
        </div>
      )}

      <nav style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 20 }}>
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            style={{
              ...linkStyle,
              ...(loc.pathname === l.to ? activeLink : {}),
            }}
          >
            {l.icon && <span style={{ marginRight: 8 }}>{l.icon}</span>}
            {l.label}
          </Link>
        ))}
      </nav>

      <div style={{ marginTop: "auto" }}>
        <button
          className="btn"
          style={{ width: "100%", marginTop: 20 }}
          onClick={() => auth.signOut()}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

/* ======= Links da navegação ======= */
const links = [
  { label: "Dashboard", to: "/", icon: "🏠" },
  { label: "Metas", to: "/goals", icon: "🎯" },
  { label: "Ranking", to: "/ranking", icon: "🏆" },
  { label: "Feedback", to: "/feedback", icon: "💬" },
];

/* ======= Estilos ======= */
const sidebar = {
  width: 240,
  minHeight: "100vh",
  background: "#fff",
  borderRight: "1px solid #eee3d3",
  padding: "20px 16px",
  display: "flex",
  flexDirection: "column",
};

const brand = {
  fontSize: 20,
  color: "#4a352b",
  fontWeight: 900,
  marginBottom: 16,
};

const profileBox = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  border: "1px solid #eee3d3",
  borderRadius: 12,
  padding: 12,
  background: "#fff8f0",
};

const linkStyle = {
  display: "flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 8,
  textDecoration: "none",
  color: "#4a352b",
  fontWeight: 600,
};

const activeLink = {
  background: "rgba(200,168,72,0.15)",
  color: "#3e2c22",
  fontWeight: 900,
};

function badgeLevelStyle(levelKey) {
  const bg = {
    bronze: "linear-gradient(135deg,#caa07a,#f1d1b0)",
    prata: "linear-gradient(135deg,#c8c8c8,#efefef)",
    ouro: "linear-gradient(135deg,#c8a848,#f2df9c)",
    diamante: "linear-gradient(135deg,#9be7ff,#e6fbff)",
  }[levelKey] || "linear-gradient(135deg,#eee,#fff)";

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 13,
    color: levelKey === "diamante" ? "#183a4a" : "#3e2c22",
    background: bg,
    border: "1px solid #e9e1d8",
    boxShadow: "0 4px 10px rgba(0,0,0,.05)",
    alignSelf: "start",
  };
}
