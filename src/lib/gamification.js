// src/lib/gamification.js

/**
 * =========================================================
 *  SISTEMA DE GAMIFICAÇÃO – VERSÃO TCC (COMPLETA)
 * =========================================================
 *
 *  - Economia de pontos (XP_SOURCES)
 *  - Trilhas de nível (careerLevels)
 *  - Desafios sazonais (seasonalChallenges)
 *  - Marcos / badges dinâmicos (milestones)
 *  - Streaks (computeGoalStreak)
 *  - PDI como questline (computePdiStats)
 *  - Nível de mentor (computeMentorLevel)
 *  - Missões do dia com DISC (suggestDailyMissions)
 *  - Pontos efetivos com multiplicadores (computeEffectivePoints)
 *  - Estilo visual (levelBadgeStyle)
 *  - Texto de estilo DISC (describeDiscStyle)
 * =========================================================
 */

/** =========================================================
 *  1. Economia de Pontos – Tabela oficial de XP do TCC
 * ========================================================= */
export const XP_SOURCES = {
  goalNormal: 10, // meta comum concluída
  goalPdi: 15, // meta ligada ao PDI (via metas)
  kudosReceived: 2, // cada kudos recebido
  kudosSent: 1, // cada kudos enviado
  feedbackReceived: 3, // receber feedback formal
  feedbackSent: 4, // enviar feedback estruturado
  dailyMissionsAllDone: 10, // já usado no Career (+10)
  weeklyMissionsAllDone: 20,

  // 🔹 PDI como campanha de desenvolvimento
  pdiItem: 10, // cada ação (item) do PDI concluída
  pdiCompleted: 50, // concluir um PDI inteiro
};

/**
 * Helpers genéricos de XP – para usar nos services
 * (goalsService, kudosService, feedbackService, pdiService, etc.)
 */
export function xpFromGoal({
  isPdi = false,
  basePoints = null,
  isSeasonGoal = false,
  isStreakDay = false,
  seasonMultiplier = 0.2,
  streakBonus = 0.1,
} = {}) {
  const base =
    basePoints != null
      ? basePoints
      : isPdi
      ? XP_SOURCES.goalPdi
      : XP_SOURCES.goalNormal;

  return computeEffectivePoints(base, {
    isSeasonGoal,
    seasonMultiplier,
    isStreakDay,
    streakBonus,
  });
}

export function xpFromKudosReceived({ count = 1 } = {}) {
  return { finalPoints: XP_SOURCES.kudosReceived * count, appliedMultiplier: 1 };
}

export function xpFromKudosSent({ count = 1 } = {}) {
  return { finalPoints: XP_SOURCES.kudosSent * count, appliedMultiplier: 1 };
}

export function xpFromFeedbackReceived({ count = 1 } = {}) {
  return {
    finalPoints: XP_SOURCES.feedbackReceived * count,
    appliedMultiplier: 1,
  };
}

export function xpFromFeedbackSent({ count = 1 } = {}) {
  return { finalPoints: XP_SOURCES.feedbackSent * count, appliedMultiplier: 1 };
}

export function xpFromDailyMissionsAllDone() {
  return {
    finalPoints: XP_SOURCES.dailyMissionsAllDone,
    appliedMultiplier: 1,
  };
}

export function xpFromWeeklyMissionsAllDone() {
  return {
    finalPoints: XP_SOURCES.weeklyMissionsAllDone,
    appliedMultiplier: 1,
  };
}

export function xpFromPdiCompleted({ plansCompleted = 1 } = {}) {
  return {
    finalPoints: XP_SOURCES.pdiCompleted * plansCompleted,
    appliedMultiplier: 1,
  };
}

/**
 * XP direto por ações do PDI (cada item concluído)
 */
export function xpFromPdiItem({ itemsCompleted = 1 } = {}) {
  return {
    finalPoints: XP_SOURCES.pdiItem * itemsCompleted,
    appliedMultiplier: 1,
  };
}

/** =========================================================
 *  2. Trilhas e níveis
 * ========================================================= */
export const careerLevels = [
  {
    key: "iniciante",
    label: "Iniciante",
    min: 0,
    perks: [
      "Acesso básico à plataforma",
      "Participa de rankings semanais e mensais",
    ],
  },
  {
    key: "destaque",
    label: "Colaborador Destaque",
    min: 100,
    perks: [
      "Elegível a feedbacks públicos",
      "Pode receber kudos com conversão total",
      "Aparece em destaques do mês quando estiver no top da equipe",
    ],
  },
  {
    key: "lider",
    label: "Líder Inspirador",
    min: 300,
    perks: [
      "Convites para iniciativas especiais",
      "Destaque fixo no mural do mês",
      "Pode influenciar metas-tema da temporada",
    ],
  },
  {
    key: "mestre",
    label: "Mestre da Cultura",
    min: 600,
    perks: [
      "Acesso a recompensas premium",
      "Reconhecimento institucional",
      "Participação em decisões sobre novas regras de gamificação",
    ],
  },
];

/** =========================================================
 *  3. Desafios sazonais (Seasonal Challenges)
 * ========================================================= */
export const seasonalChallenges = [
  {
    key: "season_collab_q1",
    label: "Temporada: Colaboração em Foco",
    season: "Q1",
    description:
      "Receba kudos e conclua metas colaborativas durante o trimestre para ganhar bônus de pontos.",
    target: { type: "kudos_in", value: 30 },
    bonusMultiplier: 0.2, // +20% pontos em metas elegíveis
  },
  {
    key: "season_execucao_q2",
    label: "Temporada: Execução e Entrega",
    season: "Q2",
    description:
      "Foco em concluir metas com alta pontuação e consistência semanal.",
    target: { type: "goals_done", value: 15 },
    bonusMultiplier: 0.15, // +15% pontos
  },
];

/** =========================================================
 *  4. Badges / marcos dinâmicos
 * ========================================================= */
export const milestones = [
  // ---- Metas concluídas ----
  {
    key: "first_goal",
    label: "Primeira Meta Concluída",
    check: ({ goalsDone }) => goalsDone >= 1,
  },
  {
    key: "goals_5",
    label: "5 Metas Concluídas",
    check: ({ goalsDone }) => goalsDone >= 5,
  },
  {
    key: "goals_20",
    label: "20 Metas Concluídas",
    check: ({ goalsDone }) => goalsDone >= 20,
  },
  {
    key: "goals_50",
    label: "50 Metas Concluídas",
    check: ({ goalsDone }) => goalsDone >= 50,
  },

  // ---- Pontos acumulados ----
  {
    key: "points_100",
    label: "100 Pontos Acumulados",
    check: ({ points }) => points >= 100,
  },
  {
    key: "points_300",
    label: "300 Pontos Acumulados",
    check: ({ points }) => points >= 300,
  },
  {
    key: "points_600",
    label: "600 Pontos Acumulados",
    check: ({ points }) => points >= 600,
  },
  {
    key: "points_1000",
    label: "1.000 Pontos – Guardião da Cultura",
    check: ({ points }) => points >= 1000,
  },

  // ---- Kudos recebidos (capital social) ----
  {
    key: "kudos_recv_10",
    label: "10 Kudos Recebidos",
    check: ({ kudosRecv }) => kudosRecv >= 10,
  },
  {
    key: "kudos_recv_30",
    label: "30 Kudos Recebidos",
    check: ({ kudosRecv }) => kudosRecv >= 30,
  },

  // ---- Kudos enviados (influência) ----
  {
    key: "kudos_sent_10",
    label: "Mentor em Formação (10 kudos enviados)",
    check: ({ kudosSent }) => kudosSent >= 10,
  },
  {
    key: "kudos_sent_30",
    label: "Conector da Equipe (30 kudos enviados)",
    check: ({ kudosSent }) => kudosSent >= 30,
  },

  // ---- Feedbacks (linha de mentor) ----
  {
    key: "feedback_sent_5",
    label: "Mentor Bronze (5 feedbacks enviados)",
    check: ({ feedbackSent }) => feedbackSent >= 5,
  },
  {
    key: "feedback_sent_15",
    label: "Mentor Prata (15 feedbacks enviados)",
    check: ({ feedbackSent }) => feedbackSent >= 15,
  },
  {
    key: "feedback_recv_5",
    label: "Aberto a Feedbacks (5 feedbacks recebidos)",
    check: ({ feedbackRecv }) => feedbackRecv >= 5,
  },

  // ---- PDI (Plano de Desenvolvimento Individual) ----
  {
    key: "pdi_completed_1",
    label: "Primeiro PDI Concluído",
    check: ({ pdiCompleted }) => pdiCompleted >= 1,
  },
  {
    key: "pdi_items_10",
    label: "10 Ações de PDI Concluídas",
    check: ({ pdiItemsCompleted }) => pdiItemsCompleted >= 10,
  },

  // ---- Streaks – consistência (dias seguidos) ----
  {
    key: "streak_5",
    label: "5 Dias Seguidos de Progresso",
    check: ({ goalStreakDays }) => goalStreakDays >= 5,
  },
  {
    key: "streak_10",
    label: "10 Dias Seguidos de Progresso",
    check: ({ goalStreakDays }) => goalStreakDays >= 10,
  },

  // ---- Temporada (desafio sazonal) ----
  {
    key: "season_hero",
    label: "Herói da Temporada",
    check: ({ seasonProgress }) => seasonProgress >= 0.8,
  },
];

/** =========================================================
 *  5. Nível atual (por pontos)
 * ========================================================= */
export function computeLevel(points = 0) {
  const p = Number(points || 0);
  let current = careerLevels[0];
  for (const lv of careerLevels) {
    if (p >= lv.min) current = lv;
  }
  return current; // {key,label,min,perks}
}

/** =========================================================
 *  6. Próximo nível e progresso percentual
 * ========================================================= */
export function nextLevelProgress(points = 0) {
  const p = Number(points || 0);
  let current = careerLevels[0];
  let next = null;

  for (let i = 0; i < careerLevels.length; i++) {
    if (p >= careerLevels[i].min) {
      current = careerLevels[i];
      next = careerLevels[i + 1] || null;
    }
  }

  if (!next) {
    return { current, next: null, progress: 100, remain: 0 };
  }
  const range = next.min - current.min;
  const progress = Math.min(100, Math.round(((p - current.min) / range) * 100));
  const remain = Math.max(0, next.min - p);
  return { current, next, progress, remain };
}

/** =========================================================
 *  7. Estatísticas de PDI (questline épica)
 * =========================================================
 * Espera um array de planos de PDI, onde cada plano pode ter
 * um array de items [{ status: "concluida" | ... }, ...]
 * ========================================================= */
export function computePdiStats(plans = []) {
  let pdiCompleted = 0;
  let pdiItemsCompleted = 0;

  if (!Array.isArray(plans)) return { pdiCompleted, pdiItemsCompleted };

  plans.forEach((plan) => {
    const items = Array.isArray(plan.items) ? plan.items : [];
    const totalItems = items.length;
    const doneItems = items.filter((it) => it.status === "concluida").length;

    pdiItemsCompleted += doneItems;
    if (totalItems > 0 && doneItems === totalItems) {
      pdiCompleted += 1;
    }
  });

  return { pdiCompleted, pdiItemsCompleted };
}

/** =========================================================
 *  8. Cálculo de badges dinâmicos (marcos)
 * ========================================================= */
export function computeBadges(context = {}) {
  const {
    totalPoints = 0,
    // goals removido para evitar no-unused-vars
    kudosReceivedThisMonth = 0,
    goalStreakDays = 0,

    // 👇 novos campos vindos do Career.js
    pdiItemsCompleted = 0,
    pdiPlansCompleted = 0,
  } = context;

  const badges = [];

  // ====== EXEMPLOS EXISTENTES (não remova os seus) ======
  if (totalPoints >= 100) {
    badges.push({
      key: "points_100",
      label: "100 pontos de evolução",
    });
  }
  if (totalPoints >= 500) {
    badges.push({
      key: "points_500",
      label: "500 pontos – Trilha consistente",
    });
  }

  if (goalStreakDays >= 7) {
    badges.push({
      key: "streak_7",
      label: "7 dias seguidos com metas concluídas",
    });
  }

  if (kudosReceivedThisMonth >= 50) {
    badges.push({
      key: "kudos_50",
      label: "Reconhecido pela equipe (50 kudos no mês)",
    });
  }

  // ====== NOVOS BADGES DO PDI ======

  if (pdiItemsCompleted >= 10) {
    badges.push({
      key: "pdi_items_10",
      label: "Produtor de Evolução – 10 ações de PDI concluídas",
    });
  }

  if (pdiItemsCompleted >= 20) {
    badges.push({
      key: "pdi_items_20",
      label: "Executor de Transformações – 20 ações de PDI concluídas",
    });
  }

  if (pdiPlansCompleted >= 1) {
    badges.push({
      key: "pdi_completed_1",
      label: "PDI Concluído – 1 plano de desenvolvimento completo",
    });
  }

  if (pdiPlansCompleted >= 3) {
    badges.push({
      key: "pdi_master",
      label: "Mestre do Desenvolvimento – 3 PDIs completos",
    });
  }

  return badges;
}

/** =========================================================
 *  9. Função de pontuação com multiplicador
 * ========================================================= */
export function computeEffectivePoints(basePoints, options = {}) {
  const {
    isSeasonGoal = false,
    seasonMultiplier = 0.2,
    isStreakDay = false,
    streakBonus = 0.1,
  } = options;

  let final = Number(basePoints || 0);
  let appliedMultiplier = 1;

  if (isSeasonGoal) {
    appliedMultiplier += seasonMultiplier;
  }
  if (isStreakDay) {
    appliedMultiplier += streakBonus;
  }

  final = Math.round(final * appliedMultiplier);

  return {
    finalPoints: final,
    appliedMultiplier,
  };
}

/** =========================================================
 *  10. Cálculo de streaks de metas concluídas
 * ========================================================= */
export function computeGoalStreak(goals = [], today = new Date()) {
  const doneDates = goals
    .filter((g) => g.status === "concluida" && g.completedAt?.toDate)
    .map((g) => g.completedAt.toDate())
    .sort((a, b) => a - b);

  if (doneDates.length === 0) {
    return {
      current: 0,
      bestLast30: 0,
      completedThisWeek: 0,
      currentStreak: 0,
      bestStreak: 0,
    };
  }

  const uniqueDays = Array.from(
    new Set(doneDates.map((d) => d.toDateString()))
  ).map((s) => new Date(s));

  let bestGlobal = 1;
  let currentRun = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = uniqueDays[i - 1];
    const curr = uniqueDays[i];
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentRun += 1;
      if (currentRun > bestGlobal) bestGlobal = currentRun;
    } else {
      currentRun = 1;
    }
  }

  const last = uniqueDays[uniqueDays.length - 1];
  const todayMid = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const lastMid = new Date(
    last.getFullYear(),
    last.getMonth(),
    last.getDate()
  );
  const diffFromToday = Math.round(
    (todayMid - lastMid) / (1000 * 60 * 60 * 24)
  );
  const current = diffFromToday === 0 ? currentRun : 0;

  const thirtyDaysAgo = new Date(todayMid);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  const last30 = uniqueDays.filter((d) => d >= thirtyDaysAgo && d <= todayMid);
  let bestLast30 = 0;
  let run30 = last30.length > 0 ? 1 : 0;

  for (let i = 1; i < last30.length; i++) {
    const prev = last30[i - 1];
    const curr = last30[i];
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      run30 += 1;
      if (run30 > bestLast30) bestLast30 = run30;
    } else {
      run30 = 1;
      if (run30 > bestLast30) bestLast30 = run30;
    }
  }
  if (last30.length === 1) bestLast30 = 1;

  const weekStart = new Date(todayMid);
  const day = weekStart.getDay(); // 0=domingo
  const diffToMonday = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - diffToMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const completedThisWeek = doneDates.filter(
    (d) => d >= weekStart && d < weekEnd
  ).length;

  return {
    current,
    bestLast30,
    completedThisWeek,
    currentStreak: current,
    bestStreak: bestGlobal,
  };
}

/** =========================================================
 *  11. Sugestão de Missões do Dia (com DISC + PDI)
 * ========================================================= */
export function suggestDailyMissions({
  points = 0,
  goals = [],
  streak = 0,
  kudosSentToday = 0,
  disc = null, // "D" | "I" | "S" | "C" | null

  // 🔹 Integração com PDI nas missões
  hasPdiPlan = false,
  pdiProgress = 0,
} = {}) {
  const today = new Date();
  const todayKey = today.toDateString();

  const doneToday = Array.isArray(goals)
    ? goals.filter(
        (g) =>
          g.status === "concluida" &&
          g.completedAt?.toDate &&
          g.completedAt.toDate().toDateString() === todayKey
      ).length
    : 0;

  const streakDays =
    typeof streak === "number"
      ? streak
      : (streak?.current || streak?.currentStreak || 0);

  const missions = [];

  // Missão extra – fazer o DISC (quando ainda não configurado)
  if (!disc) {
    missions.push({
      key: "do_disc_assessment",
      label:
        "Realizar o teste DISC para desbloquear sua trilha comportamental (+100 pts na 1ª vez)",
      done: false,
    });
  }

  // Missão 1 – manter movimento diário
  missions.push({
    key: "finish_one_goal",
    label: "Concluir pelo menos 1 meta hoje",
    done: doneToday >= 1,
  });

  // Missão 2 – reforçar consistência (streak)
  missions.push({
    key: "keep_streak",
    label: "Manter sua sequência de dias produtivos",
    done: streakDays >= 1 && doneToday >= 1,
  });

  // Missão 3 – contexto por pontos
  if (points < 100) {
    missions.push({
      key: "plan_new_goal",
      label: "Cadastrar uma nova meta alinhada ao seu PDI",
      done: goals.some(
        (g) => g.status === "aberta" || g.status === "em_andamento"
      ),
    });
  } else {
    missions.push({
      key: "help_colleague",
      label: "Enviar pelo menos 1 kudos ou feedback construtivo hoje",
      done: kudosSentToday >= 1,
    });
  }

  // 🔹 Missões específicas ligadas ao PDI
  if (hasPdiPlan) {
    missions.push({
      key: "pdi_step_today",
      label: "Dar pelo menos 1 passo concreto no seu PDI hoje",
      // Heurística simples: se você concluiu alguma meta hoje,
      // consideramos que pode ser ligada ao PDI.
      done: doneToday >= 1,
    });

    if (pdiProgress < 100) {
      missions.push({
        key: "pdi_keep_moving",
        label: "Revisar seu PDI e atualizar o andamento de 1 ação",
        done: doneToday >= 1,
      });
    }
  }

  // Missões específicas por DISC
  if (disc === "D") {
    missions.push({
      key: "disc_high_value_goal",
      label: "Concluir uma meta de alto impacto hoje (≥ 20 pts)",
      done: goals.some(
        (g) =>
          g.status === "concluida" &&
          Number(g.points || 0) >= 20 &&
          g.completedAt?.toDate &&
          g.completedAt.toDate().toDateString() === todayKey
      ),
    });
  } else if (disc === "I") {
    missions.push({
      key: "disc_connect_team",
      label: "Reconhecer 2 pessoas diferentes com kudos hoje",
      done: kudosSentToday >= 2,
    });
  } else if (disc === "S") {
    missions.push({
      key: "disc_steady_rhythm",
      label: "Manter 3 dias seguidos com pelo menos 1 meta concluída",
      done: streakDays >= 3,
    });
  } else if (disc === "C") {
    missions.push({
      key: "disc_quality_focus",
      label: "Revisar e detalhar a descrição de 1 meta importante hoje",
      done: goals.some(
        (g) =>
          g.status === "concluida" &&
          Number(g.points || 0) >= 15 &&
          g.completedAt?.toDate &&
          g.completedAt.toDate().toDateString() === todayKey
      ),
    });
  }

  return missions;
}

/** =========================================================
 *  12. Estilo visual da badge de nível
 * ========================================================= */
export function levelBadgeStyle(levelKey) {
  const bg =
    {
      iniciante: "linear-gradient(135deg,#caa07a,#f1d1b0)",
      destaque: "linear-gradient(135deg,#c8c8c8,#efefef)",
      lider: "linear-gradient(135deg,#c8a848,#f2df9c)",
      mestre: "linear-gradient(135deg,#9be7ff,#e6fbff)",
    }[levelKey] || "linear-gradient(135deg,#eee,#fff)";

  return {
    display: "inline-block",
    padding: "8px 18px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 16,
    color: levelKey === "mestre" ? "#183a4a" : "#3e2c22",
    background: bg,
    border: "1px solid #e9e1d8",
    boxShadow: "0 6px 12px rgba(0,0,0,.08)",
    whiteSpace: "nowrap",
  };
}

/** =========================================================
 *  13. Nível de Mentor (influência social)
 * ========================================================= */
export function computeMentorLevel({
  kudosSentTotal = 0,
  feedbackSentTotal = 0,
} = {}) {
  const score =
    Number(kudosSentTotal || 0) + Number(feedbackSentTotal || 0) * 2;

  if (score >= 50) {
    return {
      key: "mentor_mestre",
      label: "Mentor Master",
      score,
      nextThreshold: null,
    };
  }
  if (score >= 20) {
    return {
      key: "mentor_prata",
      label: "Mentor Prata",
      score,
      nextThreshold: 50,
    };
  }
  if (score >= 5) {
    return {
      key: "mentor_bronze",
      label: "Mentor Bronze",
      score,
      nextThreshold: 20,
    };
  }
  return {
    key: "mentor_novo",
    label: "Mentor em formação",
    score,
    nextThreshold: 5,
  };
}

/** =========================================================
 *  14. Helper de estilo DISC (texto explicativo)
 * ========================================================= */
export function describeDiscStyle(discKey) {
  switch ((discKey || "").toUpperCase()) {
    case "D":
      return "Perfil Executor (D): foco em resultado, decisão rápida e desafios de alto impacto.";
    case "I":
      return "Perfil Influente (I): foco em pessoas, comunicação e engajamento do time.";
    case "S":
      return "Perfil Estável (S): foco em consistência, suporte e ambiente colaborativo.";
    case "C":
      return "Perfil Conformidade (C): foco em qualidade, detalhes e precisão nas entregas.";
    default:
      return "Perfil comportamental ainda não configurado.";
  }
}
