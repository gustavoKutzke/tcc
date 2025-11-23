// src/components/ToastXP.js
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../lib/firebase";

const ToastXPContext = createContext(null);

export function ToastXPProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [myUid, setMyUid] = useState(null);

  // pega uid atual
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setMyUid(u?.uid || null);
    });
    return () => unsub();
  }, []);

  function showXpToast({ points, source }) {
    const id = Math.random().toString(36).slice(2);

    setToasts((old) => [
      ...old,
      { id, points, source },
    ]);

    setTimeout(() => {
      setToasts((old) => old.filter((t) => t.id !== id));
    }, 3000);
  }

  // ✅ escuta eventos disparados pelo xpService
  useEffect(() => {
    function handler(e) {
      const detail = e?.detail || {};
      const { uid, points, source } = detail;

      // só mostra se for do usuário logado (quando souber)
      if (myUid && uid && uid !== myUid) return;

      if (points && points > 0) {
        showXpToast({ points, source });
      }
    }

    // evento global
    window.addEventListener("xp-earned", handler);

    // evento específico por uid (extra seguro)
    const specificEvent = myUid ? `xp-earned:${myUid}` : null;
    if (specificEvent) {
      window.addEventListener(specificEvent, handler);
    }

    // fallback: expõe função global pra xpService chamar se quiser
    window.showToastXP = ({ uid, points, source }) => {
      if (myUid && uid && uid !== myUid) return;
      if (points && points > 0) showXpToast({ points, source });
    };

    return () => {
      window.removeEventListener("xp-earned", handler);
      if (specificEvent) {
        window.removeEventListener(specificEvent, handler);
      }
      // limpa global se quiser
      try { delete window.showToastXP; } catch {}
    };
  }, [myUid]);

  return (
    <ToastXPContext.Provider value={{ showXpToast }}>
      {children}

      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: "#2b211b",
              color: "#fff",
              padding: "12px 18px",
              borderRadius: 12,
              fontSize: 16,
              boxShadow: "0 4px 12px rgba(0,0,0,.2)",
              animation: "fadeIn .3s ease",
            }}
          >
            <strong>+{t.points} XP</strong> — {formatSource(t.source)}
          </div>
        ))}
      </div>
    </ToastXPContext.Provider>
  );
}

function formatSource(s) {
  const map = {
    goal_completed: "Meta concluída",
    goal_reopen: "Meta reaberta",
    kudos_received: "Kudos recebido",
    kudos_sent: "Kudos enviado",
    pdi_completed: "PDI",
    disc_completed: "DISC",
    feedback_sent: "Feedback enviado",
    feedback_received: "Feedback recebido",
    daily_missions: "Missões diárias",
    weekly_missions: "Missões semanais",
  };
  return map[s] || s;
}

export function useXpToast() {
  return useContext(ToastXPContext);
}
