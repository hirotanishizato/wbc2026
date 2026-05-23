# RMS問い合わせ管理ツール（MVP）

楽天市場の出店店舗向け SaaS。R-Messe 経由で届いた問い合わせを取り込み、
AI（Gemini）で返信文の下書きを生成。テンプレート / マニュアル / 納期ルール
を組み合わせて、商品情報と注文情報を踏まえた回答ドラフトを作成します。

## 構成

```
apps/rms-tool/
├── server/                  # Express バックエンド
│   ├── index.js             # エントリーポイント
│   ├── config.js            # env 読み込み
│   ├── crypto.js            # AES-256-GCM 暗号化
│   ├── db.js                # Supabase クライアント
│   ├── middleware/auth.js   # JWT 検証 + テナント解決
│   ├── clients/
│   │   ├── rakuten.js       # ファサード（mock/real 切替）
│   │   ├── rakuten-mock.js  # ローカル開発用フィクスチャ
│   │   ├── rakuten-real.js  # 実 RMS WEB API クライアント
│   │   └── gemini.js        # @google/genai ラッパー
│   ├── services/
│   │   ├── draftGenerator.js # AI 下書き生成の中核
│   │   ├── deliveryRules.js  # 納期ルール評価
│   │   ├── matcher.js        # キーワードベースのテンプレ/マニュアル選定
│   │   ├── syncInquiries.js  # R-Messe → DB 取り込み
│   │   └── tenants.js
│   └── routes/              # /api/{tenants,inquiries,templates,manuals,delivery-rules}
├── client/                  # React + Vite
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── api.js           # バックエンド REST クライアント
│       ├── supabase.js      # Supabase Auth
│       └── pages/
├── supabase/
│   └── migrations/          # SQL スキーマ
├── scripts/
│   ├── applyMigrations.js   # マイグレーション SQL の出力
│   └── seedMock.js          # デモテナント + サンプルデータ投入
└── package.json
```

## セットアップ

### 1. 依存パッケージインストール

```bash
cd apps/rms-tool
npm install
```

### 2. 環境変数

`.env.example` をコピーして `.env` を作成し、値を埋めます。

```bash
cp .env.example .env
```

**最低限必要なもの**:
- `ENCRYPTION_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` で生成
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: Supabase ダッシュボードから
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`: ブラウザ用
- `GEMINI_API_KEY`: https://aistudio.google.com/apikey

初期は `USE_MOCK_RAKUTEN=true` のままで OK（楽天 API キー不要）。

### 3. データベース初期化

```bash
npm run db:apply
```

出力された SQL を Supabase Dashboard の SQL Editor にコピペして実行。

### 4. 起動

```bash
npm run dev
```

- バックエンド: http://localhost:4000
- フロントエンド: http://localhost:5174

### 5. 初回ログイン

1. ブラウザでフロントエンドを開く
2. メール+パスワードで「新規登録」→ 確認メール経由でアクティベート
3. ログイン後、店舗情報を登録
4. 「問い合わせ」画面で **R-Messeから取り込み** を押す（モックなら 4 件入る）
5. 任意の問い合わせを開き、**AIで下書き生成** を押す

### 6. デモデータの一括投入（任意）

Supabase の `auth.users` テーブルから自分の user_id を取得して:

```bash
node scripts/seedMock.js <YOUR_USER_ID>
```

サンプルテンプレート 3 件 / マニュアル 2 件 / 納期ルール 2 件が投入されます。

## モック → 本番 RMS API への切替

`.env` の `USE_MOCK_RAKUTEN=false` に変更。
各テナントの **設定** 画面で楽天 RMS の `serviceSecret` / `licenseKey` を入力。
`server/clients/rakuten-real.js` のエンドポイントパスを実際の RMS WEB API
仕様に合わせて調整してください（現状はプレースホルダ）。

## 主な機能

| 機能 | 場所 |
|---|---|
| R-Messe 問い合わせ取り込み | `server/services/syncInquiries.js` |
| AI 下書き生成 | `server/services/draftGenerator.js` |
| テンプレート管理 | `routes/templates.js`, `pages/Templates.jsx` |
| マニュアル（商品補足情報） | `routes/manuals.js`, `pages/Manuals.jsx` |
| 納期ルール管理 + 自動計算 | `services/deliveryRules.js` |
| マルチテナント（テナント切替） | `middleware/auth.js`, App.jsx |
| API キー暗号化保管 | `server/crypto.js` |

## セキュリティ留意点

- Supabase **service-role** キーはサーバー側のみで使用（ブラウザに渡さない）
- 楽天 API キー / Gemini API キーは AES-256-GCM で暗号化して DB に保管
- `ENCRYPTION_KEY` はサーバーごとに 1 つ。本番では Secret Manager 推奨
- 今後の TODO: Supabase RLS を有効化し、フロントの直接アクセスを完全に塞ぐ

## 未実装 / 次のステップ

- [ ] Supabase RLS ポリシー
- [ ] pgvector ベースの RAG への置き換え（現状は単純キーワードマッチ）
- [ ] 定期同期ジョブ（node-cron は依存済み、配線は未実装）
- [ ] R-Messe への送信 API 連携（現状は下書きまでで送信は手動）
- [ ] 監査ログの可視化 UI（テーブルは作成済み）
- [ ] レート制限ハンドリング + リトライ
- [ ] 楽天 RMS WEB API のエンドポイント実装（`rakuten-real.js` を実仕様に）
