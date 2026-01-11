'use strict';

import { CONST } from '../config/constants.js';
import { PartFactory } from '../models/PartFactory.js';

/**
 * UIコントローラー
 * ボタンやその他のUI要素の初期化とイベント管理を担当
 */
export class UIController {
  constructor(simulator, storage) {
    this.simulator = simulator;
    this.storage = storage;
  }

  /**
   * UIの初期化
   * ボタンラベルの設定とイベントリスナーの登録
   */
  initialize() {
    this.setupLabels();
    this.setupButtonIcons();
    this.setupEventListeners();
  }

  /**
   * ボタンラベルを定数から設定
   */
setupLabels() {
    // textContent（ボタンの中の文字）ではなく、title（マウスホバー時の説明）に設定する
    // これで「日本語が読めなくても形で見分けられ、迷ったらマウスを乗せれば名前が出る」状態になります
    document.getElementById('btn-power').title = CONST.UI_LABELS.POWER;
    document.getElementById('btn-auto-switch').title = CONST.UI_LABELS.AUTO_SWITCH;
    document.getElementById('btn-inverter').title = CONST.UI_LABELS.INVERTER;
    document.getElementById('btn-button').title = CONST.UI_LABELS.BUTTON;
    document.getElementById('btn-wall-switch').title = CONST.UI_LABELS.WALL_SWITCH;
    document.getElementById('btn-color-light').title = CONST.UI_LABELS.COLOR_LIGHT;
    
    // ★修正: 削除ボタンもテキストを消し、ツールチップのみ設定する
    const deleteBtn = document.getElementById('btn-delete-mode');
    deleteBtn.textContent = ''; // 文字を消す
    deleteBtn.title = CONST.UI_LABELS.DELETE_MODE; // ツールチップを設定

    document.getElementById('btn-save').textContent = CONST.UI_LABELS.SAVE;
    document.getElementById('btn-load').textContent = CONST.UI_LABELS.LOAD;
    document.getElementById('btn-share').textContent = CONST.UI_LABELS.SHARE;
    
    // パーツボタンの文字はCSSで透明にしていますが、念のため空にしておくならここで行います
    const partBtnIds = ['btn-power', 'btn-auto-switch', 'btn-inverter', 'btn-button', 'btn-wall-switch', 'btn-color-light'];
    partBtnIds.forEach(id => {
      const btn = document.getElementById(id);
      if(btn) btn.textContent = '';
    });
  }

  /**
   * ★追加: 各パーツのアイコンを動的に生成してボタンの背景にする
   */
  setupButtonIcons() {
    // ボタンIDとパーツタイプの対応表
    const mapping = [
      { id: 'btn-power', type: CONST.PART_TYPE.POWER },
      { id: 'btn-auto-switch', type: CONST.PART_TYPE.AUTO_SWITCH },
      { id: 'btn-inverter', type: CONST.PART_TYPE.INVERTER },
      { id: 'btn-button', type: CONST.PART_TYPE.BUTTON },
      { id: 'btn-wall-switch', type: CONST.PART_TYPE.WALL_SWITCH },
      { id: 'btn-color-light', type: CONST.PART_TYPE.COLOR_LIGHT }
    ];

    // p5.jsの描画状態を保存
    push();
    
    // アイコン生成用にキャンバスを一時的に使用
    // （ユーザーには一瞬すぎて見えませんが、メインキャンバスを使って絵を作ります）
    
    mapping.forEach(item => {
      // 1. 背景をクリア
      // background(CONST.COLORS.BACKGROUND);
      clear();
      
      // 2. ダミーのパーツを生成
      const dummyPart = PartFactory.create(item.type, -1, 0, 0);
      
      if (dummyPart) {

        // 3. 画面中央に移動
        translate(width / 2, height / 2);
        
        // ソケットの描画
        for (let socket of dummyPart.sockets) {
            // ソケットも通電色（青）にして目立たせる
            socket.isPowered = true;
            
            // 通常の描画処理を呼び出す（これで基部の四角形が描かれます）
            socket.draw();

            // 【オプション】接続ピン（三角マーク）も常に表示したい場合
            // 通常はマウスホバー時しか出ないので、アイコン用に無理やり描画する処理を追加
            // （お好みで、ここが無くて基部だけでも十分アイコンとして成立します）
            push();
            const pos = socket.getConnectorWorldPosition();
            // worldToLocalでローカル座標に戻す計算が必要ですが、
            // 簡易的にソケットの位置から少しずらすだけで描画してみます
            const connectorSize = CONST.PARTS.CONNECTOR_RADIUS;
            
            fill(CONST.COLORS.WIRE_ON); // 青色
            noStroke();
            
            // ソケットの方向に応じて丸を描いて「接続点」を表現
            let cx = socket.localX;
            let cy = socket.localY;
            const offset = CONST.PARTS.CONNECTOR_HEIGHT;

            if (socket.direction === 'left') cx -= offset;
            if (socket.direction === 'right') cx += offset;
            if (socket.direction === 'bottom') cy += offset;
            
            circle(cx, cy, connectorSize * 2);
            pop();
        }

        // 本体の描画、アイコン用に明るい色（ON_STATE）で描画
        dummyPart.drawShape(CONST.COLORS.ON_STATE);
        
        // 4. 画像として切り出し
        let scale = 1.4; // デフォルトの倍率
        switch (item.type) {
          case CONST.PART_TYPE.COLOR_LIGHT:
            scale = 1.8; // ライトは縦長なので広めに切り取る
            break;
        }
        const size = CONST.PARTS.WIDTH * scale;
        const img = get(width / 2 - size / 2, height / 2 - size / 2, size, size);
        
        // 5. ボタンの背景に設定
        const btn = document.getElementById(item.id);
        if (btn) {
          btn.style.backgroundImage = `url(${img.canvas.toDataURL()})`;
        }
        
        // 座標を戻す
        translate(-width / 2, -height / 2);
      }
    });

    // ★追記: ループの後に、削除ボタン用のアイコン生成処理を追加
    clear();
    translate(width / 2, height / 2);

    // ゴミ箱アイコンを描画
    // 色設定: ボタン背景が赤になるので、アイコンは白で見やすくする
    stroke(255);
    strokeWeight(3);
    noFill();
    
    // 1. ゴミ箱の本体
    // 少し台形っぽくするとゴミ箱らしく見える
    beginShape();
    vertex(-12, -8);
    vertex(12, -8);
    vertex(10, 18);
    vertex(-10, 18);
    endShape(CLOSE);
    
    // 2. 蓋
    rectMode(CENTER);
    rect(0, -12, 30, 4); // 蓋の板
    rect(0, -16, 8, 4);  // 蓋の取っ手

    // 3. 本体の縦縞（ディテール）
    line(-5, -2, -4, 12);
    line(0, -2, 0, 12);
    line(5, -2, 4, 12);

    // 画像として切り出し
    const trashSize = 60; // 少し大きめに切り取る
    const trashImg = get(width / 2 - trashSize / 2, height / 2 - trashSize / 2, trashSize, trashSize);
    
    const deleteBtn = document.getElementById('btn-delete-mode');
    if (deleteBtn) {
      deleteBtn.style.backgroundImage = `url(${trashImg.canvas.toDataURL()})`;
    }

    // 座標リセット
    translate(-width / 2, -height / 2);

    pop();
    
    // 最後に画面を綺麗にクリアしておく（次のdrawループで上書きされるので必須ではないが念のため）
    background(CONST.COLORS.BACKGROUND);
  }

  /**
   * イベントリスナーの登録
   */
  setupEventListeners() {
    // 部品追加ボタン
    document.getElementById('btn-power').addEventListener('click', () => {
      this.simulator.createPart(CONST.PART_TYPE.POWER);
    });
    
    document.getElementById('btn-auto-switch').addEventListener('click', () => {
      this.simulator.createPart(CONST.PART_TYPE.AUTO_SWITCH);
    });
    
    document.getElementById('btn-inverter').addEventListener('click', () => {
      this.simulator.createPart(CONST.PART_TYPE.INVERTER);
    });
    
    document.getElementById('btn-button').addEventListener('click', () => {
      this.simulator.createPart(CONST.PART_TYPE.BUTTON);
    });
    
    document.getElementById('btn-wall-switch').addEventListener('click', () => {
      this.simulator.createPart(CONST.PART_TYPE.WALL_SWITCH);
    });
    
    document.getElementById('btn-color-light').addEventListener('click', () => {
      this.simulator.createPart(CONST.PART_TYPE.COLOR_LIGHT);
    });
    
    // 削除モードボタン
    document.getElementById('btn-delete-mode').addEventListener('click', () => {
      this.simulator.toggleDeleteMode();
      this.updateDeleteButtonState();
    });
    
    // 90度スナップチェックボックス
    document.getElementById('rotation-snap-checkbox').addEventListener('change', (event) => {
      this.simulator.setRotationSnap(event.target.checked);
    });
    
    // ファイル操作ボタン（StorageService経由）
    document.getElementById('btn-save').addEventListener('click', () => {
      this.storage.saveToFile();
    });
    
    document.getElementById('btn-load').addEventListener('click', () => {
      this.storage.loadFromFile();
    });
    
    document.getElementById('btn-share').addEventListener('click', () => {
      this.storage.shareToUrl();
    });
  }

  /**
   * 削除モードボタンの見た目を更新
   */
  updateDeleteButtonState() {
    const btn = document.getElementById('btn-delete-mode');
    if (this.simulator.getDeleteMode()) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
}
