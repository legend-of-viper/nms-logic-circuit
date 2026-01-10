'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { CONST } from '../config/constants.js';

// ColorLight固有の色定義
const LOCAL_CONST = {
  LIT_COLOR: [255, 200, 100],      // 点灯時の明るい色（暖色系）
  UNLIT_COLOR: [40, 40, 50],       // 消灯時の暗い色
};

/**
 * カラーライトクラス
 * 入力に電力が供給されると点灯するライト
 * 状態(isOn)を持たず、現在の通電状態をダイレクトに反映する
 */
export class ColorLight extends CircuitPart {
  constructor(id, x, y) {
    super(id, x, y);
    
    this.type = CONST.PART_TYPE.COLOR_LIGHT;
    
    // ソケットを作成（入力のみ・下部）
    this.sockets = [
      new Socket(this, 'bottom', 0, CONST.PARTS.HEIGHT * 1.4 / 2, 'bottom')
    ];
  }

  /**
   * インタラクションなし
   */
  interact() {
    // 何もしない
  }

  /**
   * 状態更新なし
   * ライトは論理的な状態を持たず、ただ電気を表示するだけなので
   * onTick も update も不要です。
   */
  
  /**
   * カラーライトの形を描画
   */
  drawShape(color) {
    const w = CONST.PARTS.WIDTH;
    const h = CONST.PARTS.HEIGHT * 1.5;

    // ★ここが変更点
    // 描画の瞬間に、ソケットに電気が来ているかを直接チェック！
    const bottomSocket = this.getSocket('bottom');
    const isPowered = bottomSocket ? bottomSocket.isPowered : false;
    
    // 通電していれば点灯色、そうでなければ消灯色
    const fillColor = isPowered ? LOCAL_CONST.LIT_COLOR : LOCAL_CONST.UNLIT_COLOR;
    
    // カプセル型を描画
    fill(...fillColor);
    stroke(...color);
    strokeWeight(CONST.PARTS.STROKE_WEIGHT);
    rectMode(CENTER);
    rect(0, 0, w, h, w * 0.5);
  }
}