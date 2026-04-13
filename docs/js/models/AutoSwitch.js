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
    // ★リファクタリング: this.width / this.height を使用
    this.sockets = [
      new Socket(this, 'left', -this.width / 2, 0, 'left'),
      new Socket(this, 'right', this.width / 2, 0, 'right'),
      new Socket(this, 'control', 0, this.height / 2, 'bottom')
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
    // ★リファクタリング: this.width / this.height を使用
    noStroke();
    fill(LOCAL_CONST.GREEN);
    rectMode(CENTER);
    // 横棒
    rect(0, -this.height * 0.1, this.width * 0.5, this.height * 0.25);
    // 縦棒
    rect(0, 0, this.width * 0.25, this.height * 0.4);
  }
}
