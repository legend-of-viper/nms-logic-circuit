'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { APP_CONFIG } from '../config/constants.js';

const LOCAL_CONST = {
  GREEN: [100, 255, 100],
  RED: [255, 50, 50],
};

/**
 * インバータークラス
 * 入力の論理を反転させる（入力がOFF→出力ON、入力がON→出力OFF）
 */
export class Inverter extends CircuitPart {
  constructor(id, x, y) {
    super(id, x, y);
    this.isOn = true; // 初期状態は入力なしなのでON
    
    // ソケットを作成（Socket配列）
    this.sockets = [
      new Socket(this, 'left', -APP_CONFIG.PARTS.WIDTH / 2, 0, 'left'),
      new Socket(this, 'bottom', 0, APP_CONFIG.PARTS.HEIGHT / 2, 'bottom'),
      new Socket(this, 'right', APP_CONFIG.PARTS.WIDTH / 2, 0, 'right')
    ];
  }
  
  /**
   * クリックしても何もしない（自動で反転するので）
   */
  interact() {
    // 自動的に入力を反転するので手動での切り替えはしない
  }
  
  /**
   * 状態更新（特に処理なし）
   */
  update() {
    // 状態はCircuitSimulatorで更新される
  }

  /**
   * Inverterの描画（相対座標、中心が原点）
   */
  drawBody(color) {
    // 外枠
    stroke(...color);
    strokeWeight(APP_CONFIG.PARTS.STROKE_WIDTH);
    fill(APP_CONFIG.COLORS.BACKGROUND);
    rectMode(CENTER);
    rect(0, 0, APP_CONFIG.PARTS.WIDTH, APP_CONFIG.PARTS.HEIGHT, 8);

    // インバーターを表現する図形（縦に2本の線：左が赤、右が緑）
    const height = APP_CONFIG.PARTS.HEIGHT * 0.5;
    const spacing = APP_CONFIG.PARTS.WIDTH * 0.2;
    const lineWeight = APP_CONFIG.PARTS.WIDTH * 0.15;
    
    // 左側の線（赤）
    stroke(...LOCAL_CONST.RED);
    strokeWeight(lineWeight);
    line(-spacing, -height / 2, -spacing, height / 2);
    
    // 右側の線（緑）
    stroke(...LOCAL_CONST.GREEN);
    strokeWeight(lineWeight);
    line(spacing, -height / 2, spacing, height / 2);
  }
}
