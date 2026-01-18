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
   * 本体の描画
   * 通常は描画しませんが、マウスホバー時に「移動ハンドル」を表示します
   * ★変更: worldMouse引数を受け取る
   */
  drawShape(color, worldMouse) {
    // マウスが左上の「隠し判定」に乗っているか、またはドラッグ中か
    // ★変更: ワールド座標を使って判定
    const mx = worldMouse ? worldMouse.x : undefined;
    const my = worldMouse ? worldMouse.y : undefined;
    
    const isHovered = this.isMouseOver(mx, my);

    if (isHovered || this.isDragging) {
      // 親のdraw()ですでに中心へtranslateされているので、
      // 左上の座標は (-幅/2, -高さ/2) になります
      const handleX = -CONST.PARTS.WIDTH / 2;
      const handleY = -CONST.PARTS.HEIGHT / 2;
      const handleSize = 24; // 少し大きくして見やすく

      push();
      // 1. ハンドルの背景（半透明の青）
      noStroke();
      fill(60, 110, 255, 230); // 濃いめにしてアイコンを目立たせる
      circle(handleX, handleY, handleSize);

      // 2. 移動アイコン（上下左右の矢印）
      stroke(255);
      strokeWeight(1.5);
      noFill();
      strokeCap(ROUND);
      strokeJoin(ROUND);

      const d = 9;  // 中心からの軸の長さ
      const s = 3;  // 矢印の羽のサイズ

      // 軸を描画（十字）
      line(handleX - d, handleY, handleX + d, handleY); // 横軸
      line(handleX, handleY - d, handleX, handleY + d); // 縦軸

      // 4方向の矢印の先端を描画
      // 左
      line(handleX - d, handleY, handleX - d + s, handleY - s);
      line(handleX - d, handleY, handleX - d + s, handleY + s);
      // 右
      line(handleX + d, handleY, handleX + d - s, handleY - s);
      line(handleX + d, handleY, handleX + d - s, handleY + s);
      // 上
      line(handleX, handleY - d, handleX - s, handleY - d + s);
      line(handleX, handleY - d, handleX + s, handleY - d + s);
      // 下
      line(handleX, handleY + d, handleX - s, handleY + d - s);
      line(handleX, handleY + d, handleX + s, handleY + d - s);
      
      pop();
    }
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
