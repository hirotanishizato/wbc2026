import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

const DEADLINE = new Date("2026-03-05T12:00:00+09:00");
const LS_KEY = "wbc2026_nickname";

const TEAMS = [
  { name: "日本", flag: "🇯🇵", pool: "C", color: "#DC2626" },
  { name: "アメリカ", flag: "🇺🇸", pool: "B", color: "#2563EB" },
  { name: "ドミニカ共和国", flag: "🇩🇴", pool: "D", color: "#DC2626" },
  { name: "ベネズエラ", flag: "🇻🇪", pool: "D", color: "#F59E0B" },
  { name: "プエルトリコ", flag: "🇵🇷", pool: "A", color: "#2563EB" },
  { name: "キューバ", flag: "🇨🇺", pool: "A", color: "#2563EB" },
  { name: "メキシコ", flag: "🇲🇽", pool: "B", color: "#16A34A" },
  { name: "韓国", flag: "🇰🇷", pool: "C", color: "#DC2626" },
  { name: "オランダ", flag: "🇳🇱", pool: "D", color: "#F97316" },
  { name: "カナダ", flag: "🇨🇦", pool: "A", color: "#DC2626" },
  { name: "イタリア", flag: "🇮🇹", pool: "B", color: "#16A34A" },
  { name: "オーストラリア", flag: "🇦🇺", pool: "C", color: "#16A34A" },
  { name: "チャイニーズ・タイペイ", flag: "🇹🇼", pool: "C", color: "#2563EB" },
  { name: "パナマ", flag: "🇵🇦", pool: "A", color: "#DC2626" },
  { name: "イスラエル", flag: "🇮🇱", pool: "D", color: "#2563EB" },
  { name: "コロンビア", flag: "🇨🇴", pool: "A", color: "#F59E0B" },
  { name: "イギリス", flag: "🇬🇧", pool: "B", color: "#2563EB" },
  { name: "ブラジル", flag: "🇧🇷", pool: "B", color: "#16A34A" },
  { name: "チェコ", flag: "🇨🇿", pool: "C", color: "#DC2626" },
  { name: "ニカラグア", flag: "🇳🇮", pool: "D", color: "#2563EB" },
];

const POOL_COLORS = { A: "#6366F1", B: "#F43F5E", C: "#0EA5E9", D: "#F59E0B" };

function getSavedNickname() { try { return localStorage.getItem(LS_KEY) || ""; } catch { return ""; } }
function saveNickname(name) { try { localStorage.setItem(LS_KEY, name); } catch {} }

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return `${(d.getMonth()+1)}/${d.getDate()} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}

function useCountdown() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const diff = DEADLINE - now;
  if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  return { expired: false, days: Math.floor(diff / 864e5), hours: Math.floor((diff / 36e5) % 24), minutes: Math.floor((diff / 6e4) % 60), seconds: Math.floor((diff / 1e3) % 60) };
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
    const team = TEAMS.find((t) => t.name === b.team_side);
    const pickLabel = `${team?.flag || ""} ${b.team_side}`;
    if (!u.teamMap[b.team_side]) {
      u.teamMap[b.team_side] = { pick: pickLabel, teamName: b.team_side, amount: 0, betCount: 0, times: [], color: team?.color || "#6366F1" };
    }
    u.teamMap[b.team_side].amount += b.amount;
    u.teamMap[b.team_side].betCount += 1;
    u.teamMap[b.team_side].times.push(b.created_at);
  });
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
    u.teams.sort((a, b) => b.amount - a.amount);
    u.bestPayout = bestPayout;
    u.bestProfit = bestPayout - u.totalBet;
    u.betCount = u.teams.reduce((s, t) => s + t.betCount, 0);
    delete u.teamMap;
  });
  return Object.values(users).sort((a, b) => b.totalBet - a.totalBet);
}

/* ─── CountdownBanner ─── */
function CountdownBanner({ countdown }) {
  if (countdown.expired) {
    return (
      <div className="card" style={{ textAlign: "center", background: "linear-gradient(135deg, #FEE2E2, #FFF1F2)", border: "1px solid #FECACA" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#DC2626" }}>🔒 投票は締め切りました</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>WBC 2026 開幕！結果をお楽しみに</div>
      </div>
    );
  }
  const units = [{ v: countdown.days, l: "日" }, { v: countdown.hours, l: "時間" }, { v: countdown.minutes, l: "分" }, { v: countdown.seconds, l: "秒" }];
  return (
    <div className="card" style={{ textAlign: "center", background: "linear-gradient(135deg, #EEF2FF, #F0F9FF)", border: "1px solid #C7D2FE" }}>
      <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 10 }}>⏰ 投票〆切まで（3/5 12:00 開幕戦）</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
        {units.map((u, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: "#fff", boxShadow: "0 2px 8px rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#4F46E5", fontFamily: "'DM Mono', monospace" }}>{String(u.v).padStart(2, "0")}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4, fontWeight: 600 }}>{u.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── PersonalStatsModal ─── */
function PersonalStatsModal({ bets, winnerData, onClose }) {
  const stats = calcPersonalStats(bets, winnerData);
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#1F2937" }}>👤 個人別ベット成績</h2>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "#F9FAFB", marginBottom: 14, fontSize: 11, color: "#9CA3AF", lineHeight: 1.7 }}>
          💡 同じチームへの複数ベットは合算表示。ベスト的中は最も有利なチームが優勝した場合の損益。
        </div>
        {stats.length === 0 && <div style={{ textAlign: "center", color: "#D1D5DB", padding: 30, fontSize: 14 }}>まだベットがありません</div>}
        {stats.map((user, ui) => (
          <div key={user.name} style={{ marginBottom: 10, borderRadius: 14, border: "1px solid #F3F4F6", overflow: "hidden", background: "#fff" }}>
            <button onClick={() => setExpanded(expanded === ui ? null : ui)} style={{ width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1F2937" }}>{user.name}</span>
                  <span style={{ fontSize: 11, color: "#6B7280", background: "#F3F4F6", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{user.teams.length}チーム</span>
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>投資 <span style={{ fontWeight: 800, color: "#1F2937" }}>🎱{user.totalBet.toLocaleString()}</span></span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>ベスト <span style={{ fontWeight: 800, color: user.bestProfit >= 0 ? "#16A34A" : "#DC2626" }}>{user.bestProfit >= 0 ? "+" : "-"}🎱{Math.abs(user.bestProfit).toLocaleString()}</span></span>
                </div>
              </div>
              <span style={{ fontSize: 14, color: "#D1D5DB", transition: "transform 0.2s", transform: expanded === ui ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
            </button>
            {expanded === ui && (
              <div style={{ padding: "0 16px 16px", borderTop: "1px solid #F3F4F6" }}>
                <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
                  {[
                    { label: "総投資", value: `🎱${user.totalBet.toLocaleString()}`, bg: "#FEF2F2", color: "#DC2626" },
                    { label: "🏆最高払戻", value: `🎱${user.bestPayout.toLocaleString()}`, bg: "#F0FDF4", color: "#16A34A" },
                    { label: "ベスト損益", value: `${user.bestProfit >= 0 ? "+" : "-"}🎱${Math.abs(user.bestProfit).toLocaleString()}`, bg: user.bestProfit >= 0 ? "#F0FDF4" : "#FEF2F2", color: user.bestProfit >= 0 ? "#16A34A" : "#DC2626" },
                  ].map((c, ci) => (
                    <div key={ci} style={{ flex: 1, padding: "10px 6px", borderRadius: 10, background: c.bg, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 4 }}>{c.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: c.color, fontFamily: "'DM Mono', monospace" }}>{c.value}</div>
                    </div>
                  ))}
                </div>
                {user.teams.map((t, ti) => {
                  const netIfHit = t.payout - user.totalBet;
                  return (
                    <div key={ti} style={{ padding: "12px 0", borderBottom: ti < user.teams.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#1F2937" }}>{t.pick}</span>
                          {t.betCount > 1 && <span style={{ fontSize: 10, color: "#6B7280", background: "#F3F4F6", padding: "1px 6px", borderRadius: 4 }}>{t.betCount}回</span>}
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "#4F46E5", fontFamily: "'DM Mono', monospace" }}>×{t.odds}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[
                          { label: `賭け${t.betCount > 1 ? "(計)" : ""}`, value: `🎱${t.amount.toLocaleString()}`, color: "#6B7280" },
                          { label: "払戻", value: `🎱${t.payout.toLocaleString()}`, color: "#16A34A" },
                          { label: "損益", value: `${netIfHit >= 0 ? "+" : "-"}🎱${Math.abs(netIfHit).toLocaleString()}`, color: netIfHit >= 0 ? "#16A34A" : "#DC2626" },
                        ].map((c, ci) => (
                          <div key={ci} style={{ flex: 1, padding: "6px 4px", borderRadius: 8, background: "#F9FAFB", textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 2 }}>{c.label}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: c.color, fontFamily: "'DM Mono', monospace" }}>{c.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── HistoryModal ─── */
function HistoryModal({ bets, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#1F2937" }}>📋 全ベット履歴（{bets.length}件）</h2>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>
        {bets.length === 0 && <div style={{ textAlign: "center", color: "#D1D5DB", padding: 30, fontSize: 14 }}>まだベットがありません</div>}
        {bets.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < bets.length - 1 ? "1px solid #F3F4F6" : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }}>{b.name}</span>
                <span style={{ fontSize: 11, color: "#6B7280" }}>▸</span>
                <span style={{ fontSize: 13, color: "#4B5563" }}>{b.pick}</span>
              </div>
              <div style={{ fontSize: 11, color: "#D1D5DB", fontFamily: "'DM Mono', monospace" }}>{formatTime(b.time)}</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#4F46E5", fontFamily: "'DM Mono', monospace" }}>🎱{b.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── TeamButton ─── */
function TeamButton({ team, selected, onClick, odds, disabled, rank }) {
  const isSelected = selected === team.name;
  const poolColor = POOL_COLORS[team.pool] || "#6366F1";
  return (
    <button onClick={() => !disabled && onClick(team.name)} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px", borderRadius: 16,
      background: isSelected ? "#EEF2FF" : "#fff",
      border: isSelected ? "2px solid #6366F1" : "1px solid #F3F4F6",
      cursor: disabled ? "default" : "pointer", transition: "all 0.15s ease", textAlign: "left",
      boxShadow: isSelected ? "0 4px 16px rgba(99,102,241,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
      boxSizing: "border-box", opacity: disabled ? 0.5 : 1,
    }}>
      <span style={{ fontSize: 30, lineHeight: 1, flexShrink: 0 }}>{team.flag}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1F2937", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{team.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: poolColor, background: `${poolColor}15`, padding: "1px 8px", borderRadius: 6 }}>Pool {team.pool}</span>
          {odds && odds.count > 0 && <span style={{ fontSize: 10, color: "#9CA3AF" }}>{odds.count}票</span>}
        </div>
      </div>
      {odds && odds.pct > 0 && (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#4F46E5", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
            {odds.pct}<span style={{ fontSize: 13 }}>%</span>
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>×{odds.odds}</div>
        </div>
      )}
    </button>
  );
}

/* ─── BetForm ─── */
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
  const valid = name.trim() && amount && parseInt(amount) > 0;
  return (
    <div className="card" style={{ background: "#EEF2FF", border: "1px solid #C7D2FE" }}>
      <div style={{ fontSize: 13, color: "#4F46E5", fontWeight: 700, marginBottom: 12 }}>{label}</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input type="text" placeholder="名前" value={name} onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, padding: "12px 14px", borderRadius: 12, background: "#fff", border: "1px solid #E5E7EB", color: "#1F2937", fontSize: 14, outline: "none", minWidth: 0, boxSizing: "border-box", fontFamily: "inherit" }} />
        <div style={{ position: "relative", width: "38%" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🎱</span>
          <input type="number" placeholder="数量" value={amount} min="100" step="100" onChange={(e) => setAmount(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 10px 12px 30px", borderRadius: 12, background: "#fff", border: "1px solid #E5E7EB", color: "#1F2937", fontSize: 14, outline: "none", fontFamily: "'DM Mono', monospace" }} />
        </div>
      </div>
      <button onClick={handleSubmit} disabled={disabled || submitting || !valid}
        style={{
          width: "100%", padding: "14px", borderRadius: 12, border: "none", fontWeight: 700, fontSize: 15, cursor: valid ? "pointer" : "default",
          background: valid ? "linear-gradient(135deg, #6366F1, #4F46E5)" : "#E5E7EB",
          color: valid ? "#fff" : "#9CA3AF", transition: "all 0.2s", fontFamily: "inherit",
          boxShadow: valid ? "0 4px 14px rgba(99,102,241,0.3)" : "none",
        }}>
        {submitting ? "送信中..." : "ベットする ⚾"}
      </button>
    </div>
  );
}

/* ─── Toast ─── */
function SuccessToast({ message }) {
  if (!message) return null;
  return <div style={{ position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)", padding: "12px 28px", borderRadius: 50, background: "#1F2937", color: "#fff", fontSize: 14, fontWeight: 600, zIndex: 9999, boxShadow: "0 10px 40px rgba(0,0,0,0.15)", maxWidth: "85%" }}>✅ {message}</div>;
}

/* ─── RankingBar ─── */
function RankingBar({ items }) {
  const sorted = [...items].sort((a, b) => b.pct - a.pct).filter((x) => x.pct > 0);
  if (sorted.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      {sorted.slice(0, 6).map((item, i) => {
        const team = TEAMS.find(t => t.name === item.label);
        const color = team?.color || "#6366F1";
        return (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 28, fontSize: 11, fontWeight: 800, color: i === 0 ? "#4F46E5" : "#9CA3AF", textAlign: "center" }}>{i + 1}</div>
            <div style={{ width: 24, textAlign: "center", fontSize: 16 }}>{item.flag}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: i === 0 ? "#4F46E5" : "#6B7280", fontFamily: "'DM Mono', monospace" }}>{item.pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "#F3F4F6", overflow: "hidden" }}>
                <div style={{ width: `${Math.max(item.pct, 3)}%`, height: "100%", background: i === 0 ? "linear-gradient(90deg, #6366F1, #818CF8)" : color, borderRadius: 3, transition: "width 0.6s ease" }} />
              </div>
            </div>
            <div style={{ width: 42, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>×{item.odds}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── App ─── */
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
    if (!error) { setWinnerPick(null); showToast("ベット完了！"); loadData(); }
  };

  const winnerOdds = calcOdds(winnerData, TEAMS.map((t) => t.name));
  const winnerRanking = TEAMS.map((t) => ({ label: t.name, flag: t.flag, ...(winnerOdds[t.name] || { count: 0, total: 0, odds: "-", pct: 0 }) }));

  let totalBets = 0, totalAmount = 0;
  Object.values(winnerData).forEach((d) => { totalBets += d.count; totalAmount += d.total; });

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚾</div>
        <div style={{ fontSize: 14, color: "#9CA3AF", fontWeight: 600 }}>Loading...</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "'Zen Kaku Gothic New', 'Hiragino Kaku Gothic ProN', sans-serif", color: "#1F2937", maxWidth: 480, margin: "0 auto", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #F9FAFB; overflow-x: hidden; width: 100%; -webkit-font-smoothing: antialiased; }
        input::placeholder { color: #D1D5DB; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        ::-webkit-scrollbar { display: none; }
        .card { padding: 16px; border-radius: 16px; background: #fff; border: 1px solid #F3F4F6; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 10000; display: flex; justify-content: center; align-items: flex-start; padding: 40px 12px; overflow-y: auto; }
        .modal-content { width: 100%; max-width: 460px; background: #fff; border-radius: 20px; padding: 20px 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); animation: slideUp 0.25s ease; }
        .close-btn { background: #F3F4F6; border: none; color: #9CA3AF; font-size: 16px; width: 34px; height: 34px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
        .close-btn:active { background: #E5E7EB; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* ─── Header ─── */}
      <div style={{ padding: "20px 16px 16px", background: "#fff", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", letterSpacing: 3, fontFamily: "'DM Mono', monospace" }}>WBC 2026</div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1F2937", marginTop: 2 }}>⚾ 優勝予想</h1>
          </div>
          <div style={{ padding: "6px 14px", borderRadius: 20, background: "#FEF2F2", fontSize: 10, color: "#DC2626", fontWeight: 700 }}>⚠ シミュレーション</div>
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF" }}>優勝チームを予想してベット！ファン同士で楽しもう</div>
      </div>

      <div style={{ padding: "12px 12px 0" }}>

        {/* ─── Countdown ─── */}
        <CountdownBanner countdown={countdown} />

        {/* ─── Stats ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div className="card" style={{ textAlign: "center", marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>参加数</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1F2937", fontFamily: "'DM Mono', monospace" }}>{totalBets}</div>
          </div>
          <div className="card" style={{ textAlign: "center", marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>総ベット</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#4F46E5", fontFamily: "'DM Mono', monospace" }}>🎱{totalAmount.toLocaleString()}</div>
          </div>
        </div>

        {/* ─── Recent Bets ─── */}
        {recentBets.length > 0 && (
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }}>最新ベット</span>
            </div>
            {recentBets.slice(0, 4).map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < Math.min(recentBets.length, 4) - 1 ? "1px solid #F3F4F6" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>{b.name}</span>
                    <span style={{ fontSize: 10, color: "#D1D5DB" }}>▸</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.pick}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#D1D5DB", marginTop: 2, fontFamily: "'DM Mono', monospace" }}>{formatTime(b.time)}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#4F46E5", fontFamily: "'DM Mono', monospace", flexShrink: 0, marginLeft: 8 }}>🎱{b.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* ─── Action Buttons (replacing tabs) ─── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button onClick={() => setShowHistory(true)} style={{
            flex: 1, padding: "16px 10px", borderRadius: 16, cursor: "pointer", textAlign: "center",
            background: "#fff", border: "1px solid #F3F4F6", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.15s",
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>📋</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1F2937" }}>全ベット履歴</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>すべて見る</div>
          </button>
          <button onClick={() => setShowStats(true)} style={{
            flex: 1, padding: "16px 10px", borderRadius: 16, cursor: "pointer", textAlign: "center",
            background: "#fff", border: "1px solid #F3F4F6", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.15s",
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>👤</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1F2937" }}>個人別成績</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>投資額・払戻予想</div>
          </button>
        </div>

        {/* ─── Bet Form ─── */}
        {winnerPick && !countdown.expired && (
          <BetForm label={`🏆 「${TEAMS.find((t) => t.name === winnerPick)?.flag} ${winnerPick}」の優勝にベット`} onSubmit={handleWinnerBet} disabled={!winnerPick} />
        )}

        {/* ─── Rankings ─── */}
        {winnerRanking.some((x) => x.pct > 0) && (
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 800, color: "#1F2937", marginBottom: 2 }}>📊 オッズランキング</div>
            <RankingBar items={winnerRanking} />
          </div>
        )}

        {/* ─── Team Selection ─── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#6B7280", marginBottom: 12, padding: "0 2px" }}>
            {countdown.expired ? "🔒 投票は締め切りました" : winnerPick ? "💡 他のチームに変更もできます" : "🏆 優勝チームを選んでください"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {TEAMS.map((team) => (<TeamButton key={team.name} team={team} selected={winnerPick} onClick={setWinnerPick} odds={winnerOdds[team.name]} disabled={countdown.expired} />))}
          </div>
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div style={{ padding: "30px 16px 40px", textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#D1D5DB", lineHeight: 1.8 }}>
          WBC 2026 優勝予想シミュレーション<br />
          ファン同士で予想を楽しむためのサイトです<br />
          実際の金銭のやり取りは一切ありません
        </div>
      </div>

      <SuccessToast message={toast} />
      {showHistory && <HistoryModal bets={recentBets} onClose={() => setShowHistory(false)} />}
      {showStats && <PersonalStatsModal bets={rawBets} winnerData={winnerData} onClose={() => setShowStats(false)} />}
    </div>
  );
}
