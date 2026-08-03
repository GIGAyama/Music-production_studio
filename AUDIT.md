# GIGA Standard v3 監査：Music-production_studio（音楽制作スタジオ / Kids Beat Maker）

実施日: 2026-08-03 / アーキテクチャ型: **B型（Vite + React、GitHub Pages 配信）**
対象コミット: `24aa0dc` / 作業ブランチ: `claude/rollout-egbrgp`

> 本監査ではコードを1文字も変更していない。以下はすべてシェルでの実測値である。

---

## 構成の実測

| 項目 | 実測 |
|---|---|
| ビルド | Vite 4.5.14 / `base: '/Music-production_studio/'` |
| 依存（本番） | react 18, react-dom 18, lucide-react |
| 依存（開発） | vite 4, @vitejs/plugin-react, tailwindcss 3, postcss 8, autoprefixer |
| ソース総量 | 7ファイル / 82,540 bytes（うち `App.jsx` が 80,534 bytes = 97.6%） |
| `App.jsx` | 1,205 行 / 80.5KB |
| ビルド成果物 | 合計 544KB（js 200.7KB / css 25.5KB / favicon 308.8KB / html 0.5KB） |
| サーバ通信 | **なし**（`fetch` / `XMLHttpRequest` の使用箇所ゼロ） |
| 永続化 | localStorage 2キーのみ（`kidsBeatMakerData_master`, `kidsBeatMaker_tutorialCompleted`） |
| 個人情報 | **扱わない**（氏名・学籍・メール等の入力欄なし。作曲データのみ端末内保存） |

---

## 判定表

| # | 項目 | 判定 | 実測値 | 対応フェーズ |
|---|---|:--:|---|---|
| 1 | LICENSE 実ファイル | ❌ | 無し。README には「MIT License」と記載あり（齟齬） | P0 |
| 2 | .gitignore | ⚠️ | 有り。`node_modules` `dist` `*.log` 等は網羅。**`.env` 系の記載が無い** | P0 |
| 3 | 秘密情報の直書き | ✅ | 検出なし。git 履歴に含まれるファイルも12件のみで機微ファイル無し | — |
| 4 | OAuthスコープ最小 | — | 該当なし（B型。Google 認可を一切使わない） | — |
| 5 | CSP | ❌ | **未設定**。外部依存が3系統ある（下記「CSP の障害物」参照） | P1 |
| 6 | LockService | — | 該当なし（C型ではない） | — |
| 7 | 自動復旧ロジック | ❌ | **`App.jsx:196` の `JSON.parse` が無防備**（`try/catch` 無し）。保存データが壊れると起動時に例外が出て画面が真っ白になり、児童は自力で復帰できない。<br>※ AI作曲の JSON 読み込み（`App.jsx:328` `loadFromJson`）は `try/catch` ＋型チェックがあり適切 | P1 |
| 8 | 設定のGUI化 | ✅ | サーバID等の設定項目そのものが存在しない | — |
| 9 | 最大ファイルサイズ | ⚠️ | `App.jsx` = 80.5KB / 1,205行。**基準値（400KB / 5,000行）は下回る** | P3（任意） |
| 10 | 画像 150KB超 | ❌ | **`favicon.png` = 302KB（512×512 / RGBA）**。基準の10倍。他に画像なし | P2 |
| 11 | CI（audit/test/build） | ❌ | `build` のみ。`npm install`（`npm ci` でない）。audit・test 無し | P1 |
| 12 | テスト | ❌ | テストファイル・`test` スクリプトともに無し | P1 |
| 13 | dependabot | ❌ | 無し | P0 |
| 14 | README / MANUAL | ⚠️ | README のみ。`🔐 セキュリティ設計` `⚠️ 制限とクォータ` の節が無い。<br>さらに clone URL が `yourusername/kids-beat-maker` のままで**実際には clone できない** | P3 |
| 15 | study.v1 準拠 | — | 該当なし（学習ログを記録しないアプリ） | — |
| 16 | npm audit（本番依存） | ✅ | **0 件** | — |
| 17 | npm audit（開発依存込み） | ⚠️ | 5件（high 3 / moderate 1 / low 1）。詳細は下記 | P1 |

---

## CSP の障害物（P1 着手前の棚卸し結果）

CSP を素で入れると **確実に壊れる箇所が3つ**ある。これが P1 の中心的な作業になる。

| # | 箇所 | 内容 | CSP との衝突 | 対処案 |
|---|---|---|---|---|
| A | `App.jsx:37` | MP3出力時に `cdnjs.cloudflare.com` から `lame.min.js` を**動的に `<script>` 挿入** | `script-src 'self'` で拒否 → **MP3出力が全滅** | `lamejs` を npm 依存に入れて self-host（副次効果：校内回線が外部遮断でも動く） |
| B | `App.jsx:1182` | `@import url('https://fonts.googleapis.com/...Noto+Sans+JP')` | `style-src`/`font-src 'self'` で拒否 → **フォントが標準ゴシックに戻る（見た目が変わる）** | `@fontsource/noto-sans-jp` でローカル配置（woff2 のみ） |
| C | `App.jsx:1182` 周辺 | React 内の `<style>` によるインラインスタイル注入 | `style-src 'self'` で拒否 | `style-src` に `'unsafe-inline'` を残し、理由をコメント明記（Tailwind + 動的スタイルのため実質必須） |

外部リンク（`chatgpt.com` / `gemini.google.com` / `claude.ai` / `note.com`）は `<a target="_blank" rel="noopener noreferrer">` であり、
すべて適切に `rel` が付いている。CSP の `form-action` / `frame-src` とは衝突しない。

**本セッションの環境ではブラウザでの目視確認ができない。**
§3-1-a の手順6「コンソールに `Refused to ...` が出ないことを確認」を満たせないため、
**CSP は投入せず「手順書」として PR に添える**か、A・B の自己ホスト化のみ先行するかを人間に選んでもらう（下記「判断が必要な事項」Q2）。

---

## npm audit の内訳（すべて開発依存。配布物には含まれない）

| パッケージ | 危険度 | 内容 | 解消手段 |
|---|:--:|---|---|
| `postcss` <=8.5.17 | **high** | XSS / sourceMappingURL 経由の任意ファイル読み取り | `npm audit fix`（マイナー更新で解消可） |
| `picomatch` | **high** | ReDoS / メソッドインジェクション | `npm audit fix`（同上） |
| `@babel/core` <=7.29.0 | low | sourceMappingURL 経由の任意ファイル読み取り | `npm audit fix`（同上） |
| `esbuild` <=0.24.2（`vite` 経由） | moderate | **開発サーバ**が任意サイトからのリクエストに応答する | **`vite@8` へのメジャー更新が必要 → §1-7 により実施しない** |

- 本番依存（`--omit=dev`）は **0件**。児童の端末に配られる JS に既知の脆弱性は無い。
- `esbuild` の1件のみ規約上手が出せないため、CI のしきい値は
  `npm audit --omit=dev --audit-level=high`（＝現状グリーン）とするのが妥当。

---

## リスク上位3件

> 【2026-08-03 追記・訂正】初版では #7 を「`try/catch` あり ⚠️」と記載していたが、実装を確認したところ
> `App.jsx:196` の `JSON.parse` に `try/catch` は無かった。上表のとおり ❌ に訂正する。
> 保存データが1文字でも壊れると起動時に画面が真っ白になり、児童は自力で復帰できない。
> 対処は数行で済むが、堅牢性は P1 の範囲であり今回は見送ったため**未修正のまま残っている**（→「次に残っている作業」参照）。

1. **LICENSE ファイルが無い（P0）**
   README は「MIT」と書いているが、実ファイルが無い以上、法的には**全権利留保**と解釈されうる。
   他校の先生が「使っていいのか分からない」状態であり、教材としての横展開を止めている。

2. **MP3出力が外部CDN頼み（P1）**
   `cdnjs.cloudflare.com` が校内フィルタで遮断されている、あるいは一時的に落ちていると、
   授業中に「MP3出力」を押した児童全員がエラーになる。**授業が止まる。**
   同時に、第三者の CDN が改ざんされた場合、児童の端末で任意のコードが動く経路にもなっている（SRI も未設定）。

3. **favicon が 302KB（P2）**
   タブのアイコン1つのために、児童が起動するたび **302KB**（成果物全体の 55%）を転送している。
   40人が一斉に開く教室の回線では、これが最初の待ち時間になる。適正は 30KB 以下で、**10分の1に落とせる。**

---

## 提案するPR

| ブランチ／段階 | 内容 | 所要 | 破壊リスク |
|---|---|:--:|---|
| P0 法務と秘密情報 | LICENSE 追加 / `.gitignore` に `.env` 追記 / dependabot.yml 追加 | 小 | **無** |
| P1 セキュリティと堅牢性 | lamejs 自己ホスト化・フォントローカル化・CSP 投入 / CI に audit+test 追加 / 中核ロジックのテスト | 中 | **中**（CSP で画面が壊れうる。要目視確認） |
| P2 性能 | `favicon.png` 302KB → 30KB 以下に圧縮（元画像は `.assets-original/` に保全） | 小 | 小（画質の確認が要る） |
| P3 保守性 | `MANUAL.md` 作成 / README の clone URL 修正・セキュリティ設計と制限の節を追記 | 小 | 無 |
| 品質ゲート | `scripts/check-project.mjs` + `quality.config.json` 移植、CI に組み込み | 小 | 無 |

> ※ 規約 §1-1 は `giga-v3/{フェーズ名}` ブランチを指定しているが、
> 本セッションは `claude/rollout-egbrgp` へのコミット・プッシュのみ許可されている。
> **`main` に直接コミットしない**という §1-1 の趣旨は満たしたうえで、指定ブランチ上でフェーズごとにコミットを分ける運用とする。

---

## 人間の判断が必要な事項

- **Q1. P0 に着手してよいか。** 破壊リスクは無い（ファイル追加のみ、既存コードに触れない）。
- **Q2. P1 の CSP をどう扱うか。**
  本セッションではブラウザでの目視確認ができない。次の3択：
  - (a) lamejs・フォントの自己ホスト化まで実施し、**CSP 本体は手順書として添えるに留める**（推奨・安全）
  - (b) CSP まで投入し、動作確認は人間が行う
  - (c) P1 全体を見送る
- **Q3. favicon の圧縮後の画質を誰が確認するか。** before/after のサイズ表は出せるが、
  「粗く見えないか」の最終判断は人間の目が要る（§3-P2）。
- **Q4. 品質ゲートの正本（`SchoolPlan_Editor/scripts/lib/project-quality.mjs`）は本セッションから参照できない。**
  同等の内容を新規に書き起こしてよいか、それとも `SchoolPlan_Editor` を先に処理して正本を確定させるか。
- **Q5.（軽微）** README の clone URL が `yourusername/kids-beat-maker` のままで実際には clone できない。
  P3 で `GIGAyama/Music-production_studio` に修正してよいか。

---

## 変更していないもの（確認）

本 Phase 0 では `AUDIT.md` の新規作成以外に、いかなるファイルの追加・変更・削除も行っていない。
`git diff` は空である。

---
---

# 実施記録

人間の判断（2026-08-03）により、**P0 → P2 → P3 を実施し、P1（CSP・自己ホスト化）と品質ゲートは見送る**こととなった。
P1 を見送った結果、判定表 #5（CSP 未設定）・#11（CI）・#12（テスト）・#17（開発依存の脆弱性）は
**未解消のまま残っている**。「CSP の障害物」節の調査結果は次回着手時にそのまま使える。

## P0：法務と秘密情報（完了）

| 変更 | 内容 |
|---|---|
| 追加 | `LICENSE`（MIT / Copyright (c) 2026 GIGAyama）。README の「MIT License」記載と一致させた |
| 変更 | `.gitignore` に `.env` / `.env.local` / `.env.*.local` を追記 |
| 追加 | `.github/dependabot.yml`（npm / monthly / PR上限3） |

- 追跡済みファイルの機微情報スキャン：**検出なし**（`git ls-files` に `.env`・clasp・鍵ファイルは存在しない）
- `git diff --stat`：3 files changed, 33 insertions(+), 0 deletions
- 検証：`npm ci && npm run build` 成功。既存コードには一切触れていない

## P2：性能（完了）

### favicon.png の圧縮

元画像は `.assets-original/favicon.png` に**保全済み**（配信物には含まれない。Vite は `public/` 以外の
ルート直下ディレクトリをコピーしないため、`dist` には出力されない）。

| | 解像度 | サイズ | 512px換算 RMSE |
|---|---|---|---|
| **before** | 512×512 RGBA | **301.5 KB** | 0（原本） |
| **after** | 256×256 パレット256色 | **24.7 KB** | **12.47** |

**−91.8%**（308,780 → 25,268 bytes）。目標「favicon ≤ 30KB」を達成。

圧縮方式は `sharp`（`palette:true, colours:256, quality:90, dither:1.0, effort:10, lanczos3`）。
**アイコンは再生成しておらず、原画像のリサイズと減色のみ**である（§6 の禁止事項に抵触しない）。
`sharp` はこのリポジトリの依存には追加していない（作業用ディレクトリでのみ使用）。

検討した候補のうち、採用案が**最も誤差が小さかった**（数値が小さいほど原本に近い）：

| 候補 | サイズ | RMSE |
|---|---|---|
| 512px / 256色 | 111.1 KB | 16.94 |
| 512px / 128色 | 29.3 KB | 42.10（**明確な色段差が出る**） |
| **256px / 256色 / quality 90（採用）** | **24.7 KB** | **12.47** |
| 192px / 256色 | 18.8 KB | 16.05 |

512px のまま 30KB 台に落とすと色段差が目立つ（RMSE 42.10）のに対し、
256px への縮小＋256色ではむしろ原本に近くなる。favicon の実際の表示サイズは
ブラウザのタブで 16〜32px であり、256px でも 8 倍の余裕がある。

### ビルド成果物の before / after

| | before | after | 差 |
|---|---|---|---|
| `favicon.png` | 308.78 KB | **25.27 KB** | −283.5 KB |
| `index.js` | 200.75 KB | 200.75 KB | ±0 |
| `index.css` | 25.53 KB | 25.53 KB | ±0 |
| `index.html` | 0.54 KB | 0.54 KB | ±0 |
| **dist 合計** | **544 KB** | **249.6 KB** | **−54.1%** |

### 実施しなかった P2 項目

- **maskable アイコンのセーフゾーン確認**：本リポジトリに PWA マニフェスト（`manifest.json`）は
  存在せず、maskable アイコンも定義されていないため対象外。
- **フォントの woff2 化**：フォントは Google Fonts から `@import` で読み込んでおり、
  自己ホストしていない。これは P1（CSP・自己ホスト化）の作業範囲であり、今回は見送った。
- **巨大な静的データの動的 import 化**：`App.jsx` 内にそのような塊は無い（最大の定数は
  `TUTORIAL_STEPS` と `SCALES` で、いずれも数十行）。**実施不要**と判断。

## P3：保守性（完了）

| 変更 | 内容 |
|---|---|
| 追加 | `MANUAL.md`（先生向け・専門用語ゼロ・「うまくいかないとき」の節あり） |
| 変更 | `README.md` に `🔐 セキュリティ設計` `⚠️ 制限とできないこと` の節を追記 |
| 変更 | `README.md` の clone URL を実在するもの（`GIGAyama/Music-production_studio`）に修正 |

- `App.jsx` の分割は**実施していない**。80.5KB / 1,205行 は基準値（400KB / 5,000行）を下回っており、
  §3-P3 の「分割は自動でやらない」に従い、必要性が生じるまで手を付けない。
- `studyLog.js` 等の共通ロジックは本リポジトリに存在しない（学習ログを記録しないアプリ）。

## 次に残っている作業

1. **P1（未着手・最優先）** — `App.jsx:196` の `JSON.parse` を `try/catch` で囲む。
   保存データが壊れたときに画面が真っ白になるのを防ぐ。壊れていたら破棄して初期状態で立ち上げ、
   児童に「前の曲は読めなかったよ」と伝える。**変更は10行程度で、授業中の事故を直接防ぐ。**
2. **P1** — MP3出力の cdnjs 依存を断つ。上記「CSP の障害物」表 A・B の自己ホスト化。
3. **P1** — CI に `npm ci` / `npm audit --omit=dev --audit-level=high` / `npm test` を追加。
4. **P1** — 中核ロジック（AI作曲JSONの読み込み検証、localStorage 復元）に `node:test` でテストを1つ。
5. **§4 品質ゲート** — 正本 `SchoolPlan_Editor` の確定後に移植。
