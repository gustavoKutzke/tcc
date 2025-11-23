// src/pages/Shop.js
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";

import {
  fetchCurrentUserForShop,
  subscribeRewards,
  subscribeRedemptions,
  createReward as createRewardService,
  deleteReward as deleteRewardService,
  redeemReward as redeemRewardService,
  approveRedemption as approveRedemptionService,
  denyRedemption as denyRedemptionService,
  markDelivered as markDeliveredService,
} from "../services/shopService";

/**
 * Coleções:
 *  - rewards: { name, price, stock, imageUrl, createdAt }
 *  - redemptions: { rewardId, rewardName, rewardPrice, userUid, userName, status: 'pendente'|'aprovado'|'negado'|'entregue', createdAt, decidedAt? }
 */

export default function Shop() {
  const navigate = useNavigate();

  // auth guard simples
  useEffect(
    () => auth.onAuthStateChanged((u) => !u && navigate("/auth")),
    [navigate]
  );

  const [me, setMe] = useState(null);
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return setMe(null);
      const meData = await fetchCurrentUserForShop(u.uid);
      setMe(meData);
    });
    return () => unsub();
  }, []);

  const isManager = me?.role === "gestor";
  const currentPoints = Number(me?.points || 0);

  // ===== Catálogo =====
  const [rewards, setRewards] = useState([]);
  useEffect(() => {
    const unsub = subscribeRewards(setRewards);
    return () => unsub && unsub();
  }, []);

  // ===== Resgates (apenas gestor vê tudo; colaborador vê seus) =====
  const [redemptions, setRedemptions] = useState([]);
  const [tab, setTab] = useState("catalog"); // catalog | approvals | my
  useEffect(() => {
    if (!me) return;
    const unsub = subscribeRedemptions({
      uid: me.uid,
      isManager,
      callback: setRedemptions,
    });
    return () => unsub && unsub();
  }, [me, isManager]);

  // ===== Form gestor (criar item) =====
  const [name, setName] = useState("");
  const [price, setPrice] = useState(50);
  const [stock, setStock] = useState(10);
  const [imageUrl, setImageUrl] = useState("");
  const canCreate = useMemo(
    () =>
      isManager &&
      name.trim().length >= 2 &&
      Number(price) > 0 &&
      Number(stock) >= 0 &&
      imageUrl.trim().length > 0,
    [isManager, name, price, stock, imageUrl]
  );

  async function createReward(e) {
    e.preventDefault();
    if (!canCreate) return;
    await createRewardService({ name, price, stock, imageUrl });
    setName("");
    setPrice(50);
    setStock(10);
    setImageUrl("");
    alert("Item criado!");
  }

  async function removeReward(id) {
    if (!window.confirm("Excluir este item da loja?")) return;
    await deleteRewardService(id);
  }

  // ===== Colaborador: resgatar =====
  async function redeemReward(reward) {
    if (!me) return;
    if (Number(me.points || 0) < Number(reward.price || 0)) {
      alert("Pontos insuficientes.");
      return;
    }
    if (
      !window.confirm(
        `Resgatar "${reward.name}" por ${reward.price} pts? Seus pontos serão debitados agora e o gestor aprovará em seguida.`
      )
    )
      return;

    try {
      await redeemRewardService({ user: me, reward });
      alert("Resgate criado! Aguarde aprovação do gestor.");
      setTab("my");
    } catch (e) {
      console.error(e);
      alert(e.message || "Falha ao resgatar.");
    }
  }

  // ===== Gestor: aprovar / negar / entregue =====
  async function approveRedemption(r) {
    try {
      await approveRedemptionService(r);
    } catch (e) {
      console.error(e);
      alert(e.message || "Falha ao aprovar.");
    }
  }

  async function denyRedemption(r) {
    if (!window.confirm("Negar este resgate e reembolsar pontos?")) return;
    try {
      await denyRedemptionService(r);
    } catch (e) {
      console.error(e);
      alert(e.message || "Falha ao negar.");
    }
  }

  async function markDelivered(r) {
    try {
      await markDeliveredService(r.id);
    } catch (e) {
      console.error(e);
      alert("Falha ao marcar como entregue.");
    }
  }

  // ===== Export CSV (gestor) =====
  function exportCSV() {
    const lines = [];
    lines.push("Status,Colaborador,Item,Preço,Data");
    redemptions.forEach((x) => {
      const dt = x.createdAt?.toDate
        ? x.createdAt.toDate().toLocaleString("pt-BR")
        : "-";
      lines.push(
        `${x.status},"${(x.userName || "").replace(
          /"/g,
          '""'
        )}","${(x.rewardName || "").replace(/"/g, '""')}",${
          x.rewardPrice
        },${dt}`
      );
    });
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resgates_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===== Derivados =====
  const pendentes = isManager
    ? redemptions.filter((r) => r.status === "pendente")
    : [];
  const meus = !isManager ? redemptions : [];

  // ===== Gamificação: recompensa alvo e progresso =====
  const { affordableReward, nextReward } = useMemo(() => {
    if (!rewards || rewards.length === 0)
      return { affordableReward: null, nextReward: null };
    const withStock = rewards.filter((r) => Number(r.stock || 0) > 0);
    if (withStock.length === 0)
      return { affordableReward: null, nextReward: null };

    const sorted = [...withStock].sort(
      (a, b) => Number(a.price || 0) - Number(b.price || 0)
    );

    let affordable = null;
    let next = null;

    sorted.forEach((r) => {
      const price = Number(r.price || 0);
      if (price <= currentPoints) {
        affordable = r;
      } else if (!next && price > currentPoints) {
        next = r;
      }
    });

    return { affordableReward: affordable, nextReward: next };
  }, [rewards, currentPoints]);

  const progressToNext = useMemo(() => {
    if (!nextReward) return 0;
    const price = Number(nextReward.price || 0);
    if (price <= 0) return 0;
    const pct = (currentPoints / price) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [nextReward, currentPoints]);

  return (
    <>
      <h2 className="section-title">Loja de Recompensas</h2>

      {/* Abas + Saldo + Gamificação da Loja */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="btn-row" style={{ flexWrap: "wrap" }}>
          <button
            className="btn"
            onClick={() => setTab("catalog")}
            style={tab === "catalog" ? activeBtn : undefined}
          >
            Catálogo
          </button>
          {!isManager && (
            <button
              className="btn"
              onClick={() => setTab("my")}
              style={tab === "my" ? activeBtn : undefined}
            >
              Meus resgates
            </button>
          )}
          {isManager && (
            <>
              <button
                className="btn"
                onClick={() => setTab("approvals")}
                style={tab === "approvals" ? activeBtn : undefined}
              >
                Aprovações
              </button>
              <button
                className="btn"
                onClick={exportCSV}
                style={{ marginLeft: "auto" }}
              >
                Exportar CSV
              </button>
            </>
          )}
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          Saldo atual: <strong>{currentPoints} pts</strong>
        </div>

        {!isManager && (
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {affordableReward ? (
              <div
                className="card"
                style={{
                  padding: 8,
                  borderLeft: "4px solid #4a8f5f",
                  background: "rgba(130,200,140,.06)",
                }}
              >
                <div style={{ fontSize: 13, marginBottom: 2 }}>
                  🎁 Você já pode resgatar
                </div>
                <div style={{ fontWeight: 900 }}>
                  {affordableReward.name}{" "}
                  <span className="muted">
                    ({affordableReward.price} pts)
                  </span>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: 8 }}>
                <div style={{ fontSize: 13, marginBottom: 2 }}>
                  ✨ Comece sua jornada
                </div>
                <div className="muted">
                  Acumule pontos concluindo metas e recebendo kudos para
                  resgatar suas primeiras recompensas.
                </div>
              </div>
            )}

            {nextReward && (
              <div
                className="card"
                style={{
                  padding: 10,
                  borderLeft: "4px solid #c8a848",
                  background: "rgba(200,168,72,.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13 }}>
                      🎯 Próximo objetivo de recompensa
                    </div>
                    <div style={{ fontWeight: 900 }}>
                      {nextReward.name}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Faltam{" "}
                      <strong>
                        {Math.max(
                          0,
                          Number(nextReward.price || 0) -
                            currentPoints
                        )}{" "}
                        pts
                      </strong>{" "}
                      para resgatar.
                    </div>
                  </div>
                  <div style={{ minWidth: 160 }}>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 999,
                        background: "#f3ece2",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${progressToNext}%`,
                          height: "100%",
                          borderRadius: 999,
                          background:
                            "linear-gradient(90deg,#c8a848,#e4c970)",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        textAlign: "right",
                        marginTop: 2,
                        color: "#7b6c64",
                      }}
                    >
                      {Math.round(progressToNext)}% do caminho
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Catálogo */}
      {tab === "catalog" && (
        <>
          {isManager && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h3 style={{ marginTop: 0 }}>Adicionar item</h3>
              <form
                onSubmit={createReward}
                className="grid"
                style={{
                  gridTemplateColumns: "1fr 120px 120px",
                  gap: 10,
                }}
              >
                <div>
                  <label className="label">Nome</label>
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Camiseta da empresa"
                  />
                </div>
                <div>
                  <label className="label">Preço (pts)</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Estoque</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </div>
                <div style={{ gridColumn: "1 / 4" }}>
                  <label className="label">URL da imagem</label>
                  <input
                    className="input"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="btn-row" style={{ gridColumn: "1 / 4" }}>
                  <button
                    className="btn btn-primary"
                    disabled={!canCreate}
                  >
                    Salvar item
                  </button>
                </div>
              </form>
            </div>
          )}

          <div
            className="grid"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit,minmax(220px,1fr))",
            }}
          >
            {rewards.map((it) => {
              const price = Number(it.price || 0);
              const stockNum = Number(it.stock || 0);
              const canAfford = currentPoints >= price;
              const missing = Math.max(0, price - currentPoints);

              return (
                <div
                  key={it.id}
                  className="card"
                  style={{ display: "grid", gap: 8 }}
                >
                  {it.imageUrl && (
                    <div
                      style={{
                        width: "100%",
                        height: 160,
                        overflow: "hidden",
                        borderRadius: 10,
                        border: "1px solid #eee",
                      }}
                    >
                      <img
                        src={it.imageUrl}
                        alt={it.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                  )}
                  <div style={{ fontWeight: 900 }}>{it.name}</div>
                  <div className="muted">
                    Preço: <strong>{price} pts</strong>
                  </div>
                  <div className="muted">
                    Estoque: <strong>{stockNum}</strong>
                  </div>

                  {!isManager && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {canAfford
                        ? "Você já tem pontos suficientes para este item. 👏"
                        : `Faltam ${missing} pts para este item.`}
                    </div>
                  )}

                  <div className="btn-row">
                    {!isManager ? (
                      <button
                        className="btn btn-primary"
                        onClick={() => redeemReward(it)}
                        disabled={!canAfford || stockNum <= 0}
                      >
                        {stockNum <= 0
                          ? "Sem estoque"
                          : canAfford
                          ? "Resgatar agora"
                          : `Faltam ${missing} pts`}
                      </button>
                    ) : (
                      <button
                        className="btn"
                        onClick={() => removeReward(it.id)}
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {rewards.length === 0 && (
              <div className="card">
                <p className="muted">Nenhum item cadastrado.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Meus resgates (colaborador) */}
      {tab === "my" && !isManager && (
        <div className="grid">
          {meus.map((r) => (
            <RedemptionCard key={r.id} r={r} />
          ))}
          {meus.length === 0 && (
            <div className="card">
              <p className="muted">Você ainda não fez resgates.</p>
            </div>
          )}
        </div>
      )}

      {/* Aprovações (gestor) */}
      {tab === "approvals" && isManager && (
        <div className="grid">
          {pendentes.map((r) => (
            <div
              key={r.id}
              className="card"
              style={{ display: "grid", gap: 8 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ fontWeight: 900 }}>{r.rewardName}</div>
                <span style={badge("pendente")}>Pendente</span>
              </div>
              <div className="muted">
                Colaborador: <strong>{r.userName}</strong> • Preço:{" "}
                <strong>{r.rewardPrice} pts</strong>
              </div>
              <div className="btn-row">
                <button
                  className="btn btn-primary"
                  onClick={() => approveRedemption(r)}
                >
                  Aprovar
                </button>
                <button
                  className="btn"
                  onClick={() => denyRedemption(r)}
                >
                  Negar
                </button>
              </div>
            </div>
          ))}
          {pendentes.length === 0 && (
            <div className="card">
              <p className="muted">Sem resgates pendentes.</p>
            </div>
          )}

          {/* Lista completa para marcar entregue (opcional) */}
          <div className="card" style={{ gridColumn: "1/-1" }}>
            <h3 style={{ marginTop: 0 }}>Todos os resgates</h3>
            <div className="grid" style={{ marginTop: 10 }}>
              {redemptions.map((r) => (
                <div
                  key={r.id}
                  className="card"
                  style={{ display: "grid", gap: 6 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      {r.rewardName}
                    </div>
                    <span style={badge(r.status)}>
                      {statusLabel(r.status)}
                    </span>
                  </div>
                  <div className="muted">
                    {r.userName} • {r.rewardPrice} pts
                  </div>
                  {r.status === "aprovado" && (
                    <div className="btn-row">
                      <button
                        className="btn"
                        onClick={() => markDelivered(r)}
                      >
                        Marcar como entregue
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ====== subcomponentes & helpers ====== */

function RedemptionCard({ r }) {
  return (
    <div className="card" style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontWeight: 900 }}>{r.rewardName}</div>
        <span style={badge(r.status)}>{statusLabel(r.status)}</span>
      </div>
      <div className="muted">
        Preço: <strong>{r.rewardPrice} pts</strong>
      </div>
      <div className="muted">
        Solicitedo em:{" "}
        <strong>
          {r.createdAt?.toDate
            ? r.createdAt.toDate().toLocaleString("pt-BR")
            : "-"}
        </strong>
      </div>
      {r.decidedAt?.toDate && (
        <div className="muted">
          Atualizado em:{" "}
          <strong>
            {r.decidedAt.toDate().toLocaleString("pt-BR")}
          </strong>
        </div>
      )}
    </div>
  );
}

function statusLabel(s) {
  if (s === "pendente") return "Pendente";
  if (s === "aprovado") return "Aprovado";
  if (s === "negado") return "Negado";
  if (s === "entregue") return "Entregue";
  return s || "-";
}

function badge(status) {
  let bg = "#fff",
    color = "#7b6c64",
    border = "#e9e1d8";
  if (status === "pendente") {
    bg = "rgba(200,168,72,.1)";
    color = "#4a352b";
    border = "#e5d7b8";
  }
  if (status === "aprovado") {
    bg = "rgba(130, 200, 140, .15)";
    color = "#305a38";
    border = "#cfe7d2";
  }
  if (status === "negado") {
    bg = "rgba(200, 130, 130, .15)";
    color = "#5a3030";
    border = "#e7cfcf";
  }
  if (status === "entregue") {
    bg = "rgba(120, 160, 220, .15)";
    color = "#2d3f6b";
    border = "#cfd9ee";
  }
  return {
    alignSelf: "start",
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: bg,
    fontWeight: 800,
    color,
    whiteSpace: "nowrap",
    height: 28,
    display: "inline-flex",
    alignItems: "center",
  };
}

const activeBtn = {
  borderColor: "#e9e1d8",
  boxShadow: "0 0 0 4px rgba(200,168,72,.25)",
};
