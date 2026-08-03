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
| 7 | 自動復旧ロジック | ⚠️ | localStorage 読み込みは `try/catch` あり。ただし壊れたデータ時の挙動は未検証 | P1（軽微） |
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
