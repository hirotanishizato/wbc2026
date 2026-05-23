/**
 * Seeds a demo tenant + sample templates / manuals / delivery rules.
 * Useful for getting the UI populated without a real Rakuten contract.
 *
 * Usage:  node scripts/seedMock.js <OWNER_USER_ID>
 *   OWNER_USER_ID = a Supabase auth.users.id (sign up via the UI first)
 */
import { db } from "../server/db.js";

const ownerUserId = process.argv[2];
if (!ownerUserId) {
  console.error("Usage: node scripts/seedMock.js <OWNER_USER_ID>");
  process.exit(1);
}

const { data: tenant, error: tenantErr } = await db
  .from("rms_tenants")
  .insert({
    name: "デモショップ",
    owner_email: "demo@example.com",
    rakuten_shop_url: "https://www.rakuten.co.jp/demo-shop/",
    signature_block: "デモショップ カスタマーサポート\nhttps://www.rakuten.co.jp/demo-shop/",
  })
  .select()
  .single();
if (tenantErr) throw tenantErr;
console.log("Created tenant:", tenant.id);

await db.from("rms_tenant_users").insert({
  tenant_id: tenant.id,
  user_id: ownerUserId,
  role: "owner",
});

await db.from("rms_templates").insert([
  {
    tenant_id: tenant.id,
    title: "発送日に関する返信",
    category: "発送",
    trigger_keywords: ["発送", "いつ届", "配送", "到着"],
    body:
      "この度はご注文ありがとうございます。\nご注文いただきました商品は、{{ship_date}} に発送予定でございます。\n発送完了後、追跡番号をメールにてお送りいたします。",
  },
  {
    tenant_id: tenant.id,
    title: "領収書発行のご案内",
    category: "領収書",
    trigger_keywords: ["領収書", "領収証", "請求書"],
    body:
      "領収書発行のご依頼ありがとうございます。\nご指定の宛名「{{billing_name}}」にて発行し、PDFにてメール添付させていただきます。\nお時間を1〜2営業日いただく場合がございます。",
  },
  {
    tenant_id: tenant.id,
    title: "サイズ交換のご案内",
    category: "返品交換",
    trigger_keywords: ["サイズ", "交換", "返品", "大きい", "小さい"],
    body:
      "サイズ違いの交換をご希望とのこと、承知いたしました。\n未使用・タグ付きであれば、商品到着後7日以内のご連絡で交換対応可能でございます。\n返送用の伝票をお送りしますので、ご希望サイズと配送先をお知らせください。",
  },
]);

await db.from("rms_manuals").insert([
  {
    tenant_id: tenant.id,
    title: "オーガニックコットンTシャツ 補足情報",
    category: "商品仕様",
    item_code: "shop:item-aaa-123",
    trigger_keywords: ["洗濯", "縮み", "サイズ感"],
    content:
      "本商品は天然繊維のため、初回洗濯で1〜2%程度の縮みが発生する場合があります。" +
      "ジャストサイズをご希望の場合は、通常よりワンサイズ上をおすすめしております。" +
      "乾燥機の使用は避け、平干しをお願いいたします。",
  },
  {
    tenant_id: tenant.id,
    title: "防水Bluetoothスピーカー 屋外使用について",
    category: "商品仕様",
    item_code: "shop:item-bbb-456",
    trigger_keywords: ["屋外", "雨", "防水", "プール"],
    content:
      "IPX5は「あらゆる方向からの噴流水による有害な影響がない」レベルです。" +
      "シャワー・小雨・水しぶき程度なら問題ありませんが、" +
      "プールや海水への水没は故障の原因となるためお控えください。",
  },
]);

await db.from("rms_delivery_rules").insert([
  {
    tenant_id: tenant.id,
    name: "通常便（14時までのご注文は翌営業日発送）",
    description: "在庫がある通常商品の発送ルール",
    priority: 10,
    rule: {
      order_before: "14:00",
      ship_within_business_days: 1,
      exclude_weekends: true,
    },
  },
  {
    tenant_id: tenant.id,
    name: "コーヒー豆（焙煎後5営業日以内に発送）",
    description: "豆系商品は焙煎工程を挟むため通常より時間がかかります",
    priority: 20,
    rule: {
      ship_within_business_days: 5,
      exclude_weekends: true,
      item_codes: ["shop:item-ccc-789"],
    },
  },
]);

console.log("Seed completed for tenant:", tenant.id);
console.log("Use this tenant_id in the UI's tenant switcher (X-Tenant-Id header).");
