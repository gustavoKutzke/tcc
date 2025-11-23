// src/components/Layout.js
import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { computeLevel } from "../lib/gamification";

export default function Layout({ children }) {
  const navigate = useNavigate();

  // controla o drawer no mobile
  const [open, setOpen] = useState(false);

  const [userData, setUserData] = useState(null);
  const level = userData ? computeLevel(Number(userData.points || 0)) : null;

  useEffect(() => {
    let unsubUserSnap = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      // encerra listener anterior (se houver)
      if (typeof unsubUserSnap === "function") {
        unsubUserSnap();
        unsubUserSnap = null;
      }

      if (!u) {
        setUserData(null);
        return;
      }

      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setUserData({ uid: u.uid, ...snap.data() });
        // acompanha mudanças (ex.: pontos) em tempo real
        unsubUserSnap = onSnapshot(ref, (s2) => {
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

    return () => {
      unsubAuth?.();
      if (typeof unsubUserSnap === "function") unsubUserSnap();
    };
  }, []);

  async function logout() {
    await signOut(auth);
    navigate("/auth");
  }

  // fecha o drawer ao navegar
  function closeIfMobile() {
    if (open) setOpen(false);
  }

  return (
    <div className={`app baruk-shell ${open ? "is-open" : ""}`}>
      {/* Topbar só no mobile */}
      <header className="baruk-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            className="baruk-menu-btn"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
          >
            ☰
          </button>
          <strong>meu-tcc</strong>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="sidebar baruk-sidebar">
        {/* Marca */}
        <div className="brand" style={{ padding: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <div className="badge" />
          <div className="name">meu-tcc</div>
        </div>

        {/* Perfil + Nível */}
        {userData && (
          <div
            className="card"
            style={{
              margin: "0 12px 12px",
              padding: 12,
              background: "#fff",
              borderColor: "var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 900 }}>
                  {userData.name || userData.email}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {userData.role === "gestor" ? "Gestor" : "Colaborador"}
                </div>
              </div>

              {level && (
                <span
                  style={badgeLevelStyle(level.key)}
                  title={`Nível ${level.label}`}
                >
                  {level.label}
                </span>
              )}
            </div>

            <div className="muted" style={{ marginTop: 8 }}>
              {Number(userData.points || 0)} pts
            </div>
          </div>
        )}

        {/* Navegação */}
        <nav className="nav" onClick={closeIfMobile}>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
            <span>Início</span>
          </NavLink>
          <NavLink to="/goals" className={({ isActive }) => (isActive ? "active" : "")}>
            <span>Metas</span>
          </NavLink>
          <NavLink to="/ranking" className={({ isActive }) => (isActive ? "active" : "")}>
            <span>Ranking</span>
          </NavLink>
          <NavLink to="/feedback" className={({ isActive }) => (isActive ? "active" : "")}>
            <span>Feedback 360º</span>
          </NavLink>
          <NavLink to="/shop" className={({ isActive }) => (isActive ? "active" : "")}>
            <span>Loja</span>
          </NavLink>
          <NavLink to="/perfil" className={({ isActive }) => (isActive ? "active" : "")}>
            <span>Perfil</span>
          </NavLink>
          <NavLink to="/kudos" className={({ isActive }) => (isActive ? "active" : "")}>
            <span>Kudos</span>
          </NavLink>
          <NavLink to="/timeline" className={({ isActive }) => (isActive ? "active" : "")}>
            <span>Timeline</span>
          </NavLink>
          <NavLink to="/feed" className={({ isActive }) => (isActive ? "active" : "")}>
            <span>Mural</span>
          </NavLink>
          <NavLink to="/insights" className={({ isActive }) => (isActive ? "active" : "")}>
            <span>Insights</span>
          </NavLink>
          <NavLink to="/carreira" className={({ isActive }) => (isActive ? "active" : "")}>
            <span>Mapa de Carreira</span>
          </NavLink>
          <NavLink to="/pdi" className={({isActive}) => isActive ? "active" : ""}>
            <span>PDI</span>
          </NavLink>
          <NavLink to="/disc" className={({isActive}) => isActive ? "active" : ""}>
            <span>DISC</span>
          </NavLink>

          <button onClick={logout}><span>Sair</span></button>
        </nav>
      </aside>

      {/* Overlay para fechar o drawer no mobile */}
      <div
        onClick={() => setOpen(false)}
        style={{
          display: open ? "block" : "none",
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.35)",
          zIndex: 40,
        }}
      />

      {/* Main */}
      <main className="main baruk-main">
        <div className="content">{children}</div>
      </main>
    </div>
  );
}

/* ===== Badge de nível (segue sua paleta marrom+dourado) ===== */
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
    padding: "6px 12px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    color: levelKey === "diamante" ? "#183a4a" : "#3e2c22",
    background: bg,
    border: "1px solid #e9e1d8",
    boxShadow: "0 6px 16px rgba(0,0,0,.06)",
    whiteSpace: "nowrap",
  };
}
