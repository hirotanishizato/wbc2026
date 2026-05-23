/**
 * Core draft-generation pipeline.
 *
 *   inquiry → fetch order (if applicable)
 *           → fetch item (if applicable)
 *           → rank matching templates
 *           → rank matching manuals (boosted by item)
 *           → evaluate delivery rules against the order
 *           → build prompt and call Gemini
 *           → persist as rms_drafts row
 */
import { db } from "../db.js";
import * as rakuten from "../clients/rakuten.js";
import * as gemini from "../clients/gemini.js";
import { rankTemplates, rankManuals } from "./matcher.js";
import { evaluateDeliveryRules } from "./deliveryRules.js";
import { loadTenantWithCreds } from "./tenants.js";

const SYSTEM_INSTRUCTION = `あなたは楽天市場に出店している店舗の、顧客対応担当アシスタントです。
R-Messe 経由で届いたお客様からの問い合わせに対する、丁寧で正確な日本語の返信文の下書きを作成します。

守るべきこと:
- 楽天市場の店舗から顧客への返信として自然な、敬語・丁寧語を用いる
- 確実でない情報を断定しない。情報が不足している場合は「確認のうえ改めてご連絡いたします」と書く
- 提供された「テンプレート」に類似する内容の問い合わせの場合は、テンプレートの文言を尊重する
- 「商品情報」や「マニュアル」で裏が取れていない仕様は書かない
- 「納期情報」が提供された場合は、その日付・条件を正確に反映する
- 「注文情報」が提供された場合は、注文番号・商品名を返信文に含めて顧客が照合しやすくする
- 返信文の末尾には店舗の署名を含めない（システム側で付与する）
- 返信文のみを出力。前置きや解説、Markdown 装飾は不要`;

function buildPrompt({
  inquiry,
  order,
  item,
  templates,
  manuals,
  computedDelivery,
}) {
  const sections = [];

  sections.push("【お客様からの問い合わせ】");
  sections.push(`差出人: ${inquiry.customer_name || "(不明)"}`);
  if (inquiry.subject) sections.push(`件名: ${inquiry.subject}`);
  sections.push(`本文:\n${inquiry.body}`);

  if (order) {
    sections.push("\n【該当する注文情報】");
    sections.push(`注文番号: ${order.orderNumber}`);
    sections.push(`注文日時: ${order.orderedAt}`);
    sections.push(`支払状況: ${order.paymentStatus}`);
    sections.push(`発送状況: ${order.shipStatus}`);
    sections.push("注文商品:");
    for (const it of order.items || []) {
      sections.push(`  - ${it.itemName} (商品コード:${it.itemCode}) × ${it.quantity}`);
      if (it.shopComment) sections.push(`    ショップコメント: ${it.shopComment}`);
      if (it.scheduledShipDate) sections.push(`    発送予定日: ${it.scheduledShipDate}`);
    }
  }

  if (item) {
    sections.push("\n【商品情報（公式商品ページ由来）】");
    sections.push(`商品名: ${item.itemName}`);
    sections.push(`商品コード: ${item.itemCode}`);
    if (item.price != null) sections.push(`価格: ${item.price}円`);
    if (item.sizes?.length) sections.push(`サイズ展開: ${item.sizes.join(", ")}`);
    if (item.colors?.length) sections.push(`カラー展開: ${item.colors.join(", ")}`);
    if (item.description) sections.push(`説明:\n${item.description}`);
  }

  if (manuals?.length) {
    sections.push("\n【参照すべき店舗マニュアル抜粋】");
    for (const m of manuals) {
      sections.push(`- ${m.title}\n  ${m.content}`);
    }
  }

  if (computedDelivery) {
    sections.push("\n【納期ルール計算結果】");
    sections.push(computedDelivery.message);
  }

  if (templates?.length) {
    sections.push("\n【類似事例の社内テンプレート（優先的に文体・内容を流用してください）】");
    for (const t of templates) {
      sections.push(`- ${t.title}\n${t.body}`);
    }
  }

  sections.push("\n以上の情報を踏まえて、お客様への返信文（本文のみ）を作成してください。");
  return sections.join("\n");
}

export async function generateDraftForInquiry(tenantId, inquiryId) {
  const tenant = await loadTenantWithCreds(tenantId);
  if (!tenant) throw new Error("tenant not found");

  const { data: inquiry, error: inqErr } = await db
    .from("rms_inquiries")
    .select("*")
    .eq("id", inquiryId)
    .eq("tenant_id", tenantId)
    .single();
  if (inqErr || !inquiry) throw new Error("inquiry not found");

  // ---- gather context ---------------------------------------------------
  let order = null;
  if (inquiry.related_order_number) {
    order = await rakuten.getOrder(tenant, inquiry.related_order_number);
  } else if (inquiry.customer_member_id) {
    const orders = await rakuten.searchOrdersByMember(tenant, inquiry.customer_member_id);
    order = Array.isArray(orders) && orders.length ? orders[0] : null;
  }

  const itemCode = inquiry.related_item_code || order?.items?.[0]?.itemCode || null;
  const item = itemCode ? await rakuten.getItem(tenant, itemCode) : null;

  const { data: templatesAll } = await db
    .from("rms_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("enabled", true);
  const templates = rankTemplates(templatesAll || [], inquiry.body, { limit: 3 });

  const { data: manualsAll } = await db
    .from("rms_manuals")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("enabled", true);
  const manuals = rankManuals(manualsAll || [], inquiry.body, { itemCode, limit: 5 });

  const { data: rulesAll } = await db
    .from("rms_delivery_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("enabled", true);
  const computedDelivery = evaluateDeliveryRules(rulesAll || [], order);

  // ---- prompt + LLM -----------------------------------------------------
  const prompt = buildPrompt({ inquiry, order, item, templates, manuals, computedDelivery });

  const { text, model } = await gemini.generateText({
    apiKey: tenant._creds?.geminiApiKey,
    prompt,
    system: SYSTEM_INSTRUCTION,
  });

  const body = tenant.signature_block
    ? `${text.trim()}\n\n${tenant.signature_block}`
    : text.trim();

  // ---- persist ----------------------------------------------------------
  const { data: draft, error: draftErr } = await db
    .from("rms_drafts")
    .insert({
      tenant_id: tenantId,
      inquiry_id: inquiryId,
      body,
      model,
      used_template_ids: templates.map((t) => t.id),
      used_manual_ids: manuals.map((m) => m.id),
      used_delivery_rule_ids: computedDelivery ? [computedDelivery.ruleId] : [],
      used_order_number: order?.orderNumber || null,
      used_item_code: itemCode,
      generation_meta: {
        templateCount: templates.length,
        manualCount: manuals.length,
        deliveryComputed: !!computedDelivery,
      },
    })
    .select()
    .single();
  if (draftErr) throw draftErr;

  await db
    .from("rms_inquiries")
    .update({ status: "drafted", updated_at: new Date().toISOString() })
    .eq("id", inquiryId);

  return { draft, prompt, order, item, templates, manuals, computedDelivery };
}
