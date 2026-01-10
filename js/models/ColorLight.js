'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { CONST } from '../config/constants.js';

// ColorLight固有の色定義
const LOCAL_CONST = {
  LIT_COLOR: [255, 200, 100],      // 点灯時の明るい色（暖色系）
  UNLIT_COLOR: [40, 40, 50],       // 消灯時の暗い色
  OUTLINE_WEIGHT: 2                // 枠線の太さ
};

/**
 * カラーライトクラス
 * 入力に電力が供給されると点灯するライト
 */
export class ColorLight extends CircuitPart {
  constructor(id, x, y) {
    super(id, x, y);
    this.isOn = false;
    
    // ソケットを作成（入力のみ・下部）
    this.sockets = [
      new Socket(this, 'bottom', 0, CONST.PARTS.HEIGHT*1.4 / 2, 'bottom')
    ];
  }

  /**
   * カラーライトは操作不可（クリックしても何も起こらない）
   */
  interact() {
    // 何もしない
  }

  /**
   * 状態更新（入力ソケットの通電状態に応じて点灯・消灯）
   */
  update() {
    const bottomSocket = this.getSocket('bottom');
    this.isOn = bottomSocket ? bottomSocket.isPowered : false;
  }

  /**
   * カラーライトの描画（相対座標、中心が原点）
   */
  drawBody(color) {
    const w = CONST.PARTS.WIDTH;
    const h = CONST.PARTS.HEIGHT * 1.5;
    
    // カプセル型（スタジアム型）の内部色を決定
    const fillColor = this.isOn ? LOCAL_CONST.LIT_COLOR : LOCAL_CONST.UNLIT_COLOR;
    
    // カプセル型を描画（矩形の角を大きく丸める）
    fill(...fillColor);
    stroke(...color);
    strokeWeight(CONST.PARTS.STROKE_WIDTH);
    rectMode(CENTER);
    rect(0, 0, w , h , w * 0.5); // radiusを高さの半分程度にしてカプセル型に
  }
}
