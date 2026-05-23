import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";

export default function InquiryDetail({ tenantId }) {
  const { id } = useParams();
  const [inquiry, setInquiry] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draftBody, setDraftBody] = useState("");
  const [meta, setMeta] = useState(null);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await api.getInquiry(tenantId, id);
      setInquiry(r.inquiry);
      setDrafts(r.drafts);
      if (r.drafts[0]) setDraftBody(r.drafts[0].body);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tenantId && id) load();
  }, [tenantId, id]);

  async function generate() {
    setBusy(true);
    setMsg("");
    try {
      const r = await api.generateDraft(tenantId, id);
      setMeta(r.meta);
      setMsg("AI下書きを生成しました");
      await load();
    } catch (e) {
      setMsg(`生成失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!drafts[0]) return;
    setBusy(true);
    try {
      await api.updateDraft(tenantId, drafts[0].id, { body: draftBody });
      setMsg("下書きを保存しました");
      await load();
    } catch (e) {
      setMsg(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!drafts[0]) return;
    setBusy(true);
    try {
      await api.updateDraft(tenantId, drafts[0].id, { body: draftBody, status: "approved" });
      setMsg("承認しました。R-Messeへの送信は手動で行ってください。");
      await load();
    } catch (e) {
      setMsg(`承認失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(draftBody);
      setMsg("クリップボードにコピーしました");
    } catch (e) {
      setMsg(`コピー失敗: ${e.message}`);
    }
  }

  if (loading) return <p>読み込み中…</p>;
  if (!inquiry) return <p>問い合わせが見つかりません。<Link to="/">一覧へ</Link></p>;

  return (
    <section>
      <div className="page-header">
        <h2><Link to="/" className="back">← 一覧</Link> {inquiry.subject || "(件名なし)"}</h2>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>お客様の問い合わせ</h3>
          <dl className="kv">
            <dt>差出人</dt><dd>{inquiry.customer_name || "—"} ({inquiry.customer_email || "—"})</dd>
            <dt>会員ID</dt><dd>{inquiry.customer_member_id || "—"}</dd>
            <dt>関連商品</dt><dd>{inquiry.related_item_code || "—"}</dd>
            <dt>関連注文</dt><dd>{inquiry.related_order_number || "—"}</dd>
            <dt>受信日時</dt><dd>{inquiry.received_at}</dd>
          </dl>
          <h4>本文</h4>
          <pre className="body-text">{inquiry.body}</pre>
        </div>

        <div className="card">
          <h3>AI返信下書き</h3>
          {drafts.length === 0 ? (
            <p className="muted">まだ下書きが生成されていません。下のボタンで生成してください。</p>
          ) : (
            <>
              <textarea
                className="draft-editor"
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={18}
              />
              {meta && (
                <div className="meta-box">
                  {meta.usedOrder && <span>注文 {meta.usedOrder} を参照</span>}
                  {meta.usedItem && <span>商品 {meta.usedItem} を参照</span>}
                  <span>テンプレ {meta.templateCount} 件 / マニュアル {meta.manualCount} 件</span>
                  {meta.deliveryMessage && <span title={meta.deliveryMessage}>納期ルール適用</span>}
                </div>
              )}
            </>
          )}
          <div className="actions">
            <button onClick={generate} disabled={busy}>
              {drafts.length === 0 ? "AIで下書き生成" : "AIで再生成"}
            </button>
            {drafts.length > 0 && (
              <>
                <button onClick={save} disabled={busy}>編集を保存</button>
                <button onClick={approve} disabled={busy} className="primary">承認</button>
                <button onClick={copyToClipboard} disabled={busy}>コピー</button>
              </>
            )}
          </div>
          {msg && <p className="notice">{msg}</p>}
        </div>
      </div>
    </section>
  );
}
