import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

const STATUS_LABELS = {
  new: "未対応",
  drafted: "下書き済",
  approved: "承認済",
  sent: "送信済",
  closed: "クローズ",
};

export default function InquiriesList({ tenantId }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { inquiries } = await api.listInquiries(tenantId);
      setInquiries(inquiries);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId]);

  async function sync() {
    setSyncing(true);
    setMsg("");
    try {
      const r = await api.syncInquiries(tenantId);
      setMsg(`R-Messe から ${r.fetched} 件取得（新規 ${r.inserted} 件）`);
      await load();
    } catch (e) {
      setMsg(`同期失敗: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section>
      <div className="page-header">
        <h2>問い合わせ一覧</h2>
        <button onClick={sync} disabled={syncing}>
          {syncing ? "同期中…" : "R-Messeから取り込み"}
        </button>
      </div>
      {msg && <p className="notice">{msg}</p>}
      {loading ? (
        <p>読み込み中…</p>
      ) : inquiries.length === 0 ? (
        <p className="muted">まだ問い合わせがありません。「R-Messeから取り込み」を押してください。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>受信</th>
              <th>差出人</th>
              <th>件名 / 本文</th>
              <th>商品 / 注文</th>
              <th>状態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {inquiries.map((q) => (
              <tr key={q.id}>
                <td className="nowrap">{formatDate(q.received_at)}</td>
                <td>{q.customer_name || q.customer_email || "—"}</td>
                <td className="text-cell">
                  <strong>{q.subject || "(件名なし)"}</strong>
                  <p className="snippet">{(q.body || "").slice(0, 80)}{(q.body || "").length > 80 ? "…" : ""}</p>
                </td>
                <td className="nowrap small">
                  {q.related_item_code && <div>商品: {q.related_item_code}</div>}
                  {q.related_order_number && <div>注文: {q.related_order_number}</div>}
                </td>
                <td><span className={`badge badge-${q.status}`}>{STATUS_LABELS[q.status] || q.status}</span></td>
                <td><Link to={`/inquiries/${q.id}`}>開く</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function formatDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
