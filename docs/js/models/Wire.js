'use strict';

import { CONST } from '../config/constants.js';

/**
 * ワイヤークラス
 * ソケット同士の接続を保持し、描画する
 */
export class Wire {
  /**
   * @param {Socket} startSocket - 開始ソケット
   * @param {Socket} endSocket - 終了ソケット
   */
  constructor(startSocket, endSocket) {
    this.startSocket = startSocket;
    this.endSocket = endSocket;
    
    // 両端のソケットのconnectedWires配列に自分を登録
    this.startSocket.connectWire(this);
    this.endSocket.connectWire(this);

    this.isHighlighted = false;
  }

  // ==================== ヘルパー ====================
  
  /**
   * このワイヤーの反対側の端点を取得
   * @param {Socket} socket - 基準となるソケット
   * @returns {Socket|null} 反対側のソケット、または null
   */
  getOtherEnd(socket) {
    if (socket === this.startSocket) {
      return this.endSocket;
    } else if (socket === this.endSocket) {
      return this.startSocket;
    }
    return null;
  }

  /**
   * 点から線分までの最短距離を計算
   * @param {number} px - 点のX座標
   * @param {number} py - 点のY座標
   * @param {number} x1 - 線分の始点X
   * @param {number} y1 - 線分の始点Y
   * @param {number} x2 - 線分の終点X
   * @param {number} y2 - 線分の終点Y
   * @returns {number} 点から線分までの距離
   */
  pointToLineDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    
    // 線分の長さが0の場合（始点と終点が同じ）
    if (lengthSquared === 0) {
      return dist(px, py, x1, y1);
    }
    
    // 線分上の最近接点のパラメータt（0～1）を計算
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t)); // 0～1の範囲にクランプ
    
    // 最近接点の座標
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    
    // 点と最近接点の距離を返す
    return dist(px, py, closestX, closestY);
  }

  // ==================== マウス・入力処理 ====================
  
  /**
   * マウスがワイヤー上にあるかチェック
   * @param {number} mx - マウスのX座標
   * @param {number} my - マウスのY座標
   * @param {number} threshold - 判定の閾値（デフォルト: 8ピクセル）
   * @returns {boolean} ワイヤー上にマウスがあればtrue
   */
  isMouseOver(mx, my, threshold = 8) {
    const start = this.startSocket.getConnectorWorldPosition();
    const end = this.endSocket.getConnectorWorldPosition();
    
    // 点と線分の距離を計算
    const distance = this.pointToLineDistance(mx, my, start.x, start.y, end.x, end.y);
    
    return distance < threshold;
  }

  // ==================== 描画 ====================
  
  /**
   * ワイヤーを描画
   */
  draw() {
    const start = this.startSocket.getConnectorWorldPosition();
    const end = this.endSocket.getConnectorWorldPosition();

    noFill();
    
    // どちらかのソケットが通電していれば、ワイヤーも通電色にする
    const isPowered = this.startSocket.isPowered || this.endSocket.isPowered;
    const color = isPowered ? CONST.COLORS.WIRE_ON : CONST.COLORS.OFF_STATE;
    
    stroke(...color);
    strokeWeight(CONST.WIRE.STROKE_WEIGHT);
    
    line(start.x, start.y, end.x, end.y);

    // 2. ★追加: ハイライト時は、その上から「半透明の赤」を「太め」に重ねる
    if (this.isHighlighted) {
      // ハイライト色は定数から取得し、透明度(100/255)を追加
      const highlightColor = [...CONST.DELETE_MODE.HIGHLIGHT_COLOR, 100];
      
      stroke(...highlightColor);
      
      // 元の線より少し太くして「覆っている」感を出す (+6px程度)
      strokeWeight(CONST.WIRE.STROKE_WEIGHT + 6);
      
      // 同じ座標に重ね描き
      line(start.x, start.y, end.x, end.y);
    }
  }
}
