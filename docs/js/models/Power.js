'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { CONST } from '../config/constants.js';

// Power固有の色定義
const LOCAL_CONST = {
  YELLOW: [255, 220, 0],      // 明るい黄色
  ORANGE: [255, 150, 0],      // オレンジ
  OUTLINE_WEIGHT: 2           // 枠線の太さ
};

/**
 * 電源クラス
 * 常にON状態で電力を供給する電源パーツ
 */
export class Power extends CircuitPart {
  constructor(id, x, y) {
    super(id, x, y);
    
    // 部品タイプを設定
    this.type = CONST.PART_TYPE.POWER;
    
    this.isOn = true; // 電源は常にON
    
    // ソケットを作成（出力のみ・右側）
    this.sockets = [
      new Socket(this, 'right', CONST.PARTS.WIDTH / 2, 0, 'right')
    ];
  }

  // ==================== ライフサイクル ====================
  
  /**
   * 状態更新（電源は常にON）
   */
  update() {
    // 電源は常にON状態を維持
    this.isOn = true;
  }

  // ==================== インタラクション ====================
  
  /**
   * 電源は操作不可（クリックしても何も起こらない）
   */
  interact() {
    // 何もしない
  }

  // ==================== 描画 ====================
  
  /**
   * 電源の形を描画（相対座標、中心が原点）
   */
  drawShape(color) {
    // 外枠
    super.drawShape(color);
    
    // 稲妻マークで電源を表現
    fill(...LOCAL_CONST.YELLOW);
    stroke(...LOCAL_CONST.ORANGE);
    strokeWeight(LOCAL_CONST.OUTLINE_WEIGHT);
    
    const w = CONST.PARTS.WIDTH;
    const h = CONST.PARTS.HEIGHT;
    
    beginShape();
      // 稲妻マーク（頂点から時計回り）
      vertex( w * 0.1, -h * 0.3); 
      vertex( w * 0.0, -h * 0.05);
      vertex( w * 0.25, -h * 0.05);
      vertex(-w * 0.1,  h * 0.3);
      vertex( w * 0.0,  h * 0.05);
      vertex(-w * 0.25,  h * 0.05);
    endShape(CLOSE);
  }
}
