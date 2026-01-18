'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { CONST } from '../config/constants.js';

const LOCAL_CONST = {
  GREEN: [100, 255, 100],
};

/**
 * オートスイッチ（自動スイッチ）
 * ・通電時（制御ソケット）に左右を接続
 * ・非通電時は左右を遮断
 */
export class AutoSwitch extends CircuitPart {
  constructor(id, x, y) {
    super(id, x, y);
    
    // 部品タイプを設定
    this.type = CONST.PART_TYPE.AUTO_SWITCH;
    
    // ソケットを作成
    this.sockets = [
      new Socket(this, 'left', -CONST.PARTS.WIDTH / 2, 0, 'left'),
      new Socket(this, 'right', CONST.PARTS.WIDTH / 2, 0, 'right'),
      new Socket(this, 'control', 0, CONST.PARTS.HEIGHT / 2, 'bottom')
    ];
    
    // オートスイッチは制御入力で動作
    this.isOn = false;
  }

  /**
   * 1秒ごとの状態更新
   */
  onTick() {
    // 制御ソケットが通電していればON
    const controlSocket = this.getSocket('control');
    this.isOn = controlSocket ? controlSocket.isPowered : false;
  }

  /**
   * 部品の形を描画
   */
  drawShape(color) {
    // 外枠
    super.drawShape(color);
    
    // T字型の内部図形
    noStroke();
    fill(LOCAL_CONST.GREEN);
    rectMode(CENTER);
    // 横棒
    rect(0, -CONST.PARTS.HEIGHT * 0.1, CONST.PARTS.WIDTH * 0.5, CONST.PARTS.HEIGHT * 0.25);
    // 縦棒
    rect(0, 0, CONST.PARTS.WIDTH * 0.25, CONST.PARTS.HEIGHT * 0.4);
  }
}
