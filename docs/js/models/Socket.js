'use strict';

import { CONST } from '../config/constants.js';

/**
 * ソケットクラス
 * 回路部品の接続ポイントを表現
 */
export class Socket {
  /**
   * @param {CircuitPart} parent - 親となる部品
   * @param {string} name - ソケット名（'left', 'right', 'bottom'など）
   * @param {number} localX - 部品中心からの相対X座標
   * @param {number} localY - 部品中心からの相対Y座標
   * @param {string} direction - ソケットの方向（'left', 'right', 'bottom'）
   */
  constructor(parent, name, localX, localY, direction) {
    this.parent = parent;
    this.name = name;
    this.localX = localX;
    this.localY = localY;
    this.direction = direction;
    this.connectedWires = [];
    this.isPowered = false;
    this.isTargeted = false;
  }

  // ==================== 座標・位置計算 ====================
  
  /**
   * ソケットのワールド座標（絶対座標）を取得
   * @returns {{x: number, y: number}}
   */
  getWorldPosition() {
    return this.parent.localToWorld(this.localX, this.localY);
  }

  /**
   * コネクタ（三角形の頂点）のワールド座標を取得
   * @returns {{x: number, y: number}}
   */
  getConnectorWorldPosition() {
    let offsetX = 0;
    let offsetY = 0;
    
    switch (this.direction) {
      case 'left':
        offsetX = -CONST.PARTS.CONNECTOR_HEIGHT;
        break;
      case 'right':
        offsetX = CONST.PARTS.CONNECTOR_HEIGHT;
        break;
      case 'bottom':
        offsetY = CONST.PARTS.CONNECTOR_HEIGHT;
        break;
    }
    
    return this.parent.localToWorld(this.localX + offsetX, this.localY + offsetY);
  }

  // ==================== 接続管理 ====================
  
  /**
   * ワイヤーを接続
   * @param {Wire} wire
   */
  connectWire(wire) {
    this.connectedWires.push(wire);
  }

  /**
   * ワイヤーを切断
   * @param {Wire} wire
   */
  disconnectWire(wire) {
    const index = this.connectedWires.indexOf(wire);
    if (index > -1) {
      this.connectedWires.splice(index, 1);
    }
  }

  // ==================== マウス・入力処理 ====================
  
  /**
   * マウスがこのソケット上にあるか判定
   * @param {number} mx - マウスX座標（省略時はグローバルmouseX）
   * @param {number} my - マウスY座標（省略時はグローバルmouseY）
   * @returns {boolean}
   */
  isMouseOver(mx, my) {
    // 引数がなければグローバルのmouseXを使う（互換性維持）
    const x = mx !== undefined ? mx : mouseX;
    const y = my !== undefined ? my : mouseY;
    
    const worldPos = this.getConnectorWorldPosition();
    return dist(x, y, worldPos.x, worldPos.y) < CONST.PARTS.SOCKET_HIT_RADIUS;
  }

  // ==================== 描画 ====================
  
  /**
   * ソケットを描画（親の回転座標系の中で呼ばれる）
   * ★修正: worldMouse を受け取るように変更
   * @param {{x: number, y: number}} worldMouse - ワールド座標のマウス位置
   */
  draw(worldMouse) {
    // ソケットの四角を描画
    let rectX, rectY, rectW, rectH, triangleBaseX, triangleBaseY;
    let connectorLocalX = this.localX;
    let connectorLocalY = this.localY;
    
    noStroke();
    let fillColor = this.isPowered ? CONST.COLORS.WIRE_ON : CONST.COLORS.OFF_STATE;
    fill(...fillColor);
    
    switch (this.direction) {
      case 'left':
        rectX = this.localX - CONST.PARTS.SOCKET_HEIGHT - CONST.PARTS.STROKE_WEIGHT / 2;
        rectY = this.localY - CONST.PARTS.SOCKET_WIDTH / 2;
        rectW = CONST.PARTS.SOCKET_HEIGHT;
        rectH = CONST.PARTS.SOCKET_WIDTH;
        triangleBaseX = rectX;
        connectorLocalX = this.localX - CONST.PARTS.CONNECTOR_HEIGHT;
        break;
        
      case 'right':
        rectX = this.localX + CONST.PARTS.STROKE_WEIGHT / 2;
        rectY = this.localY - CONST.PARTS.SOCKET_WIDTH / 2;
        rectW = CONST.PARTS.SOCKET_HEIGHT;
        rectH = CONST.PARTS.SOCKET_WIDTH;
        triangleBaseX = rectX + CONST.PARTS.SOCKET_HEIGHT;
        connectorLocalX = this.localX + CONST.PARTS.CONNECTOR_HEIGHT;
        break;
        
      case 'bottom':
        rectX = this.localX - CONST.PARTS.SOCKET_WIDTH / 2;
        rectY = this.localY + CONST.PARTS.STROKE_WEIGHT / 2;
        rectW = CONST.PARTS.SOCKET_WIDTH;
        rectH = CONST.PARTS.SOCKET_HEIGHT;
        triangleBaseY = rectY + CONST.PARTS.SOCKET_HEIGHT;
        connectorLocalY = this.localY + CONST.PARTS.CONNECTOR_HEIGHT;
        break;
        
      case 'center':
        // ジョイント用: 基部の四角は描かず、丸だけ描画
        rectX = this.localX - CONST.PARTS.JOINT_RADIUS;
        rectY = this.localY - CONST.PARTS.JOINT_RADIUS;
        rectW = CONST.PARTS.JOINT_RADIUS * 2;
        rectH = CONST.PARTS.JOINT_RADIUS * 2;
        connectorLocalX = this.localX;
        connectorLocalY = this.localY;
        break;
    }
    
    // 1. ソケット基部（四角形）を描画
    // rectMode(CORNER)で描画（座標は左上隅）
    // centerの場合は基部を描画しない
    if (this.direction !== 'center') {
      rectMode(CORNER);
      rect(rectX, rectY, rectW, rectH);
    }
    
    // 2. コネクタ（三角形・丸）の描画判定
    // ★修正: worldMouse が渡されていれば座標を取り出し、isMouseOver に渡す
    const mx = worldMouse ? worldMouse.x : undefined;
    const my = worldMouse ? worldMouse.y : undefined;
    const isHovered = this.isMouseOver(mx, my);
    const hasWire = this.connectedWires.length > 0;
    const isWiringStart = this.parent.wiringStartSocket === this.name;
    const showTempSocket = isHovered || isWiringStart || this.isTargeted;
    
    // centerの場合は常時表示、それ以外は従来通り
    if (showTempSocket || hasWire || this.direction === 'center') {
      
      // ホバー時かつ未接続の場合は、一時的な色（赤半透明）で描画
      if (showTempSocket && !hasWire) {
        fillColor = [...CONST.COLORS.WIRE_TEMP, CONST.WIRE.TEMP_ALPHA];
      }
      
      noStroke();
      fill(...fillColor);
      
      // 三角形を描画（centerの場合は三角形なし）
      if (this.direction !== 'center') {
        switch (this.direction) {
          case 'left':
            triangle(
              connectorLocalX - CONST.PARTS.CONNECTOR_RADIUS, connectorLocalY,
              triangleBaseX, this.localY - CONST.PARTS.SOCKET_WIDTH / 2,
              triangleBaseX, this.localY + CONST.PARTS.SOCKET_WIDTH / 2
            );
            break;
            
          case 'right':
            triangle(
              connectorLocalX + CONST.PARTS.CONNECTOR_RADIUS, connectorLocalY,
              triangleBaseX, this.localY - CONST.PARTS.SOCKET_WIDTH / 2,
              triangleBaseX, this.localY + CONST.PARTS.SOCKET_WIDTH / 2
            );
            break;
            
          case 'bottom':
            triangle(
              this.localX, connectorLocalY + CONST.PARTS.CONNECTOR_RADIUS,
              this.localX - CONST.PARTS.SOCKET_WIDTH / 2, triangleBaseY,
              this.localX + CONST.PARTS.SOCKET_WIDTH / 2, triangleBaseY
            );
            break;
        }
      }
      
      // 丸を描画（centerの場合はJOINT_RADIUSを使用）
      const radius = (this.direction === 'center') 
                     ? CONST.PARTS.JOINT_RADIUS 
                     : CONST.PARTS.CONNECTOR_RADIUS * 2;
      circle(connectorLocalX, connectorLocalY, radius);
    }
  }
}
