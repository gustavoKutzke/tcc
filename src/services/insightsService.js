// src/services/insightsService.js
import { db } from "../lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";

// Importa só o que realmente é usado neste arquivo
import { getMonthRange, enumerateDays, isoDate } from "../utils/dateUtils";

/* ===== Carrega times existentes (para o filtro) ===== */

export async function loadTeams() {
  const snap = await getDocs(query(collection(db, "users"), orderBy("name")));
  const members = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

  const ts = new Set();
  members.forEach((u) => {
    const t = (u.team || "").trim();
    if (t) ts.add(t);
  });

  return Array.from(ts); // a página decide se coloca "all" ou não
}

/* ===== Cálculo principal de insights (metas + kudos) ===== */

export async function loadInsightsForManager({ month, team = "all" }) {
  const { start, end } = getMonthRange(month);
  const startTs = Timestamp.fromDate(start);
  const endTs = Timestamp.fromDate(end);

  // ---- USERS ----
  const snapUsers = await getDocs(query(collection(db, "users")));
  const users = snapUsers.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) }));
  const usersMap = new Map(users.map((u) => [u.uid, u]));

  const includeByTeam = (uid) => {
    if (team === "all") return true;
    const u = usersMap.get(uid);
    return (u?.team || "") === team;
  };

  // ---- GOALS (metas concluídas no mês) ----
  let qGoals = query(
    collection(db, "goals"),
    where("completedAt", ">=", startTs),
    where("completedAt", "<", endTs),
    orderBy("completedAt", "desc")
  );

  let snapGoals;
  try {
    snapGoals = await getDocs(qGoals);
  } catch {
    // fallback sem orderBy (caso índice/regras deem erro)
    qGoals = query(
      collection(db, "goals"),
      where("completedAt", ">=", startTs),
      where("completedAt", "<", endTs)
    );
    snapGoals = await getDocs(qGoals);
  }

  const goalsRowsRaw = snapGoals.docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((g) => g.status === "concluida" && includeByTeam(g.ownerUid));

  const days = enumerateDays(start, end);
  const dayMapPts = new Map(days.map((d) => [d, 0]));

  let metasCount = 0;
  let pontosMes = 0;

  const byUserPoints = new Map();

  goalsRowsRaw.forEach((g) => {
    metasCount += 1;
    const pts = Number(g.points || 0);
    pontosMes += pts;

    // pontos por dia
    if (g.completedAt?.toDate) {
      const key = isoDate(g.completedAt.toDate());
      if (dayMapPts.has(key)) {
        dayMapPts.set(key, dayMapPts.get(key) + pts);
      }
    }

    // ranking por colaborador
    const u = usersMap.get(g.ownerUid);
    const name = u?.name || u?.email || g.ownerName || g.ownerUid || "—";
    const prev =
      byUserPoints.get(g.ownerUid) || {
        uid: g.ownerUid,
        name,
        points: 0,
        tasks: 0,
      };
    prev.points += pts;
    prev.tasks += 1;
    byUserPoints.set(g.ownerUid, prev);
  });

  const dailyPoints = Array.from(dayMapPts.entries()).map(
    ([date, points]) => ({
      date,
      points,
    })
  );

  // ---- KUDOS (por monthKey) ----
  let qKudos = query(
    collection(db, "kudos"),
    where("monthKey", "==", month),
    orderBy("createdAt", "desc")
  );

  let snapKudos;
  try {
    snapKudos = await getDocs(qKudos);
  } catch {
    qKudos = query(collection(db, "kudos"), where("monthKey", "==", month));
    snapKudos = await getDocs(qKudos);
  }

  const kudosRowsRaw = snapKudos.docs.map((d) => ({
    id: d.id,
    ...(d.data() || {}),
  }));

  // filtra por time (quem enviou ou quem recebeu)
  const kudosRows = kudosRowsRaw.filter(
    (k) => includeByTeam(k.toUid) || includeByTeam(k.fromUid)
  );

  let kudosCount = 0;
  let kudosValueSum = 0;

  const byRecognized = new Map(); // quem recebe
  const bySupporters = new Map(); // quem envia
  const dayMapKudos = new Map(days.map((d) => [d, 0]));

  kudosRows.forEach((k) => {
    const val = Number(k.value || 0);
    kudosCount += 1;
    kudosValueSum += val;

    // valor por dia
    if (k.createdAt?.toDate) {
      const key = isoDate(k.createdAt.toDate());
      if (dayMapKudos.has(key)) {
        dayMapKudos.set(key, dayMapKudos.get(key) + val);
      }
    }

    // reconhecidos
    if (includeByTeam(k.toUid)) {
      const u = usersMap.get(k.toUid);
      const name = u?.name || u?.email || k.toName || "—";
      const prev =
        byRecognized.get(k.toUid) || {
          uid: k.toUid,
          name,
          value: 0,
          count: 0,
        };
      prev.value += val;
      prev.count += 1;
      byRecognized.set(k.toUid, prev);
    }

    // apoiadores (quem envia)
    if (includeByTeam(k.fromUid)) {
      const u = usersMap.get(k.fromUid);
      const name = u?.name || u?.email || k.fromName || "—";
      const prev =
        bySupporters.get(k.fromUid) || {
          uid: k.fromUid,
          name,
          value: 0,
          count: 0,
        };
      prev.value += val;
      prev.count += 1;
      bySupporters.set(k.fromUid, prev);
    }
  });

  const dailyKudos = Array.from(dayMapKudos.entries()).map(
    ([date, kudos]) => ({
      date,
      kudos,
    })
  );

  // ---- Rankings (top 10) ----
  const topScorers = Array.from(byUserPoints.values())
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  const topRecognized = Array.from(byRecognized.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const topSupporters = Array.from(bySupporters.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // ---- KPIs gerais ----
  const usersCount = users.filter((u) =>
    team === "all" ? true : (u.team || "") === team
  ).length;

  const kpi = {
    kudosCount,
    kudosValueSum,
    metasCount,
    pontosMes,
    usersCount,
  };

  return {
    kpi,
    topScorers,
    topRecognized,
    topSupporters,
    dailyPoints,
    dailyKudos,
  };
}
