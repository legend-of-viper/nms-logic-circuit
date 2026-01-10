'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { CONST } from '../config/constants.js';

const LOCAL_CONST = {
  GREEN: [100, 255, 100],
  RED: [255, 50, 50],
};

/**
 * インバーター（自動遮断スイッチ）
 * ・制御入力（ボトム）がない時：左右を接続（ON）
 * ・制御入力（ボトム）がある時：左右を遮断（OFF）
 * * AutoSwitch（A接点）とは逆の、B接点のような挙動をする
 */
export class Inverter extends CircuitPart {
  constructor(id, x, y) {
    super(id, x, y);
    
    // 初期状態は「制御入力なし」なので ON（接続状態）
    this.isOn = true; 
    
    // ソケットを作成
    this.sockets = [
      new Socket(this, 'left', -CONST.PARTS.WIDTH / 2, 0, 'left'),
      new Socket(this, 'right', CONST.PARTS.WIDTH / 2, 0, 'right'),
      new Socket(this, 'control', 0, CONST.PARTS.HEIGHT / 2, 'bottom')
    ];
  }
  
  /**
   * ユーザー操作
   * 自動で切り替わるため、クリックでの操作はなし
   */
  interact() {
    // 何もしない
  }
  
  /**
   * 状態更新
   * 制御ソケット（bottom）に通電しているかチェック
   */
  updateLogic() {
    const controlSocket = this.getSocket('control');
    
    // 制御入力があれば OFF（遮断）、なければ ON（接続）
    this.isOn = controlSocket ? !controlSocket.isPowered : true;
  }

  /**
   * 描画処理
   */
  drawBody(color) {
    // 外枠
    super.drawBody(color);
    
    // インバーターを表現する図形（縦に2本の線：左が赤、右が緑）
    const height = CONST.PARTS.HEIGHT * 0.5;
    const spacing = CONST.PARTS.WIDTH * 0.2;
    const lineWeight = CONST.PARTS.WIDTH * 0.15;

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