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
    │   ├── CircuitPart.js   # 回路部品の基底クラス
    │   ├── Socket.js        # ソケット（接続ポート）
    │   ├── Wire.js          # ワイヤー
    │   ├── PartFactory.js   # 部品ファクトリー
    │   ├── Power.js         # 電源
    │   ├── AutoSwitch.js    # オートスイッチ
    │   ├── Inverter.js      # 電力変換器
    │   ├── Button.js        # ボタン
    │   ├── WallSwitch.js    # 壁スイッチ
    │   └── ColorLight.js    # カラーライト
    ├── services/          # ビジネスロジック
    │   └── CircuitSimulator.js # 回路シミュレーター
    └── ui/                # UI制御
        └── UIController.js     # UIコントローラー
```

## 🚀 使い方

1. `index.html` をブラウザで開く、またはLive Serverで起動
2. ヘッダーのボタンをクリックして部品を追加
3. 部品をドラッグして移動
4. 部品の回転ハンドル（下側の丸）をドラッグして回転（Shiftキーで90度スナップ）
5. 部品をクリックしてON/OFF切り替え（スイッチ類）
6. ソケット（接続ポート）をクリック＆ドラッグでワイヤー接続
7. 削除モードボタン（🗑️）で部品やワイヤーを削除
8. 保存/読込ボタンで回路の状態を保存・復元

## 🔌 実装済み部品

### 電源（Power）
- 常に電力を出力する
- 出力ソケット: `right`

### オートスイッチ（AutoSwitch）
- 入力があれば自動でONになる
- 入力ソケット: `left`
- 出力ソケット: `right`

### 電力変換器（Inverter）
- 入力がOFFの時にONを出力（NOT回路）
- 入力ソケット: `left`
- 出力ソケット: `right`

### ボタン（Button）
- クリックで1秒間だけON
- 入力ソケット: `left`
- 出力ソケット: `right`

### 壁スイッチ（WallSwitch）
- クリックでON/OFF切り替え
- 入力ソケット: `left`
- 出力ソケット: `right`

### カラーライト（ColorLight）
- 入力に応じて色が変化
- 入力ソケット: `left`

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
- ドラッグ＆ドロップ
- 回転機能（回転ハンドルの実装）
- ソケット管理、描画の基本実装
- ローカル座標⇔ワールド座標の変換

#### `Socket` (ソケットクラス)
- 部品の接続ポートを表現
- 電力状態の管理
- ワイヤーの接続/切断
- 当たり判定と描画

#### `PartFactory` (ファクトリー)
- 部品タイプに応じた部品インスタンスの生成
- 部品生成ロジックの一元管理

#### `CircuitSimulator` (サービス)
- 部品とワイヤーの管理
- マウスイベントの処理（通常モード・削除モード・回転モード）
- 回路の電力シミュレーション
- 描画ループの制御
- 保存/読込機能

#### `UIController` (UI制御)
- ボタンの初期化
- イベントリスナーの登録
- UIとビジネスロジックの分離

## 🔧 新しい部品の追加方法

1. `js/models/` に新しいクラスファイルを作成
2. `CircuitPart` を継承
3. コンストラクタでソケットを初期化
4. `update()` メソッドで電力伝播ロジックを実装
5. `PartFactory.js` の `createPart()` に追加
6. `constants.js` の `UI_LABELS` にラベルを追加

例：
```javascript
// js/models/NewPart.js
import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';

export class NewPart extends CircuitPart {
  constructor(id, x, y) {
    super(id, x, y);
    this.isOn = false;
    
    // ソケットを作成
    this.sockets = [
      new Socket(this, 'left', -20, 0, 'input'),
      new Socket(this, 'right', 20, 0, 'output')
    ];
  }
  
  interact() {
    // クリック時の処理
    this.isOn = !this.isOn;
  }
  
  update() {
    // 電力伝播ロジック
    if (this.isPoweredAt('left') && this.isOn) {
      this.setPowered('right', true);
    }
  }
  
  drawBody(color) {
    // カスタム描画（オプション）
    super.drawBody(color);
  }
}
```

## 📝 設定のカスタマイズ

`js/config/constants.js` で以下を変更可能：
- 色設定（背景、テキスト、通電状態など）
- 部品サイズ（幅、高さ、丸み、線の太さなど）
- ソケットのサイズと当たり判定
- 回転ハンドルの位置とサイズ
- ワイヤーの見た目
- ボタンのON持続時間
- 削除モードの設定
- UIラベル

## ✨ 主な機能

### 回転機能
- 各部品に回転ハンドル（下側の丸いマーク）が表示
- ハンドルをドラッグして部品を回転
- Shiftキーを押しながらドラッグで90度単位にスナップ
- ソケット位置も回転に追従

### 削除モード
- ヘッダーの🗑️ボタンで削除モードをON/OFF
- 削除モード中はマウスカーソルに近い部品/ワイヤーがハイライト
- クリックで削除

### 保存/読込
- 保存: 回路の状態をブラウザのローカルストレージに保存
- 読込: 保存した回路を復元
- 部品の位置、回転、接続状態を保持

### 電力シミュレーション
- Powerから電力が伝播
- AutoSwitchは入力があれば自動でON
- Inverterは入力を反転
- WallSwitchやButtonで手動制御
- ColorLightで電力状態を視覚化

## 🛠️ 技術スタック

- **p5.js**: グラフィックスライブラリ
- **ES6 Modules**: モジュールシステム
- **Pure JavaScript**: フレームワーク不要

## 📄 ライセンス

MIT License
