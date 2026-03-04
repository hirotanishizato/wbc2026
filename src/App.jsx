import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

const DEADLINE = new Date("2026-03-05T12:00:00+09:00");
const LS_KEY = "wbc2026_nickname";

const TEAMS = [
  { name: "日本", flag: "🇯🇵", pool: "C" },
  { name: "アメリカ", flag: "🇺🇸", pool: "B" },
  { name: "ドミニカ共和国", flag: "🇩🇴", pool: "D" },
  { name: "ベネズエラ", flag: "🇻🇪", pool: "D" },
  { name: "プエルトリコ", flag: "🇵🇷", pool: "A" },
  { name: "キューバ", flag: "🇨🇺", pool: "A" },
  { name: "メキシコ", flag: "🇲🇽", pool: "B" },
  { name: "韓国", flag: "🇰🇷", pool: "C" },
  { name: "オランダ", flag: "🇳🇱", pool: "D" },
  { name: "カナダ", flag: "🇨🇦", pool: "A" },
  { name: "イタリア", flag: "🇮🇹", pool: "B" },
  { name: "オーストラリア", flag: "🇦🇺", pool: "C" },
  { name: "チャイニーズ・タイペイ", flag: "🇹🇼", pool: "C" },
  { name: "パナマ", flag: "🇵🇦", pool: "A" },
  { name: "イスラエル", flag: "🇮🇱", pool: "D" },
  { name: "コロンビア", flag: "🇨🇴", pool: "A" },
  { name: "イギリス", flag: "🇬🇧", pool: "B" },
  { name: "ブラジル", flag: "🇧🇷", pool: "B" },
  { name: "チェコ", flag: "🇨🇿", pool: "C" },
  { name: "ニカラグア", flag: "🇳🇮", pool: "D" },
];

function getSavedNickname() { try { return localStorage.getItem(LS_KEY) || ""; } catch { return ""; } }
function saveNickname(name) { try { localStorage.setItem(LS_KEY, name); } catch {} }

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return `${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getDate().toString().padStart(2,"0")} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}

function useCountdown() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const diff = DEADLINE - now;
  if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  return { expired: false, days: Math.floor(diff / 864e5), hours: Math.floor((diff / 36e5) % 24), minutes: Math.floor((diff / 6e4) % 60), seconds: Math.floor((diff / 1e3) % 60) };
}

function CountdownBanner({ countdown }) {
  if (countdown.expired) {
    return (
      <div style={{ margin: "0 0 16px", padding: "14px 12px", borderRadius: 14, textAlign: "center", background: "linear-gradient(135deg, rgba(239,83,80,0.15), rgba(239,83,80,0.05))", border: "1px solid rgba(239,83,80,0.3)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#ef5350", marginBottom: 2 }}>🔒 投票は締め切りました</div>
        <div style={{ fontSize: 11, color: "#8892b0" }}>WBC 2026 開幕！結果をお楽しみに</div>
      </div>
    );
  }
  const units = [{ value: countdown.days, label: "日" }, { value: countdown.hours, label: "時間" }, { value: countdown.minutes, label: "分" }, { value: countdown.seconds, label: "秒" }];
  return (
    <div style={{ margin: "0 0 16px", padding: "14px 12px", borderRadius: 14, textAlign: "center", background: "linear-gradient(135deg, rgba(230,200,102,0.08), rgba(230,200,102,0.02))", border: "1px solid rgba(230,200,102,0.15)" }}>
      <div style={{ fontSize: 11, color: "#8892b0", marginBottom: 8, fontWeight: 600 }}>⏰ 投票〆切まで（3/5 12:00 開幕戦キックオフ）</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        {units.map((u, i) => (
          <div key={i} style={{ textAlign: "center", minWidth: 52 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#e6c866", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "8px 6px" }}>{String(u.value).padStart(2, "0")}</div>
            <div style={{ fontSize: 9, color: "#5a6490", marginTop: 4, fontWeight: 600 }}>{u.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function aggregateBets(bets) {
  const winnerData = {}, recent = [];
  bets.forEach((b) => {
    if (b.match_id === "winner") {
      if (!winnerData[b.team_side]) winnerData[b.team_side] = { count: 0, total: 0 };
      winnerData[b.team_side].count += 1;
      winnerData[b.team_side].total += b.amount;
    }
  });
  [...bets].filter(b => b.match_id === "winner").sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach((b) => {
    const team = TEAMS.find((t) => t.name === b.team_side);
    recent.push({ name: b.user_name, pick: `${team?.flag || ""} ${b.team_side}`, amount: b.amount, time: b.created_at });
  });
  return { winnerData, recent };
}

function calcOdds(data, teams) {
  let total = 0; Object.values(data).forEach((d) => { total += d.total; });
  const result = {};
  teams.forEach((name) => { const d = data[name] || { count: 0, total: 0 }; result[name] = { count: d.count, total: d.total, odds: d.total > 0 && total > 0 ? (total / d.total).toFixed(1) : "-", pct: total > 0 ? Math.round((d.total / total) * 100) : 0 }; });
  return result;
}

function calcPersonalStats(bets, winnerData) {
  let winnerPool = 0;
  Object.values(winnerData).forEach((d) => { winnerPool += d.total; });

  const users = {};
  bets.filter(b => b.match_id === "winner").forEach((b) => {
    if (!users[b.user_name]) users[b.user_name] = { name: b.user_name, totalBet: 0, teamMap: {} };
    const u = users[b.user_name];
    u.totalBet += b.amount;

    // チーム別に統合
    const team = TEAMS.find((t) => t.name === b.team_side);
    const pickLabel = `${team?.flag || ""} ${b.team_side}`;
    if (!u.teamMap[b.team_side]) {
      u.teamMap[b.team_side] = { pick: pickLabel, teamName: b.team_side, amount: 0, betCount: 0, times: [] };
    }
    u.teamMap[b.team_side].amount += b.amount;
    u.teamMap[b.team_side].betCount += 1;
    u.teamMap[b.team_side].times.push(b.created_at);
  });

  // 各チームのオッズ・払戻を計算
  Object.values(users).forEach((u) => {
    let bestPayout = 0;
    u.teams = Object.values(u.teamMap).map((t) => {
      let oddsVal = 0, oddsStr = "-", payout = 0;
      if (winnerData[t.teamName] && winnerData[t.teamName].total > 0) {
        oddsVal = winnerPool / winnerData[t.teamName].total;
        payout = Math.round(t.amount * oddsVal);
        oddsStr = oddsVal.toFixed(1);
      }
      if (payout > bestPayout) bestPayout = payout;
      t.times.sort((a, b) => new Date(b) - new Date(a));
      return { ...t, odds: oddsStr, oddsVal, payout };
    });
    // 投資額が多い順にソート
    u.teams.sort((a, b) => b.amount - a.amount);
    u.bestPayout = bestPayout;
    u.bestProfit = bestPayout - u.totalBet;
    u.betCount = u.teams.reduce((s, t) => s + t.betCount, 0);
    delete u.teamMap;
  });

  return Object.values(users).sort((a, b) => b.totalBet - a.totalBet);
}

function PersonalStatsModal({ bets, winnerData, onClose }) {
  const stats = calcPersonalStats(bets, winnerData);
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 10000, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 12px", overflowY: "auto" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 460, background: "linear-gradient(135deg, #1a1f3a, #0d1225)", borderRadius: 16, padding: "20px 14px", border: "1px solid rgba(255,255,255,0.08)", animation: "fadeIn 0.3s ease" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e6c866" }}>👤 個人別ベット成績</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#8892b0", fontSize: 18, width: 32, height: 32, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 10, color: "#5a6490", lineHeight: 1.6 }}>
            💡 同じチームへの複数ベットは合算して表示。ベスト的中は最も有利なチームが優勝した場合の損益です。
          </div>
        </div>

        {stats.length === 0 && <div style={{ textAlign: "center", color: "#5a6490", padding: "30px 0", fontSize: 14 }}>まだベットがありません</div>}

        {stats.map((user, ui) => (
          <div key={user.name} style={{ marginBottom: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <button onClick={() => setExpanded(expanded === ui ? null : ui)} style={{
              width: "100%", padding: "14px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "none", border: "none", cursor: "pointer", textAlign: "left",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#e0e6ff" }}>{user.name}</span>
                  <span style={{ fontSize: 11, color: "#5a6490", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 6 }}>{user.teams.length}チーム{user.betCount > user.teams.length ? ` (${user.betCount}回)` : ""}</span>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#8892b0" }}>投資 <span style={{ fontSize: 13, fontWeight: 800, color: "#ef5350", fontFamily: "'JetBrains Mono', monospace" }}>¥{user.totalBet.toLocaleString()}</span></span>
                  <span style={{ fontSize: 10, color: "#8892b0" }}>ベスト的中時 <span style={{ fontSize: 13, fontWeight: 800, color: user.bestProfit >= 0 ? "#4caf50" : "#ef5350", fontFamily: "'JetBrains Mono', monospace" }}>{user.bestProfit >= 0 ? "+" : ""}¥{user.bestProfit.toLocaleString()}</span></span>
                </div>
              </div>
              <span style={{ fontSize: 16, color: "#5a6490", transition: "transform 0.2s", transform: expanded === ui ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
            </button>

            {expanded === ui && (
              <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 90, padding: "10px 8px", borderRadius: 8, background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.15)", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#8892b0", marginBottom: 4 }}>総投資額</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#ef5350", fontFamily: "'JetBrains Mono', monospace" }}>¥{user.totalBet.toLocaleString()}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 90, padding: "10px 8px", borderRadius: 8, background: "rgba(230,200,102,0.08)", border: "1px solid rgba(230,200,102,0.15)", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#8892b0", marginBottom: 4 }}>🏆 最高払戻</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#e6c866", fontFamily: "'JetBrains Mono', monospace" }}>¥{user.bestPayout.toLocaleString()}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 90, padding: "10px 8px", borderRadius: 8, background: user.bestProfit >= 0 ? "rgba(76,175,80,0.08)" : "rgba(239,83,80,0.08)", border: `1px solid ${user.bestProfit >= 0 ? "rgba(76,175,80,0.15)" : "rgba(239,83,80,0.15)"}`, textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#8892b0", marginBottom: 4 }}>ベスト損益</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: user.bestProfit >= 0 ? "#4caf50" : "#ef5350", fontFamily: "'JetBrains Mono', monospace" }}>
                      {user.bestProfit >= 0 ? "+" : ""}¥{user.bestProfit.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: "#5a6490", marginBottom: 8, fontWeight: 600 }}>チーム別ベット（そのチームが優勝した場合）</div>
                {user.teams.map((t, ti) => {
                  const netIfHit = t.payout - user.totalBet;
                  return (
                    <div key={ti} style={{ padding: "12px 0", borderBottom: ti < user.teams.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, color: "#e0e6ff", fontWeight: 700 }}>🏆 {t.pick}</span>
                          {t.betCount > 1 && <span style={{ fontSize: 10, color: "#5a6490", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>{t.betCount}回</span>}
                        </div>
                        <span style={{ fontSize: 14, color: "#e6c866", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>×{t.odds}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 80, padding: "8px", borderRadius: 6, background: "rgba(239,83,80,0.06)", textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#8892b0", marginBottom: 2 }}>賭け金{t.betCount > 1 ? "(合計)" : ""}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#ef5350", fontFamily: "'JetBrains Mono', monospace" }}>¥{t.amount.toLocaleString()}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 80, padding: "8px", borderRadius: 6, background: "rgba(76,175,80,0.06)", textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#8892b0", marginBottom: 2 }}>払戻額</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#4caf50", fontFamily: "'JetBrains Mono', monospace" }}>¥{t.payout.toLocaleString()}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 80, padding: "8px", borderRadius: 6, background: netIfHit >= 0 ? "rgba(76,175,80,0.06)" : "rgba(239,83,80,0.06)", textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#8892b0", marginBottom: 2 }}>的中時損益</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: netIfHit >= 0 ? "#4caf50" : "#ef5350", fontFamily: "'JetBrains Mono', monospace" }}>
                            {netIfHit >= 0 ? "+" : ""}¥{netIfHit.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {t.betCount > 1 && (
                        <div style={{ marginTop: 6, fontSize: 10, color: "#3a4270" }}>
                          投票: {t.times.map(time => formatTime(time)).join("、")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        <div style={{ marginTop: 12, padding: "10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#3a4270", lineHeight: 1.6 }}>💡 払戻額は現在のオッズに基づく予想額です<br />今後の投票でオッズが変動する可能性があります</div>
        </div>
      </div>
    </div>
  );
}

function TeamButton({ team, selected, onClick, odds, disabled }) {
  const isSelected = selected === team.name;
  return (
    <button onClick={() => !disabled && onClick(team.name)} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", borderRadius: 12,
      background: isSelected ? "linear-gradient(135deg, #e6c86622, #d4a84322)" : "rgba(255,255,255,0.03)",
      border: isSelected ? "2px solid #e6c866" : "2px solid rgba(255,255,255,0.06)",
      cursor: disabled ? "default" : "pointer", transition: "all 0.2s", textAlign: "left",
      boxShadow: isSelected ? "0 0 20px rgba(230,200,102,0.1)" : "none", boxSizing: "border-box", opacity: disabled ? 0.6 : 1,
    }}>
      <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{team.flag}</span>
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? "#e6c866" : "#e0e6ff", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{team.name}</div>
        <div style={{ fontSize: 10, color: "#5a6490", marginTop: 2 }}>Pool {team.pool}</div>
      </div>
      {odds && odds.count > 0 && (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#e6c866", fontFamily: "'JetBrains Mono', monospace" }}>×{odds.odds}</div>
          <div style={{ fontSize: 10, color: "#5a6490" }}>{odds.count}票</div>
        </div>
      )}
    </button>
  );
}

function BetForm({ onSubmit, label, disabled }) {
  const [name, setName] = useState(() => getSavedNickname());
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!name.trim() || !amount || parseInt(amount) <= 0) return;
    setSubmitting(true);
    saveNickname(name.trim());
    await onSubmit(name.trim(), parseInt(amount));
    setSubmitting(false);
    setAmount("");
  };
  return (
    <div style={{ padding: 16, borderRadius: 14, marginBottom: 16, background: "linear-gradient(135deg, #1a1f3a, #141830)", border: "1px solid rgba(230,200,102,0.25)", animation: "fadeIn 0.3s ease", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
      <div style={{ fontSize: 12, color: "#e6c866", fontWeight: 700, marginBottom: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input type="text" placeholder="名前" value={name} onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, padding: "11px 12px", borderRadius: 10, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)", color: "#e0e6ff", fontSize: 14, outline: "none", minWidth: 0, boxSizing: "border-box" }} />
        <div style={{ position: "relative", width: "40%" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8892b0", fontSize: 14, pointerEvents: "none" }}>¥</span>
          <input type="number" placeholder="金額" value={amount} min="100" step="100" onChange={(e) => setAmount(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "11px 10px 11px 24px", borderRadius: 10, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)", color: "#e0e6ff", fontSize: 14, outline: "none" }} />
        </div>
      </div>
      <button onClick={handleSubmit} disabled={disabled || submitting || !name.trim() || !amount || parseInt(amount) <= 0}
        style={{
          width: "100%", padding: "13px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer",
          background: (disabled || !name.trim() || !amount || parseInt(amount) <= 0) ? "rgba(255,255,255,0.06)" : "linear-gradient(90deg, #e6c866, #d4a843)",
          color: (disabled || !name.trim() || !amount || parseInt(amount) <= 0) ? "#5a6490" : "#080c1a", transition: "all 0.2s",
        }}>
        {submitting ? "送信中..." : "ベットする ⚾"}
      </button>
    </div>
  );
}

function SuccessToast({ message }) {
  if (!message) return null;
  return <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", padding: "12px 24px", borderRadius: 12, background: "rgba(76,175,80,0.95)", color: "#fff", fontSize: 14, fontWeight: 600, zIndex: 9999, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", animation: "fadeIn 0.3s ease", maxWidth: "90%", textAlign: "center" }}>✅ {message}</div>;
}

function RankingBar({ items }) {
  const sorted = [...items].sort((a, b) => b.pct - a.pct).filter((x) => x.pct > 0);
  if (sorted.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      {sorted.slice(0, 8).map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <div style={{ width: 80, fontSize: 10, color: "#8892b0", textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.flag} {item.label}</div>
          <div style={{ flex: 1, height: 18, borderRadius: 4, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
            <div style={{ width: `${Math.max(item.pct, 2)}%`, height: "100%", background: "linear-gradient(90deg, #e6c866, #d4a843)", borderRadius: 4, transition: "width 0.6s ease", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4 }}>
              {item.pct >= 12 && <span style={{ fontSize: 9, fontWeight: 700, color: "#080c1a" }}>{item.pct}%</span>}
            </div>
          </div>
          <div style={{ width: 40, fontSize: 10, color: "#e6c866", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", textAlign: "right", flexShrink: 0 }}>×{item.odds}</div>
        </div>
      ))}
    </div>
  );
}

function HistoryModal({ bets, onClose }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 10000, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 12px", overflowY: "auto" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 460, background: "linear-gradient(135deg, #1a1f3a, #0d1225)", borderRadius: 16, padding: "20px 14px", border: "1px solid rgba(255,255,255,0.08)", animation: "fadeIn 0.3s ease" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e6c866" }}>📋 全ベット履歴（{bets.length}件）</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#8892b0", fontSize: 18, width: 32, height: 32, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        {bets.length === 0 && <div style={{ textAlign: "center", color: "#5a6490", padding: "30px 0", fontSize: 14 }}>まだベットがありません</div>}
        {bets.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < bets.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <span style={{ fontSize: 13, color: "#e0e6ff", fontWeight: 600 }}>{b.name}</span>
                <span style={{ fontSize: 10, color: "#3a4270" }}>▸</span>
                <span style={{ fontSize: 12, color: "#e0e6ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏆 {b.pick}</span>
              </div>
              <div style={{ fontSize: 10, color: "#5a6490", fontFamily: "'JetBrains Mono', monospace" }}>{formatTime(b.time)}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e6c866", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, marginLeft: 8 }}>¥{b.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentFeed({ recentBets }) {
  if (!recentBets || recentBets.length === 0) return null;
  return (
    <div>
      {recentBets.slice(0, 5).map((b, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i < Math.min(recentBets.length, 5) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#8892b0", flexShrink: 0 }}>{b.name}</span>
              <span style={{ fontSize: 11, color: "#3a4270", flexShrink: 0 }}>▸</span>
              <span style={{ fontSize: 12, color: "#e0e6ff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏆 {b.pick}</span>
            </div>
            <div style={{ fontSize: 9, color: "#5a6490", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{formatTime(b.time)}</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e6c866", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, marginLeft: 8 }}>¥{b.amount.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [winnerPick, setWinnerPick] = useState(null);
  const [winnerData, setWinnerData] = useState({});
  const [recentBets, setRecentBets] = useState([]);
  const [rawBets, setRawBets] = useState([]);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const countdown = useCountdown();

  const loadData = useCallback(async (retry = 0) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const { data, error } = await supabase.from("bets").select("*").abortSignal(controller.signal);
      clearTimeout(timeout);
      if (!error && data) {
        setRawBets(data);
        const agg = aggregateBets(data);
        setWinnerData(agg.winnerData);
        setRecentBets(agg.recent);
      }
    } catch (e) {
      if (retry < 2) { await new Promise(r => setTimeout(r, 1500)); return loadData(retry + 1); }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const ch = supabase.channel("bets-realtime").on("postgres_changes", { event: "INSERT", schema: "public", table: "bets" }, () => { loadData(); }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const handleWinnerBet = async (name, amount) => {
    if (!winnerPick || countdown.expired) return;
    const { error } = await supabase.from("bets").insert({ match_id: "winner", team_side: winnerPick, user_name: name, amount });
    if (!error) { setWinnerPick(null); showToast("優勝予想ベット完了！"); loadData(); }
  };

  const winnerOdds = calcOdds(winnerData, TEAMS.map((t) => t.name));
  const winnerRanking = TEAMS.map((t) => ({ label: t.name, flag: t.flag, ...(winnerOdds[t.name] || { count: 0, total: 0, odds: "-", pct: 0 }) }));

  let totalBets = 0, totalAmount = 0;
  Object.values(winnerData).forEach((d) => { totalBets += d.count; totalAmount += d.total; });

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080c1a", color: "#e6c866", fontSize: 18, fontFamily: "'JetBrains Mono', monospace" }}>⚾ Loading...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #080c1a 0%, #0a0f24 50%, #080c1a 100%)", fontFamily: "'Noto Sans JP', 'Helvetica Neue', sans-serif", color: "#e0e6ff", maxWidth: 480, margin: "0 auto", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700;900&family=JetBrains+Mono:wght@400;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #080c1a; overflow-x: hidden; width: 100%; }
        input::placeholder { color: #4a5280; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        ::-webkit-scrollbar { height: 0; width: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      <div style={{ padding: "28px 16px 18px", textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(230,200,102,0.08) 0%, transparent 70%)" }} />
        <div style={{ fontSize: 11, letterSpacing: 6, color: "#e6c866", fontWeight: 700, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace", position: "relative" }}>2026 WBC</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.3, position: "relative", background: "linear-gradient(135deg, #fff 0%, #e6c866 50%, #fff 100%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 3s linear infinite" }}>⚾ 優勝予想</h1>
        <div style={{ fontSize: 12, color: "#8892b0", marginTop: 6, position: "relative" }}>WBC 2026 — 優勝チームを予想してベット！</div>
        <div style={{ display: "inline-block", marginTop: 10, padding: "4px 14px", position: "relative", borderRadius: 20, background: "rgba(239,83,80,0.12)", border: "1px solid rgba(239,83,80,0.25)", fontSize: 10, color: "#ef5350", fontWeight: 700, letterSpacing: 1 }}>⚠ シミュレーション専用・実際の賭博ではありません</div>
      </div>

      <div style={{ padding: "0 12px" }}>
        <CountdownBanner countdown={countdown} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[{ label: "総ベット数", value: totalBets, icon: "🎫" }, { label: "総ベット額", value: `¥${totalAmount.toLocaleString()}`, icon: "💰" }].map((s, i) => (
            <div key={i} style={{ background: "linear-gradient(135deg, #1a1f3a, #0d1225)", borderRadius: 14, padding: "14px 10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#e6c866", fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#8892b0", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {recentBets.length > 0 && (
          <div style={{ marginBottom: 16, background: "linear-gradient(135deg, #1a1f3a, #0d1225)", borderRadius: 14, padding: "14px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#4caf50", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e6c866" }}>最新ベット</span>
            </div>
            <RecentFeed recentBets={recentBets} />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button onClick={() => setShowHistory(true)} style={{
            flex: 1, padding: "14px 8px", borderRadius: 14, cursor: "pointer", textAlign: "center", boxSizing: "border-box",
            background: "linear-gradient(135deg, rgba(230,200,102,0.06), rgba(230,200,102,0.02))",
            border: "2px solid rgba(230,200,102,0.2)", transition: "all 0.2s",
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>📋</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#e6c866" }}>全ベット履歴</div>
            <div style={{ fontSize: 10, color: "#8892b0", marginTop: 2 }}>すべてのベットを見る</div>
          </button>
          <button onClick={() => setShowStats(true)} style={{
            flex: 1, padding: "14px 8px", borderRadius: 14, cursor: "pointer", textAlign: "center", boxSizing: "border-box",
            background: "linear-gradient(135deg, rgba(76,175,80,0.06), rgba(76,175,80,0.02))",
            border: "2px solid rgba(76,175,80,0.2)", transition: "all 0.2s",
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>👤</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#4caf50" }}>個人別成績</div>
            <div style={{ fontSize: 10, color: "#8892b0", marginTop: 2 }}>投資額・払戻予想</div>
          </button>
        </div>

        <div style={{ animation: "fadeIn 0.3s ease" }}>
          {winnerPick && !countdown.expired && (
            <BetForm label={`🏆 「${TEAMS.find((t) => t.name === winnerPick)?.flag} ${winnerPick}」の優勝にベット`} onSubmit={handleWinnerBet} disabled={!winnerPick} />
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#8892b0", marginBottom: 12 }}>
            {countdown.expired ? "🔒 投票は締め切りました — オッズと結果を確認できます" : winnerPick ? "💡 他のチームに変更もできます" : "🏆 優勝すると思うチームを選んでください"}
          </div>
          {winnerRanking.some((x) => x.pct > 0) && (
            <div style={{ marginBottom: 16, padding: "14px 12px", borderRadius: 14, background: "linear-gradient(135deg, #1a1f3a, #0d1225)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#e6c866", marginBottom: 4 }}>📊 オッズランキング</div>
              <RankingBar items={winnerRanking} />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {TEAMS.map((team) => (<TeamButton key={team.name} team={team} selected={winnerPick} onClick={setWinnerPick} odds={winnerOdds[team.name]} disabled={countdown.expired} />))}
          </div>
        </div>
      </div>

      <div style={{ padding: "30px 16px 40px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.04)", marginTop: 30 }}>
        <div style={{ fontSize: 11, color: "#3a4270", lineHeight: 1.6 }}>WBC 2026 優勝予想シミュレーション<br />ファン同士で予想を楽しむためのサイトです<br />実際の金銭のやり取りは一切ありません</div>
      </div>

      <SuccessToast message={toast} />
      {showHistory && <HistoryModal bets={recentBets} onClose={() => setShowHistory(false)} />}
      {showStats && <PersonalStatsModal bets={rawBets} winnerData={winnerData} onClose={() => setShowStats(false)} />}
    </div>
  );
}
