# NMS Logic Simulator

No Man's Sky風の論理回路シミュレーター

## 📁 プロジェクト構成

```
nms-logic-circuit/
├── index.html              # エントリーポイント
├── css/
│   └── style.css          # スタイルシート
└── js/
    ├── main.js            # アプリケーションエントリーポイント
    ├── config/
    │   └── constants.js   # 定数・設定値
    ├── models/            # データモデル
    │   ├── CircuitPart.js      # 回路部品の基底クラス
    │   ├── WallSwitch.js       # 壁面スイッチ
    │   ├── MomentaryButton.js  # モーメンタリーボタン
    │   └── Wire.js             # ワイヤー
    ├── services/          # ビジネスロジック
    │   └── CircuitSimulator.js # 回路シミュレーター
    └── ui/                # UI制御
        └── UIController.js     # UIコントローラー
```

## 🚀 使い方

1. `index.html` をブラウザで開く、またはLive Serverで起動
2. ヘッダーのボタンをクリックして部品を追加
3. 部品をドラッグして移動
4. 部品をクリックしてON/OFF切り替え
5. ポートをクリック＆ドラッグでワイヤー接続

## 🎯 設計原則

### ES6モジュール
- `import/export` を使用した明確な依存関係
- ファイルごとに単一責任を持つ

### レイヤードアーキテクチャ
```
UI Layer        (UIController)
    ↓
Service Layer   (CircuitSimulator)
    ↓
Model Layer     (CircuitPart, Wire, etc.)
    ↓
Config Layer    (constants)
```

### 主要クラスの役割

#### `CircuitPart` (抽象基底クラス)
- すべての回路部品の共通機能を提供
- ドラッグ、ポート管理、描画の基本実装

#### `CircuitSimulator` (サービス)
- 部品とワイヤーの管理
- マウスイベントの処理
- 描画ループの制御

#### `UIController` (UI制御)
- ボタンの初期化
- イベントリスナーの登録
- UIとビジネスロジックの分離

## 🔧 新しい部品の追加方法

1. `js/models/` に新しいクラスファイルを作成
2. `CircuitPart` を継承
3. `CircuitSimulator.js` の `createPart()` に追加
4. `constants.js` にラベルを追加（必要に応じて）

例：
```javascript
// js/models/NewPart.js
import { CircuitPart } from './CircuitPart.js';

export class NewPart extends CircuitPart {
  constructor(id, x, y) {
    super(id, x, y);
    // 初期化処理
  }
  
  interact() {
    // クリック時の処理
  }
  
  draw() {
    // 描画処理
  }
}
```

## 📝 設定のカスタマイズ

`js/config/constants.js` で以下を変更可能：
- 色設定
- 部品サイズ
- ワイヤーの見た目
- UIラベル

## 🛠️ 技術スタック

- **p5.js**: グラフィックスライブラリ
- **ES6 Modules**: モジュールシステム
- **Pure JavaScript**: フレームワーク不要

## 📄 ライセンス

MIT License
