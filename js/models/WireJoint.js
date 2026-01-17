'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { CONST } from '../config/constants.js';

/**
 * ワイヤージョイントクラス
 * ワイヤーの中継点として機能する極小のパーツ
 */
export class WireJoint extends CircuitPart {
  constructor(id, x, y) {
    super(id, x, y);
    this.type = CONST.PART_TYPE.JOINT;
    
    // ソケットを1つだけ作成（中心位置、方向は 'center'）
    this.sockets = [
      new Socket(this, 'center', 0, 0, 'center')
    ];
  }

  /**
   * 操作不能にする（Jointは単なる接続点のため）
   */
  interact() {}
  
  /**
   * 更新処理なし
   */
  update() {}
  
  /**
   * ティック処理なし
   */
  onTick() {}

  /**
   * 本体の描画（何も描画しない）
   * ソケット自体が描画されるので、本体の四角い枠は不要
   */
  drawShape(color) {
    // 空実装
  }
  
  /**
   * 当たり判定を小さく上書き
   * @param {number} mx - マウスX座標
   * @param {number} my - マウスY座標
   * @returns {boolean}
   */
  isMouseOver(mx, my) {
    const x = mx !== undefined ? mx : mouseX;
    const y = my !== undefined ? my : mouseY;
    return dist(x, y, this.x, this.y) < CONST.PARTS.JOINT_HIT_RADIUS;
  }

  /**
   * 回転ハンドルは表示しない（Jointは回転不要なため）
   */
  drawRotationHandle() {
    // 何もしない（空実装）
  }

  /**
   * 回転ハンドルの当たり判定も無効化
   * これをしないと、見えないハンドルを誤って掴んでしまう可能性があります
   */
  isMouseOverRotationHandle(mx, my) {
    return false;
  }
}
