import { useEffect, useState } from "react";
import { api } from "../api.js";

const EMPTY = {
  name: "",
  description: "",
  orderBefore: "14:00",
  shipWithinBusinessDays: 1,
  excludeWeekends: true,
  itemCodes: "",
  priority: 0,
  enabled: true,
};

export default function DeliveryRules({ tenantId }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  async function load() {
    const { rules } = await api.listDeliveryRules(tenantId);
    setItems(rules);
  }
  useEffect(() => { if (tenantId) load(); }, [tenantId]);

  function startNew() { setEditing("new"); setForm(EMPTY); }
  function startEdit(r) {
    setEditing(r.id);
    setForm({
      name: r.name,
      description: r.description || "",
      orderBefore: r.rule?.order_before || "",
      shipWithinBusinessDays: r.rule?.ship_within_business_days ?? 1,
      excludeWeekends: r.rule?.exclude_weekends !== false,
      itemCodes: (r.rule?.item_codes || []).join(", "),
      priority: r.priority,
      enabled: r.enabled,
    });
  }
  async function save() {
    const itemCodes = form.itemCodes.split(",").map((s) => s.trim()).filter(Boolean);
    const payload = {
      name: form.name,
      description: form.description || null,
      priority: Number(form.priority) || 0,
      enabled: form.enabled,
      rule: {
        order_before: form.orderBefore || null,
        ship_within_business_days: Number(form.shipWithinBusinessDays) || 0,
        exclude_weekends: form.excludeWeekends,
        item_codes: itemCodes,
      },
    };
    if (editing === "new") await api.createDeliveryRule(tenantId, payload);
    else await api.updateDeliveryRule(tenantId, editing, payload);
    setEditing(null);
    await load();
  }
  async function remove(id) {
    if (!confirm("削除しますか？")) return;
    await api.deleteDeliveryRule(tenantId, id);
    await load();
  }

  return (
    <section>
      <div className="page-header">
        <h2>納期ルール</h2>
        <button onClick={startNew}>新規作成</button>
      </div>
      <p className="muted">「14時までの注文は翌営業日発送」などのルールを登録すると、注文情報と突き合わせて返信に反映されます。優先度が高いルールから順に評価されます。</p>

      {editing && (
        <div className="card edit-form">
          <h3>{editing === "new" ? "新規ルール" : "編集"}</h3>
          <label>ルール名<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>説明<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className="row-fields">
            <label>受注締切時刻 (HH:MM)<input value={form.orderBefore} onChange={(e) => setForm({ ...form, orderBefore: e.target.value })} placeholder="14:00" /></label>
            <label>発送までの営業日数<input type="number" min="0" value={form.shipWithinBusinessDays} onChange={(e) => setForm({ ...form, shipWithinBusinessDays: e.target.value })} /></label>
            <label>優先度<input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></label>
          </div>
          <label className="row"><input type="checkbox" checked={form.excludeWeekends} onChange={(e) => setForm({ ...form, excludeWeekends: e.target.checked })} /> 土日を除外</label>
          <label>対象商品コード（カンマ区切り、空欄なら全商品）<input value={form.itemCodes} onChange={(e) => setForm({ ...form, itemCodes: e.target.value })} placeholder="shop:item-aaa-123, shop:item-bbb-456" /></label>
          <label className="row"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> 有効</label>
          <div className="actions">
            <button onClick={save} className="primary">保存</button>
            <button onClick={() => setEditing(null)}>キャンセル</button>
          </div>
        </div>
      )}

      <ul className="entry-list">
        {items.map((r) => (
          <li key={r.id} className="entry">
            <div className="entry-head">
              <h4>{r.name}{!r.enabled && <span className="badge">無効</span>} <span className="small muted">優先度 {r.priority}</span></h4>
              <div className="actions">
                <button onClick={() => startEdit(r)}>編集</button>
                <button onClick={() => remove(r.id)} className="danger">削除</button>
              </div>
            </div>
            {r.description && <p className="small">{r.description}</p>}
            <pre className="body-text small">{JSON.stringify(r.rule, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}
