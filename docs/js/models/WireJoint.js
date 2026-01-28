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

  // ==================== ライフサイクル ====================
  
  /**
   * 更新処理なし
   */
  update() {}
  
  /**
   * ティック処理なし
   */
  onTick() {}

  // ==================== インタラクション ====================
  
  /**
   * 操作不能にする（Jointは単なる接続点のため）
   */
  interact() {}

  // ==================== マウス・入力処理 ====================
  
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
   * 回転ハンドルの当たり判定も無効化
   * これをしないと、見えないハンドルを誤って掴んでしまう可能性があります
   */
  isMouseOverRotationHandle(mx, my) {
    return false;
  }

  // ==================== 描画 ====================

  /**
   * 本体の描画
   * 通常は描画しませんが、マウスホバー時に「移動ハンドル」を表示します
   * @param {Array} color - 枠線の色（未使用）
   * @param {{x: number, y: number}} worldMouse - ワールド座標のマウス位置
   * @param {Object} visibilityRules - 可視性ルール
   */
  drawShape(color, worldMouse, visibilityRules = {}) {
    const mx = worldMouse ? worldMouse.x : undefined;
    const my = worldMouse ? worldMouse.y : undefined;
    const isHovered = this.isMouseOver(mx, my);

    // 自分がドラッグ中なら強制表示
    if (this.isDragging) {
      this.drawMoveHandle();
      return;
    }

    // それ以外は、ホバー中 AND ルールで許可されている場合のみ表示
    if (isHovered && visibilityRules.showJointHandles) {
      this.drawMoveHandle();
    }
  }

  /**
   * 移動ハンドルの描画（共通化）
   */
  drawMoveHandle() {
    const handleX = -CONST.PARTS.WIDTH / 2;
    const handleY = -CONST.PARTS.HEIGHT / 2;
    const handleSize = CONST.PARTS.JOINT_HANDLE_RADIUS * 2;

    push();
    noStroke();
    fill(60, 110, 255, 230);
    circle(handleX, handleY, handleSize);

    stroke(255);
    strokeWeight(1.5);
    noFill();
    strokeCap(ROUND);
    strokeJoin(ROUND);

    const d = 9;
    const s = 3;

    line(handleX - d, handleY, handleX + d, handleY);
    line(handleX, handleY - d, handleX, handleY + d);

    line(handleX - d, handleY, handleX - d + s, handleY - s);
    line(handleX - d, handleY, handleX - d + s, handleY + s);
    line(handleX + d, handleY, handleX + d - s, handleY - s);
    line(handleX + d, handleY, handleX + d - s, handleY + s);
    line(handleX, handleY - d, handleX - s, handleY - d + s);
    line(handleX, handleY - d, handleX + s, handleY - d + s);
    line(handleX, handleY + d, handleX - s, handleY + d - s);
    line(handleX, handleY + d, handleX + s, handleY + d - s);
    
    pop();
  }

  /**
   * 回転ハンドルは表示しない（Jointは回転不要なため）
   */
  drawRotationHandle() {
    // 何もしない（空実装）
  }
}
