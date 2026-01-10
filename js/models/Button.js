'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { CONST } from '../config/constants.js';

// Button固有の色定義
const LOCAL_CONST = {
  RED: [255, 50, 50],      // 明るい赤（朱色っぽい）
  DARK_RED: [100, 0, 0],      // 限りなく黒に近い暗い赤
  BUTTON_SIZE: CONST.PARTS.WIDTH * 0.7,           // ボタンのサイズ（直径比率）
  OUTLINE_WEIGHT: 3          // 枠線の太さ
};

/**
 * ボタンクラス
 * 押すと一定時間だけONになるボタン
 */
export class Button extends CircuitPart {
  constructor(id, x, y) {
    super(id, x, y);
    this.isOn = false;
    this.offTime = 0;
    
    // ソケットを作成（Socket配列）
    this.sockets = [
      new Socket(this, 'left', -CONST.PARTS.WIDTH / 2, 0, 'left'),
      new Socket(this, 'right', CONST.PARTS.WIDTH / 2, 0, 'right')
    ];
  }

  /**
   * ボタンを押す（一定時間ONにする）
   */
  interact() {
    this.isOn = true;
    this.offTime = millis() + CONST.BUTTON.ON_DURATION; 
  }

  /**
   * 状態更新（時間が来たらOFFに戻す）
   */
  update() {
    if (this.isOn && millis() > this.offTime) {
      this.isOn = false;
    }
  }

  /**
   * ボタンの描画（相対座標、中心が原点）
   */
  drawBody(color) {
    // 外枠
    super.drawBody(color);
    
    // Button固有の内部描画（円）
    const button_color = this.isOn ? LOCAL_CONST.DARK_RED : LOCAL_CONST.RED;
    const outline_color = this.isOn ? LOCAL_CONST.RED : LOCAL_CONST.DARK_RED;
    
    // 内部に円を描画してButtonであることを示す（中心が原点）
    fill(...button_color);
    stroke(...outline_color);
    strokeWeight(LOCAL_CONST.OUTLINE_WEIGHT);
    circle(0, 0, LOCAL_CONST.BUTTON_SIZE);
  }
}
