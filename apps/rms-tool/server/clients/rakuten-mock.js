/**
 * In-memory mock of the Rakuten RMS API.
 *
 * Used when USE_MOCK_RAKUTEN=true. The fixtures simulate the kinds of
 * data the real R-Messe / order / item endpoints would return so the
 * rest of the system can be developed and demoed without a live RMS
 * service contract.
 */

const NOW = Date.now();
const HOUR = 3_600_000;

const MOCK_INQUIRIES = [
  {
    messageId: "rmesse-0001",
    threadId: "thread-0001",
    customerName: "山田 太郎",
    customerEmail: "taro.yamada@example.com",
    customerMemberId: "rk_member_001",
    relatedItemCode: "shop:item-aaa-123",
    relatedOrderNumber: "240001-20260520-0001",
    subject: "注文した商品の発送日について",
    body: "先日注文した商品ですが、いつ発送になりますでしょうか？週末までに到着しないと困るのですが、間に合いますか？",
    receivedAt: new Date(NOW - 2 * HOUR).toISOString(),
  },
  {
    messageId: "rmesse-0002",
    threadId: "thread-0002",
    customerName: "佐藤 花子",
    customerEmail: "hanako.sato@example.com",
    customerMemberId: null,
    relatedItemCode: "shop:item-bbb-456",
    relatedOrderNumber: null,
    subject: "商品の使い方について",
    body: "購入を検討しています。こちらの商品は屋外でも使えますか？防水機能はどの程度ありますか？",
    receivedAt: new Date(NOW - 5 * HOUR).toISOString(),
  },
  {
    messageId: "rmesse-0003",
    threadId: "thread-0003",
    customerName: "鈴木 一郎",
    customerEmail: "ichiro.suzuki@example.com",
    customerMemberId: "rk_member_003",
    relatedItemCode: null,
    relatedOrderNumber: "240001-20260518-0042",
    subject: "領収書の発行をお願いします",
    body: "先日の注文の領収書を発行していただきたいです。宛名は「株式会社サンプル」でお願いします。",
    receivedAt: new Date(NOW - 18 * HOUR).toISOString(),
  },
  {
    messageId: "rmesse-0004",
    threadId: "thread-0004",
    customerName: "田中 美咲",
    customerEmail: "misaki.tanaka@example.com",
    customerMemberId: "rk_member_004",
    relatedItemCode: "shop:item-aaa-123",
    relatedOrderNumber: "240001-20260521-0099",
    subject: "サイズ違いの交換はできますか",
    body: "昨日届いたのですが、サイズが思ったより小さかったです。Lサイズへの交換はできますでしょうか。",
    receivedAt: new Date(NOW - 26 * HOUR).toISOString(),
  },
];

const MOCK_ORDERS = {
  "240001-20260520-0001": {
    orderNumber: "240001-20260520-0001",
    orderedAt: new Date(NOW - 26 * HOUR).toISOString(),
    customerMemberId: "rk_member_001",
    customerName: "山田 太郎",
    items: [
      {
        itemCode: "shop:item-aaa-123",
        itemName: "オーガニックコットンTシャツ Mサイズ",
        quantity: 1,
        price: 3980,
        shopComment: "在庫あり・通常配送",
        scheduledShipDate: null,
      },
    ],
    paymentStatus: "paid",
    shipStatus: "preparing",
  },
  "240001-20260518-0042": {
    orderNumber: "240001-20260518-0042",
    orderedAt: new Date(NOW - 4 * 24 * HOUR).toISOString(),
    customerMemberId: "rk_member_003",
    customerName: "鈴木 一郎",
    items: [
      {
        itemCode: "shop:item-ccc-789",
        itemName: "プレミアム焙煎コーヒー豆 200g",
        quantity: 2,
        price: 1480,
        shopComment: "ご注文後5営業日以内に発送",
        scheduledShipDate: new Date(NOW + 2 * 24 * HOUR).toISOString(),
      },
    ],
    paymentStatus: "paid",
    shipStatus: "shipped",
  },
  "240001-20260521-0099": {
    orderNumber: "240001-20260521-0099",
    orderedAt: new Date(NOW - 2 * 24 * HOUR).toISOString(),
    customerMemberId: "rk_member_004",
    customerName: "田中 美咲",
    items: [
      {
        itemCode: "shop:item-aaa-123",
        itemName: "オーガニックコットンTシャツ Mサイズ",
        quantity: 1,
        price: 3980,
        shopComment: null,
        scheduledShipDate: null,
      },
    ],
    paymentStatus: "paid",
    shipStatus: "delivered",
  },
};

const MOCK_ITEMS = {
  "shop:item-aaa-123": {
    itemCode: "shop:item-aaa-123",
    itemName: "オーガニックコットンTシャツ",
    itemUrl: "https://item.rakuten.co.jp/shop/item-aaa-123/",
    price: 3980,
    description:
      "100%オーガニックコットン使用。S/M/L/XL の4サイズ展開。カラーは白・黒・ネイビーの3色。" +
      "洗濯機洗い可能（弱水流・ネット使用推奨）。日本国内縫製。",
    sizes: ["S", "M", "L", "XL"],
    colors: ["白", "黒", "ネイビー"],
  },
  "shop:item-bbb-456": {
    itemCode: "shop:item-bbb-456",
    itemName: "防水Bluetoothスピーカー",
    itemUrl: "https://item.rakuten.co.jp/shop/item-bbb-456/",
    price: 5980,
    description:
      "IPX5 防水規格対応。お風呂・キッチン・屋外（小雨程度）で使用可能。" +
      "Bluetooth 5.0、連続再生時間12時間。USB-C 充電。",
    sizes: [],
    colors: ["ブラック", "ホワイト"],
  },
  "shop:item-ccc-789": {
    itemCode: "shop:item-ccc-789",
    itemName: "プレミアム焙煎コーヒー豆 200g",
    itemUrl: "https://item.rakuten.co.jp/shop/item-ccc-789/",
    price: 1480,
    description:
      "ブラジル・コロンビア・エチオピア産豆のブレンド。中深煎り。挽き方は注文時に選択可能。" +
      "焙煎後5日以内に発送。",
    sizes: [],
    colors: [],
  },
};

export async function listInquiries() {
  return MOCK_INQUIRIES.map((m) => ({ ...m }));
}

export async function getOrder(orderNumber) {
  return MOCK_ORDERS[orderNumber] || null;
}

export async function searchOrdersByMember(memberId) {
  return Object.values(MOCK_ORDERS)
    .filter((o) => o.customerMemberId === memberId)
    .sort((a, b) => new Date(b.orderedAt) - new Date(a.orderedAt));
}

export async function getItem(itemCode) {
  return MOCK_ITEMS[itemCode] || null;
}
