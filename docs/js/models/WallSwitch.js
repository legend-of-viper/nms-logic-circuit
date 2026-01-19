'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { CONST } from '../config/constants.js';

const LOCAL_CONST = {
  RED: [255, 50, 50],      // 明るい赤（朱色っぽい）
  LEVER_THICKNESS: 4,          // 枠線の太さ
};

/**
 * 壁面スイッチクラス
 * トグル式のスイッチ（ON/OFF切り替え）
 */
export class WallSwitch extends CircuitPart {
  constructor(id, x, y) {
    super(id, x, y);
    
    // 部品タイプを設定
    this.type = CONST.PART_TYPE.WALL_SWITCH;
    
    this.isOn = false;
    
    // ソケットを作成（Socket配列）
    this.sockets = [
      new Socket(this, 'left', -CONST.PARTS.WIDTH / 2, 0, 'left'),
      new Socket(this, 'right', CONST.PARTS.WIDTH / 2, 0, 'right')
    ];
  }
  
  // ==================== ライフサイクル ====================
  
  /**
   * 状態更新（特に処理なし）
   */
  update() {
    // 特に何もしない
  }

  // ==================== インタラクション ====================
  
  /**
   * スイッチのON/OFF切り替え
   */
  interact() { 
    this.isOn = !this.isOn; 
  }

  // ==================== 描画 ====================
  
  /**
   * スイッチの形を描画（相対座標、中心が原点）
   */
  drawShape(color) {
    // 外枠
    super.drawShape(color);

    // スイッチ固有の内部描画（レバー）
    rectMode(CORNER);
    noStroke();
    fill(...LOCAL_CONST.RED);
    rect(-CONST.PARTS.WIDTH * 0.15, -CONST.PARTS.HEIGHT * 0.1, 
         CONST.PARTS.WIDTH * 0.3, CONST.PARTS.HEIGHT * 0.2);

    noFill();
    stroke(...LOCAL_CONST.RED);
    strokeWeight(LOCAL_CONST.LEVER_THICKNESS);
    
    rect(-CONST.PARTS.WIDTH * 0.3, 
         -(this.isOn ? 0 : CONST.PARTS.HEIGHT * 0.3), 
         CONST.PARTS.WIDTH * 0.6, 
         CONST.PARTS.HEIGHT * 0.3);
  }
}
