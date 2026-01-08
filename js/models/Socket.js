'use strict';

import { APP_CONFIG } from '../config/constants.js';

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
  }

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
        offsetX = -APP_CONFIG.PARTS.CONNECTOR_HEIGHT;
        break;
      case 'right':
        offsetX = APP_CONFIG.PARTS.CONNECTOR_HEIGHT;
        break;
      case 'bottom':
        offsetY = APP_CONFIG.PARTS.CONNECTOR_HEIGHT;
        break;
    }
    
    return this.parent.localToWorld(this.localX + offsetX, this.localY + offsetY);
  }

  /**
   * マウスがこのソケット上にあるか判定
   * @returns {boolean}
   */
  isMouseOver() {
    const worldPos = this.getConnectorWorldPosition();
    return dist(mouseX, mouseY, worldPos.x, worldPos.y) < APP_CONFIG.PARTS.SOCKET_HIT_RADIUS;
  }

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

  /**
   * ソケットを描画（親の回転座標系の中で呼ばれる）
   */
  draw() {
    // ソケットの四角を描画
    let rectX, rectY, rectW, rectH, triangleBaseX, triangleBaseY;
    let connectorLocalX = this.localX;
    let connectorLocalY = this.localY;
    
    noStroke();
    fill(APP_CONFIG.COLORS.OFF_STATE);
    
    switch (this.direction) {
      case 'left':
        rectX = this.localX - APP_CONFIG.PARTS.SOCKET_HEIGHT - APP_CONFIG.PARTS.STROKE_WIDTH / 2;
        rectY = this.localY - APP_CONFIG.PARTS.SOCKET_WIDTH / 2;
        rectW = APP_CONFIG.PARTS.SOCKET_HEIGHT;
        rectH = APP_CONFIG.PARTS.SOCKET_WIDTH;
        triangleBaseX = rectX;
        connectorLocalX = this.localX - APP_CONFIG.PARTS.CONNECTOR_HEIGHT;
        break;
        
      case 'right':
        rectX = this.localX + APP_CONFIG.PARTS.STROKE_WIDTH / 2;
        rectY = this.localY - APP_CONFIG.PARTS.SOCKET_WIDTH / 2;
        rectW = APP_CONFIG.PARTS.SOCKET_HEIGHT;
        rectH = APP_CONFIG.PARTS.SOCKET_WIDTH;
        triangleBaseX = rectX + APP_CONFIG.PARTS.SOCKET_HEIGHT;
        connectorLocalX = this.localX + APP_CONFIG.PARTS.CONNECTOR_HEIGHT;
        break;
        
      case 'bottom':
        rectX = this.localX - APP_CONFIG.PARTS.SOCKET_WIDTH / 2;
        rectY = this.localY + APP_CONFIG.PARTS.STROKE_WIDTH / 2;
        rectW = APP_CONFIG.PARTS.SOCKET_WIDTH;
        rectH = APP_CONFIG.PARTS.SOCKET_HEIGHT;
        triangleBaseY = rectY + APP_CONFIG.PARTS.SOCKET_HEIGHT;
        connectorLocalY = this.localY + APP_CONFIG.PARTS.CONNECTOR_HEIGHT;
        break;
    }
    
    // rectMode(CORNER)で描画（座標は左上隅）
    rectMode(CORNER);
    rect(rectX, rectY, rectW, rectH);
    
    // ホバー時、ワイヤー接続時、またはワイヤードラッグ開始点の場合はコネクタを描画
    const isHovered = this.isMouseOver();
    const hasWire = this.connectedWires.length > 0;
    const isWiringStart = this.parent.wiringStartSocket === this.name;
    
    if (isHovered || hasWire || isWiringStart) {
      // 色を決定
      let fillColor;
      if ((isHovered || isWiringStart) && !hasWire) {
        fillColor = [...APP_CONFIG.COLORS.WIRE_TEMP, APP_CONFIG.WIRE.TEMP_ALPHA];
      } else {
        const stateColor = this.isPowered ? APP_CONFIG.COLORS.ON_STATE : APP_CONFIG.COLORS.OFF_STATE;
        fillColor = stateColor;
      }
      
      noStroke();
      fill(...fillColor);
      
      // 三角形を描画
      switch (this.direction) {
        case 'left':
          triangle(
            connectorLocalX - APP_CONFIG.PARTS.CONNECTOR_RADIUS, connectorLocalY,
            triangleBaseX, this.localY - APP_CONFIG.PARTS.SOCKET_WIDTH / 2,
            triangleBaseX, this.localY + APP_CONFIG.PARTS.SOCKET_WIDTH / 2
          );
          break;
          
        case 'right':
          triangle(
            connectorLocalX + APP_CONFIG.PARTS.CONNECTOR_RADIUS, connectorLocalY,
            triangleBaseX, this.localY - APP_CONFIG.PARTS.SOCKET_WIDTH / 2,
            triangleBaseX, this.localY + APP_CONFIG.PARTS.SOCKET_WIDTH / 2
          );
          break;
          
        case 'bottom':
          triangle(
            this.localX, connectorLocalY + APP_CONFIG.PARTS.CONNECTOR_RADIUS,
            this.localX - APP_CONFIG.PARTS.SOCKET_WIDTH / 2, triangleBaseY,
            this.localX + APP_CONFIG.PARTS.SOCKET_WIDTH / 2, triangleBaseY
          );
          break;
      }
      
      // 丸を描画
      circle(connectorLocalX, connectorLocalY, APP_CONFIG.PARTS.CONNECTOR_RADIUS * 2);
    }
  }
}
