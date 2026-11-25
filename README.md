# Git_classic — The Mechanical Pianist

MIDIを2本のロボットハンドがリアルタイムに演奏する、3DピアノのWebアプリです。Three.jsで描画し、運指プランを事前に計算して、鍵盤・ペダル・手の動きまで含めた演奏をブラウザ上で再現します。通常UIは日本語化し（タイトル・Programme・Cinematic・ビジュアルスタイル名などの演出表記は英語を維持）、クラシックを中心に5曲を収録しています。

公開ページ: https://asoka501.github.io/Git_classic/

![The Mechanical Pianist](docs/images/mechanical-pianist-header.jpg)

## 収録曲（デフォルト起動曲：幻想即興曲）

選曲すると、その曲に合わせたビジュアルスタイルが自動で適用されます。

| No. | 曲名 | 作曲家 | 自動スタイル | 収録MIDI出典 |
| :--- | :--- | :--- | :--- | :--- |
| 01 | **幻想即興曲**（デフォルト） | Frédéric Chopin (1834) | Moonlight | [Mutopia Project](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1693)（Public Domain） |
| 02 | 貴婦人の乗馬 | Friedrich Burgmüller (1851) | Studio | [BitMidi](https://bitmidi.com/study-no-25-la-chevaleresque-opus-100-mid) |
| 03 | ゴリウォーグのケークウォーク | Claude Debussy (1908) | Golden hour | [BitMidi](https://bitmidi.com/golliwogs-cake-walk-mid) |
| 04 | アラベスク（Op.100-2） | Friedrich Burgmüller (1851) | Faded film | [Mutopia Project](https://www.mutopiaproject.org/ftp/BurgmullerJFF/O100/25EF-02/25EF-02.mid)（Public Domain） |
| 05 | フニクリ・フニクラ | Luigi Denza (1880) | Golden hour | [BitMidi](https://bitmidi.com/funicula-mid)（ピアノソロ2トラックに整形） |

※ ブラウザ上の「ライブラリ」または画面へのドラッグ＆ドロップで、お手元の `.mid` ファイルも追加演奏できます。

## カスタム要素

- **ピアノ刻印**: 響板の金箔ロゴに `YAMAHA`、鋳鉄フレームに `made by tsuda in 2026` を刻印
- **右手中指の指輪**: 交差する3連プラチナクロスバンド＋4本爪イエローストーン＋一列メレダイヤを、右手中指に装着
- **空間ネオン音符＆音の繋がり（オプション）**: 打鍵から半透明ネオンの立体音符が浮かび上がり、連続するメロディ同士を光のカーブラインで結ぶ演出（設定 → 照明タブ、または `N` キーでON/OFF）
- **和紙調＆演奏連動で舞う楽譜**: 譜面台に曲名・作曲家を和紙調で印字し、ピアノ周囲〜窓の光の中を6枚の楽譜が演奏に合わせてゆっくり舞う（空間ネオン音符ON時は縁も淡く発光、設定でON/OFF可）
- **引きカメラ3種**: `Wide: Treble side (A)` / `Wide: Window backlight (B)` / `Wide: Stage overview (C)` を自動編集とショット切替に追加

## 構成

- `src/` — アプリ本体（解釈・運指計算、演奏モーション、3D描画、UI）
- `src/music/` — 収録曲のMIDI
- `public/piano/` — ピアノ音源サンプル
- `public/assets/` — ピアノ筐体とロボットハンドの3Dモデル（GLB）
- `tests/` — ユニット・キネマティクステスト
- `tools/` — 運指プラン生成、サンプルコピー等のビルド補助

技術スタック: Vite 8 / TypeScript / three.js

## 公開の仕組み

このリポジトリは `.github/workflows/pages.yml` により、`main` ブランチへプッシュするだけで公開されます。

1. `main` へプッシュすると GitHub Actions の `Pages` ワークフローが起動します。
2. ワークフロー内でテスト、5曲の事前運指プラン生成、ビルドが実行されます。
3. ビルド成果物が GitHub Pages へ公開されます。

Pages の設定は **Settings → Pages → Source: GitHub Actions** です。公開URLは https://asoka501.github.io/Git_classic/ で、相対パス設定のためリポジトリ名に依存せず動作します。

## ローカル実行手順

Node.js 20 以上（22 推奨）が必要です。

```bash
npm ci
npm run dev    # 開発サーバー起動 (http://127.0.0.1:5174)
npm test       # ユニット・キネマティクステスト実行
npm run build  # 事前運指プラン生成 + 本番ビルド (dist/)
```

## クレジット・ライセンス上の注意

- ピアノ音源: [Upright Piano KW](https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html)（FreePats, CC0）
- 離鍵ノイズ: [Salamander Grand Piano V3](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm（CC BY 3.0）
