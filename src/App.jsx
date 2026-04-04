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

const TABS = [
  { key: "top", label: "TOP" },
  { key: "wbc", label: "WBC" },
  { key: "soccer", label: "サッカー" },
  { key: "boxing", label: "ボクシング" },
  { key: "mahjong", label: "麻雀" },
];

const POOL_COLORS = { A: "#6366F1", B: "#F43F5E", C: "#0EA5E9", D: "#F59E0B" };

const STAGE_LABELS = {
  group: "グループステージ",
  r32: "ラウンド32",
  qf: "準々決勝",
  sf: "準決勝",
  final: "決勝",
};

const SOCCER_FLAGS = {
  "日本": "🇯🇵", "オランダ": "🇳🇱", "チュニジア": "🇹🇳", "スウェーデン": "🇸🇪",
  "ブラジル": "🇧🇷", "モロッコ": "🇲🇦", "スペイン": "🇪🇸", "ウルグアイ": "🇺🇾",
  "フランス": "🇫🇷", "セネガル": "🇸🇳", "アルゼンチン": "🇦🇷", "オーストリア": "🇦🇹",
  "ポルトガル": "🇵🇹", "コロンビア": "🇨🇴", "イングランド": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "クロアチア": "🇭🇷",
  "ドイツ": "🇩🇪", "コートジボワール": "🇨🇮",
};

function getFlag(name) { return SOCCER_FLAGS[name] || "🏳️"; }

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
  const d = Math.floor(diff / 864e5), h = Math.floor((diff / 36e5) % 24), m = Math.floor((diff / 6e4) % 60), s = Math.floor((diff / 1e3) % 60);
  return { expired: false, days: d, hours: h, minutes: m, seconds: s };
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
    if (!u.teamMap[b.team_side]) u.teamMap[b.team_side] = { pick: pickLabel, teamName: b.team_side, amount: 0, betCount: 0, times: [] };
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

/* ─── Modal: PersonalStats ─── */
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
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>投資 <span style={{ fontWeight: 800, color: "#1F2937" }}>⚽{user.totalBet.toLocaleString()}</span></span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>ベスト <span style={{ fontWeight: 800, color: user.bestProfit >= 0 ? "#16A34A" : "#DC2626" }}>{user.bestProfit >= 0 ? "+" : "-"}⚽{Math.abs(user.bestProfit).toLocaleString()}</span></span>
                </div>
              </div>
              <span style={{ fontSize: 14, color: "#D1D5DB", transition: "transform 0.2s", transform: expanded === ui ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
            </button>
            {expanded === ui && (
              <div style={{ padding: "0 16px 16px", borderTop: "1px solid #F3F4F6" }}>
                <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
                  {[
                    { label: "総投資", value: `⚽${user.totalBet.toLocaleString()}`, bg: "#FEF2F2", color: "#DC2626" },
                    { label: "最高払戻", value: `⚽${user.bestPayout.toLocaleString()}`, bg: "#F0FDF4", color: "#16A34A" },
                    { label: "ベスト損益", value: `${user.bestProfit >= 0 ? "+" : "-"}⚽${Math.abs(user.bestProfit).toLocaleString()}`, bg: user.bestProfit >= 0 ? "#F0FDF4" : "#FEF2F2", color: user.bestProfit >= 0 ? "#16A34A" : "#DC2626" },
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
                          { label: `賭け${t.betCount > 1 ? "(計)" : ""}`, value: `⚽${t.amount.toLocaleString()}`, color: "#6B7280" },
                          { label: "払戻", value: `⚽${t.payout.toLocaleString()}`, color: "#16A34A" },
                          { label: "損益", value: `${netIfHit >= 0 ? "+" : "-"}⚽${Math.abs(netIfHit).toLocaleString()}`, color: netIfHit >= 0 ? "#16A34A" : "#DC2626" },
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

/* ─── Modal: History ─── */
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
                <span style={{ fontSize: 11, color: "#D1D5DB" }}>▸</span>
                <span style={{ fontSize: 13, color: "#4B5563" }}>{b.pick}</span>
              </div>
              <div style={{ fontSize: 11, color: "#D1D5DB", fontFamily: "'DM Mono', monospace" }}>{formatTime(b.time)}</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#4F46E5", fontFamily: "'DM Mono', monospace" }}>⚽{b.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── TeamButton ─── */
function TeamButton({ team, selected, onClick, odds, disabled }) {
  const isSelected = selected === team.name;
  const poolColor = POOL_COLORS[team.pool] || "#6366F1";
  return (
    <button onClick={() => !disabled && onClick(team.name)} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px", borderRadius: 16,
      background: isSelected ? "#EEF2FF" : "#fff", border: isSelected ? "2px solid #6366F1" : "1px solid #F3F4F6",
      cursor: disabled ? "default" : "pointer", transition: "all 0.15s ease", textAlign: "left",
      boxShadow: isSelected ? "0 4px 16px rgba(99,102,241,0.12)" : "0 1px 3px rgba(0,0,0,0.04)", boxSizing: "border-box", opacity: disabled ? 0.5 : 1,
    }}>
      <span style={{ fontSize: 30, lineHeight: 1, flexShrink: 0 }}>{team.flag}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1F2937", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{team.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: poolColor, background: `${poolColor}15`, padding: "1px 8px", borderRadius: 6 }}>Pool {team.pool}</span>
          {odds && odds.count > 0 && <span style={{ fontSize: 10, color: "#9CA3AF" }}>{odds.count}票</span>}
        </div>
      </div>
      {odds && odds.pct > 0 && (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#4F46E5", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{odds.pct}<span style={{ fontSize: 13 }}>%</span></div>
          <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>×{odds.odds}</div>
        </div>
      )}
    </button>
  );
}

/* ─── BetForm ─── */
function BetForm({ onSubmit, label, disabled, sportEmoji = "⚾" }) {
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
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>⚽</span>
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
        {submitting ? "送信中..." : `ベットする ${sportEmoji}`}
      </button>
    </div>
  );
}

function SuccessToast({ message }) {
  if (!message) return null;
  return <div style={{ position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)", padding: "12px 28px", borderRadius: 50, background: "#1F2937", color: "#fff", fontSize: 14, fontWeight: 600, zIndex: 9999, boxShadow: "0 10px 40px rgba(0,0,0,0.15)", maxWidth: "85%" }}>✅ {message}</div>;
}

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

/* ─── Prediction Card ─── */
function PredictionCard({ title, category, bannerStyle, topPicks, participants, deadline, topResult, onClick }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", cursor: onClick ? "pointer" : "default", marginBottom: 14 }} onClick={onClick}>
      <div style={{ position: "relative", height: 170, overflow: "hidden", ...bannerStyle }}>
        {onClick && (
          <button style={{ position: "absolute", right: 14, bottom: 14, padding: "8px 22px", borderRadius: 30, background: "#4F46E5", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", boxShadow: "0 4px 14px rgba(79,70,229,0.4)", cursor: "pointer" }}>予想する</button>
        )}
        {topResult && (
          <div style={{ position: "absolute", right: 14, top: 14, padding: "6px 14px", borderRadius: 20, background: "rgba(255,255,255,0.95)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#4F46E5", fontFamily: "'DM Mono', monospace" }}>{topResult.pct}%</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>{topResult.label}</span>
          </div>
        )}
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1F2937", marginBottom: 10, lineHeight: 1.4 }}>{title}</div>
        {topPicks && topPicks.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {topPicks.map((pick, i) => (
              <span key={i} style={{ padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                background background: pick.bg || "#F3F4F6", color: pick.color || "#4B5563", border: `1px solid ${pick.borderColor || "#E5E7EB"}` }}>{pick.label}</span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "#9CA3AF" }}>
          <span>👥 {participants}</span>
          <span>⏰ {deadline}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#4F46E5", background: "#EEF2FF", padding: "2px 10px", borderRadius: 20 }}>{category}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Coming Soon ─── */
function ComingSoon({ category }) {
  const configs = {
    boxing: { icon: "🥊", title: "ボクシング", desc: "世界タイトル戦の勝敗予想", bg: "linear-gradient(135deg, #DC2626, #991B1B)", items: ["井上尚弥 次戦予想", "PFP ランキング予想", "階級別チャンピオン予想"] },
    mahjong: { icon: "🀄", title: "麻雀", desc: "Mリーグヷタイトル戦の予想", bg: "linear-gradient(135deg, #7C3AED, #5B21B6)", items: ["Mリーグ優勝予想", "最高位戦 予想", "最強位決定戦 予想"] },
  };
  const c = configs[category] || { icon: "🎯", title: category, desc: "", bg: "#6B7280", items: [] };
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ height: 140, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <span style={{ fontSize: 60, opacity: 0.3 }}>{c.icon}</span>
        <div style={{ position: "absolute", bottom: 16, left: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{c.title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{c.desc}</div>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textAlign: "center", marginBottom: 16 }}>🚧 準備中</div>
        {c.items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: i < c.items.length - 1 ? "1px solid #F3F4F6" : "none" }}>
            <span style={{ fontSize: 20, opacity: 0.4 }}>{c.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#D1D5DB" }}>{item}</div>
              <div style={{ fontSize: 11, color: "#E5E7EB", marginTop: 2 }}>近日公開</div>
            </div>
            <span style={{ fontSize: 11, color: "#E5E7EB", background: "#F9FAFB", padding: "4px 12px", borderRadius: 20 }}>SOON</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── MatchCard ─── */
function MatchCard({ match, bets, pick, onPick, onBet }) {
  const [showBets, setShowBets] = useState(false);
  const isPast = match.match_date ? new Date() > new Date(match.match_date) : false;
  const isLocked = isPast || match.result != null;
  const matchBets = bets.filter(b => b.match_id === match.id);
  const totals = { home_win: 0, draw: 0, away_win: 0 };
  matchBets.forEach(b => { if (totals[b.team_side] !== undefined) totals[b.team_side] += b.amount; });
  const totalAmt = Object.values(totals).reduce((s, v) => s + v, 0);
  const pcts = {};
  ["home_win", "draw", "away_win"].forEach(k => { pcts[k] = totalAmt > 0 ? Math.round(totals[k] / totalAmt * 100) : 0; });
  const matchOdds = {};
  ["home_win", "draw", "away_win"].forEach(k => { matchOdds[k] = totals[k] > 0 ? (totalAmt / totals[k]).toFixed(2) : "-"; });

  // Per-person breakdown with payout
  const betsByPerson = {};
  matchBets.forEach(b => {
    const key = `${b.user_name}__${b.team_side}`;
    if (!betsByPerson[key]) betsByPerson[key] = { name: b.user_name, side: b.team_side, amount: 0 };
    betsByPerson[key].amount += b.amount;
  });
  const betList = Object.values(betsByPerson).map(b => {
    const payout = totals[b.side] > 0 ? Math.round(b.amount * (totalAmt / totals[b.side])) : 0;
    return { ...b, payout, profit: payout - b.amount };
  }).sort((a, b) => b.amount - a.amount);

  const isSelected = (side) => pick?.matchId === match.id && pick?.side === side;
  const thisMatchSelected = pick?.matchId === match.id;
  const dateStr = match.match_date
    ? new Date(match.match_date).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" })
    : "日程TBD";
  const sides = ["home_win", ...(match.has_draw ? ["draw"] : []), "away_win"];
  const sideLabel = (side) => {
    if (side === "draw") return "引き分け";
    const n = side === "home_win" ? match.home_team : match.away_team;
    return n.length > 5 ? (side === "home_win" ? "ホーム勝" : "アウェイ勝") : `${n}勝`;
  };
  const sideName = (side) => side === "draw" ? "引分" : side === "home_win" ? match.home_team : match.away_team;
  const betLabel = (side) => side === "draw" ? "引き分け" : side === "home_win" ? `${match.home_team}勝ち` : `${match.away_team}勝ち`;
  const sideColors = { home_win: { bg: "#EFF6FF", color: "#2563EB" }, draw: { bg: "#FEF9C3", color: "#92400E" }, away_win: { bg: "#FFF7ED", color: "#EA580C" } };

  return (
    <div className="card" style={{ marginBottom: 10, border: thisMatchSelected ? "2px solid #4F46E5" : "1px solid #F3F4F6", transition: "border 0.15s" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#16A34A", background: "#F0FDF4", padding: "2px 8px", borderRadius: 10 }}>
          {STAGE_LABELS[match.stage] || match.stage}{match.group_name ? ` G${match.group_name}` : ""}
        </span>
        <span style={{ fontSize: 10, color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>{dateStr}</span>
      </div>
      {/* Teams */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 26 }}>{getFlag(match.home_team)}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1F2937", marginTop: 4, lineHeight: 1.3 }}>{match.home_team}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#D1D5DB", flexShrink: 0 }}>VS</div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 26 }}>{getFlag(match.away_team)}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1F2937", marginTop: 4, lineHeight: 1.3 }}>{match.away_team}</div>
        </div>
      </div>
      {/* Pick buttons */}
      {!isLocked && (
        <div style={{ display: "flex", gap: 6 }}>
          {sides.map(side => (
            <button key={side} onClick={() => onPick(match.id, side)} style={{
              flex: 1, padding: "10px 4px", borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: "pointer",
              border: `2px solid ${isSelected(side) ? "#4F46E5" : "#E5E7EB"}`,
              background: isSelected(side) ? "#EEF2FF" : "#F9FAFB",
              color: isSelected(side) ? "#4F46E5" : "#6B7280", transition: "all 0.15s",
            }}>
              {sideLabel(side)}
              {pcts[side] > 0 && <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 2 }}>{pcts[side]}%</div>}
              {matchOdds[side] !== "-" && <div style={{ fontSize: 9, color: "#4F46E5", marginTop: 1 }}>×{matchOdds[side]}</div>}
            </button>
          ))}
        </div>
      )}
      {isLocked && (
        <div style={{ textAlign: "center", fontSize: 11, color: "#9CA3AF", padding: "6px 0", background: "#F9FAFB", borderRadius: 8 }}>
          {match.result ? "✅ 結果確定済み" : "🔒 受付終了"}
        </div>
      )}

      {/* Bet summary toggle */}
      {matchBets.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setShowBets(!showBets)} style={{
            width: "100%", padding: "8px 12px", borderRadius: 10, background: "#F9FAFB",
            border: "1px solid #F3F4F6", cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "space-between", fontFamily: "inherit",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>👥 {matchBets.length}ベット</span>
              <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>⚽{totalAmt.toLocaleString()}</span>
              {sides.map(side => pcts[side] > 0 ? (
                <span key={side} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 700, background: sideColors[side].bg, color: sideColors[side].color }}>
                  {sideName(side)} {pcts[side]}%
                </span>
              ) : null)}
            </div>
            <span style={{ fontSize: 10, color: "#D1D5DB", display: "inline-block", transform: showBets ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
          </button>

          {showBets && (
            <div style={{ marginTop: 6, borderRadius: 10, border: "1px solid #F3F4F6", overflow: "hidden" }}>
              {/* Table header */}
              <div style={{ display: "flex", padding: "7px 12px", background: "#F9FAFB", borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ flex: 1, fontSize: 9, color: "#9CA3AF", fontWeight: 700 }}>名前</div>
                <div style={{ width: 64, fontSize: 9, color: "#9CA3AF", fontWeight: 700, textAlign: "center" }}>予想</div>
                <div style={{ width: 56, fontSize: 9, color: "#9CA3AF", fontWeight: 700, textAlign: "right" }}>ベット</div>
                <div style={{ width: 68, fontSize: 9, color: "#9CA3AF", fontWeight: 700, textAlign: "right" }}>的中時払戻</div>
              </div>
              {/* Bet rows */}
              {betList.map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "9px 12px", borderBottom: i < betList.length - 1 ? "1px solid #F9FAFB" : "none", background: "#fff" }}>
                  <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                  <div style={{ width: 64, textAlign: "center" }}>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, fontWeight: 700, background: sideColors[b.side]?.bg || "#F3F4F6", color: sideColors[b.side]?.color || "#6B7280" }}>
                      {sideName(b.side)}
                    </span>
                  </div>
                  <div style={{ width: 56, fontSize: 11, fontWeight: 700, color: "#4F46E5", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>
                    ⚽{b.amount.toLocaleString()}
                  </div>
                  <div style={{ width: 68, textAlign: "right" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#16A34A", fontFamily: "'DM Mono', monospace" }}>⚽{b.payout.toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: b.profit >= 0 ? "#16A34A" : "#DC2626", fontFamily: "'DM Mono', monospace" }}>{b.profit >= 0 ? "+" : ""}{b.profit.toLocaleString()}</div>
                  </div>
                </div>
              ))}
              {/* Odds footer */}
              <div style={{ display: "flex", gap: 6, padding: "8px 12px", background: "#F9FAFB", borderTop: "1px solid #F3F4F6" }}>
                {sides.map(side => totals[side] > 0 ? (
                  <div key={side} style={{ flex: 1, textAlign: "center", padding: "6px 4px", borderRadius: 8, background: "#fff", border: "1px solid #F3F4F6" }}>
                    <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 2 }}>{sideName(side)}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#4F46E5", fontFamily: "'DM Mono', monospace" }}>×{matchOdds[side]}</div>
                    <div style={{ fontSize: 9, color: "#6B7280", fontFamily: "'DM Mono', monospace" }}>⚽{totals[side].toLocaleString()}</div>
                  </div>
                ) : null)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* BetForm */}
      {thisMatchSelected && !isLocked && (
        <div style={{ marginTop: 12 }}>
          <BetForm label={`⚽ 「${betLabel(pick.side)}」にベット`} onSubmit={onBet} disabled={false} sportEmoji="⚽" />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ MAIN APP ═══════════════════════ */
export default function App() {
  const [rawBets, setRawBets] = useState([]);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [matches, setMatches] = useState([]);
  const [matchPick, setMatchPick] = useState(null);

  const loadData = useCallback(async (retry = 0) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const { data, error } = await supabase.from("bets").select("*").abortSignal(controller.signal);
      clearTimeout(timeout);
      if (!error && data) {
        setRawBets(data.filter(b => b.match_id !== "winner"));
      }
    } catch (e) {
      if (retry < 2) { await new Promise(r => setTimeout(r, 1500)); return loadData(retry + 1); }
    }
    setLoading(false);
  }, []);

  const loadMatches = useCallback(async () => {
    const { data } = await supabase.from("matches").select("*").eq("is_featured", true).order("match_date");
    if (data) setMatches(data);
  }, []);

  useEffect(() => { loadData(); loadMatches(); }, [loadData, loadMatches]);

  useEffect(() => {
    const ch = supabase.channel("bets-realtime").on("postgres_changes", { event: "INSERT", schema: "public", table: "bets" }, () => { loadData(); }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const handleMatchPick = (matchId, side) => {
    if (matchPick?.matchId === matchId && matchPick?.side === side) setMatchPick(null);
    else setMatchPick({ matchId, side });
  };

  const handleMatchBet = async (name, amount) => {
    if (!matchPick) return;
    const { error } = await supabase.from("bets").insert({ match_id: matchPick.matchId, team_side: matchPick.side, user_name: name, amount });
    if (!error) { setMatchPick(null); showToast("ベット完了！⚽"); loadData(); }
  };

  const stageOrder = ["group", "r32", "qf", "sf", "final"];
  const groupedMatches = {};
  matches.forEach(m => { if (!groupedMatches[m.stage]) groupedMatches[m.stage] = []; groupedMatches[m.stage].push(m); });

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>⚽</div><div style={{ fontSize: 14, color: "#9CA3AF", fontWeight: 600 }}>Loading...</div></div>
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
        .close-btn { background: #F3F4F6; border: none; color: #9CA3AF; font-size: 16px; width: 34px; height: 34px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* ─── Header ─── */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚽</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#1F2937" }}>BillPre</span>
          </div>
          <div style={{ padding: "4px 12px", borderRadius: 20, background: "#FEF2F2", fontSize: 10, color: "#DC2626", fontWeight: 700 }}>⚠ シミュレーション</div>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div style={{ padding: "14px 12px 40px", animation: "fadeIn 0.2s ease" }}>
        <div className="card" style={{ background: "linear-gradient(135deg, #14532D, #16A34A)", padding: "20px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: 4 }}>試合予想シミュレーション</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>⚽ FIFA W杯 2026</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 6 }}>試合ごとに勝敗を予想してベット！<br />グループ戦は引き分けあり・決勝Tはなし</div>
          <div style={{ marginTop: 12, display: "flex", gap: 14, fontSize: 11, color: "rgba(255,255,255,0.8)" }}>
            <span>👥 {rawBets.length}ベット</span>
            <span>📅 6/15 開幕</span>
          </div>
        </div>
        {matches.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>読み込み中...</div>}
        {stageOrder.map(stage => {
          const sm = groupedMatches[stage];
          if (!sm || sm.length === 0) return null;
          const icons = { group: "🏟️", r32: "⚡", qf: "🔥", sf: "💥", final: "🏆" };
          return (
            <div key={stage} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#6B7280", marginBottom: 10, padding: "0 2px" }}>
                {icons[stage]} {STAGE_LABELS[stage]}
              </div>
              {sm.map(match => (
                <MatchCard key={match.id} match={match} bets={rawBets} pick={matchPick} onPick={handleMatchPick} onBet={handleMatchBet} />
              ))}
            </div>
          );
        })}
      </div>

      {/* ─── Footer ─── */}
      <div style={{ padding: "20px 16px 40px", textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#D1D5DB", lineHeight: 1.8 }}>
          BillPre — スポーツ予想シミュレーション<br />実際の金銭のやり取りは一切ありません
        </div>
      </div>

      <SuccessToast message={toast} />
      {showHistory && <HistoryModal bets={rawBets} onClose={() => setShowHistory(false)} />}
    </div>
  );
}
