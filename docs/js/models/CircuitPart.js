'use strict';

import { CONST } from '../config/constants.js';

/**
 * 回路部品の基底クラス
 * すべての回路部品はこのクラスを継承する
 */
export class CircuitPart {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.isDragging = false;
    this.offsetX = 0;
    this.offsetY = 0;
    
    // ドラッグ判定用の初期位置
    this.dragStartX = 0;
    this.dragStartY = 0;

    // 回転関連
    this.rotation = 0;  // ラジアン単位
    this.isRotating = false;
    this.rotationStartAngle = 0;

    // ソケット配列（子クラスで初期化する）
    this.sockets = [];
    
    // ワイヤリング開始ソケット名（一時的なマーカー）
    this.wiringStartSocket = null;

    this.isHighlighted = false;
  }

  /**
   * 部品の中心座標を取得する
   * @returns {{x: number, y: number}} 中心座標
   */
  getCenter() {
    return {
      x: this.x + CONST.PARTS.WIDTH / 2,
      y: this.y + CONST.PARTS.HEIGHT / 2
    };
  }

  /**
   * ローカル座標（部品中心からの相対位置）をワールド座標（画面上の絶対位置）に変換
   * @param {number} localX - ローカルX座標
   * @param {number} localY - ローカルY座標
   * @returns {{x: number, y: number}} ワールド座標
   */
  localToWorld(localX, localY) {
    // 1. 回転を適用
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const rotatedX = localX * cos - localY * sin;
    const rotatedY = localX * sin + localY * cos;
    
    // 2. 平行移動を適用
    const center = this.getCenter();
    return {
      x: center.x + rotatedX,
      y: center.y + rotatedY
    };
  }

  /**
   * ワールド座標をローカル座標に変換（当たり判定などに使用）
   * @param {number} worldX - ワールドX座標
   * @param {number} worldY - ワールドY座標
   * @returns {{x: number, y: number}} ローカル座標
   */
  worldToLocal(worldX, worldY) {
    const center = this.getCenter();
    
    // 1. 平行移動の逆
    const dx = worldX - center.x;
    const dy = worldY - center.y;
    
    // 2. 回転の逆（角度をマイナスにする）
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    
    return {
      x: dx * cos - dy * sin,
      y: dx * sin + dy * cos
    };
  }

  /**
   * 回転ハンドルの座標を取得する（部品の回転に追従）
   * @returns {{x: number, y: number}} 回転ハンドルの座標
   */
  getRotationHandlePos() {
    const distance = CONST.PARTS.ROTATION_HANDLE_DISTANCE;
    return this.localToWorld(0, -distance);
  }

  /**
   * マウスが回転ハンドル上にあるか判定
   * @returns {boolean}
   */
  isMouseOverRotationHandle() {
    const handlePos = this.getRotationHandlePos();
    const distance = dist(mouseX, mouseY, handlePos.x, handlePos.y);
    return distance < CONST.PARTS.ROTATION_HANDLE_HIT_RADIUS;
  }

  /**
   * 名前でソケットを取得
   * @param {string} socketName
   * @returns {Socket|null}
   */
  getSocket(socketName) {
    return this.sockets.find(s => s.name === socketName) || null;
  }

  /**
   * ソケットの通電状態をリセットする
   */
  resetPowerState() {
    for (let socket of this.sockets) {
      socket.isPowered = false;
    }
  }

  /**
   * 指定されたソケットに電気を流す
   * @param {string} socketName - ソケット名
   */
  setPowered(socketName, powered = true) {
    const socket = this.getSocket(socketName);
    if (socket) {
      socket.isPowered = powered;
    }
  }

  /**
   * 指定されたソケットが通電しているか確認
   * @param {string} socketName - ソケット名
   * @returns {boolean}
   */
  isPoweredAt(socketName) {
    const socket = this.getSocket(socketName);
    return socket ? socket.isPowered : false;
  }

  /**
   * ソケットにワイヤーを接続する
   * @param {string} socketName - ソケット名
   * @param {Wire} wire - 接続するワイヤー
   */
  connectWire(socketName, wire) {
    const socket = this.getSocket(socketName);
    if (socket) {
      socket.connectWire(wire);
    }
  }

  /**
   * ソケットからワイヤーを切断する
   * @param {string} socketName - ソケット名
   * @param {Wire} wire - 切断するワイヤー
   */
  disconnectWire(socketName, wire) {
    const socket = this.getSocket(socketName);
    if (socket) {
      socket.disconnectWire(wire);
    }
  }

  /**
   * マウスが乗っているソケットを探す
   * @param {number} mx - マウスX座標（省略時はグローバルmouseX）
   * @param {number} my - マウスY座標（省略時はグローバルmouseY）
   * @returns {Socket|null}
   */
  getHoveredSocket(mx, my) {
    // 引数がなければグローバルのmouseXを使う（互換性維持）
    const x = mx !== undefined ? mx : mouseX;
    const y = my !== undefined ? my : mouseY;
    
    for (let socket of this.sockets) {
      if (socket.isMouseOver(x, y)) {
        return socket;
      }
    }
    return null;
  }

  /**
   * ユーザーがクリックした時の処理（抽象メソッド）
   */
  interact() {
    console.log(`Part ${this.id}: 触られました`);
  }
  
  /**
   * 毎フレームの更新処理（アニメーションや時間経過用）
   * デフォルトでは何もしない（子クラスで必要なら上書きする）
   */
  update() {}

  /**
   * 1秒ごとの論理更新処理（回路シミュレーション用）
   * デフォルトでは何もしない（子クラスで必要なら上書きする）
   */
  onTick() {}

  /**
   * マウスがこの部品の上にあるか判定（簡易版・バウンディングボックス）
   * @param {number} mx - マウスX座標（省略時はグローバルmouseX）
   * @param {number} my - マウスY座標（省略時はグローバルmouseY）
   * @returns {boolean}
   */
  isMouseOver(mx, my) {
    // 引数がなければグローバルのmouseXを使う（互換性維持）
    const x = mx !== undefined ? mx : mouseX;
    const y = my !== undefined ? my : mouseY;
    
    // 簡易的な矩形判定（回転を考慮しない）
    return (x > this.x && x < this.x + CONST.PARTS.WIDTH &&
            y > this.y && y < this.y + CONST.PARTS.HEIGHT);
  }

  /**
   * マウスボタンを押した時の処理（回転モード）
   * @param {number} mx - マウスX座標（省略時はグローバルmouseX）
   * @param {number} my - マウスY座標（省略時はグローバルmouseY）
   */
  onRotationMouseDown(mx, my) {
    // 引数がなければグローバルのmouseXを使う（互換性維持）
    const x = mx !== undefined ? mx : mouseX;
    const y = my !== undefined ? my : mouseY;
    
    this.isRotating = true;
    const center = this.getCenter();
    this.rotationStartAngle = Math.atan2(y - center.y, x - center.x) - this.rotation;
  }

  /**
   * マウスをドラッグしている時の回転処理
   * @param {boolean} snapEnabled - 90度スナップを有効にするか
   * @param {number} mx - マウスX座標（省略時はグローバルmouseX）
   * @param {number} my - マウスY座標（省略時はグローバルmouseY）
   */
  onRotationMouseDragged(snapEnabled = false, mx, my) {
    if (this.isRotating) {
      const x = mx !== undefined ? mx : mouseX;
      const y = my !== undefined ? my : mouseY;
      
      const center = this.getCenter();
      const currentAngle = Math.atan2(y - center.y, x - center.x);
      let rotation = currentAngle - this.rotationStartAngle;
      
      // ラジアンを度数に変換
      let degrees = rotation * 180 / PI;
      
      if (snapEnabled) {
        // 90度スナップが有効な場合
        degrees = Math.round(degrees / 90) * 90;
      } else {
        // 90度スナップが無効な場合は5度単位でスナップ
        degrees = Math.round(degrees / 5) * 5;
      }
      
      // 度数をラジアンに戻す
      rotation = degrees * PI / 180;
      
      this.rotation = rotation;
    }
  }

  /**
   * 回転モードを終了
   */
  onRotationMouseUp() {
    this.isRotating = false;
  }

  /**
   * マウスボタンを押した時の処理
   * @param {number} mx - マウスX座標（省略時はグローバルmouseX）
   * @param {number} my - マウスY座標（省略時はグローバルmouseY）
   */
  onMouseDown(mx, my) {
    // 引数がなければグローバルのmouseXを使う（互換性維持）
    const x = mx !== undefined ? mx : mouseX;
    const y = my !== undefined ? my : mouseY;
    
    this.isDragging = true;
    this.offsetX = this.x - x;
    this.offsetY = this.y - y;
    
    this.dragStartX = this.x;
    this.dragStartY = this.y;
  }

  /**
   * マウスが回転ハンドル上にあるか判定
   * @param {number} mx - マウスX座標（省略時はグローバルmouseX）
   * @param {number} my - マウスY座標（省略時はグローバルmouseY）
   * @returns {boolean}
   */
  isMouseOverRotationHandle(mx, my) {
    // 引数がなければグローバルのmouseXを使う（互換性維持）
    const x = mx !== undefined ? mx : mouseX;
    const y = my !== undefined ? my : mouseY;
    
    const handlePos = this.getRotationHandlePos();
    const distance = dist(x, y, handlePos.x, handlePos.y);
    return distance < CONST.PARTS.ROTATION_HANDLE_HIT_RADIUS;
  }

  /**
   * マウスをドラッグしている時の処理
   */
  onMouseDragged(mx, my) {
    if (this.isDragging) {
      const x = mx !== undefined ? mx : mouseX;
      const y = my !== undefined ? my : mouseY;
      this.x = x + this.offsetX;
      this.y = y + this.offsetY;
    }
  }

  /**
   * マウスボタンを離した時の処理
   */
  onMouseUp() {
    this.isDragging = false;
  }
  
  /**
   * 実際にドラッグ（移動）が発生したかを判定
   * @param {number} threshold - 移動判定のしきい値（ピクセル）
   * @returns {boolean}
   */
  wasDragged(threshold = 5) {
    const dx = Math.abs(this.x - this.dragStartX);
    const dy = Math.abs(this.y - this.dragStartY);
    return dx > threshold || dy > threshold;
  }
  
  /**
   * 描画処理
   */
  draw() {
    // 部品の状態と通電状態で色を判定
    let isPoweredAtLeftOrRight = false;
    const leftSocket = this.getSocket('left');
    const rightSocket = this.getSocket('right');
    if (leftSocket?.isPowered || rightSocket?.isPowered) {
      isPoweredAtLeftOrRight = true;
    }
    
    const color = (this.isOn && isPoweredAtLeftOrRight) ? 
      CONST.COLORS.ON_STATE : CONST.COLORS.OFF_STATE;
    
    // 回転座標系で描画
    push();
    const center = this.getCenter();
    translate(center.x, center.y);
    rotate(this.rotation);
    
    // 部品本体を描画（原点中心）
    this.drawShape(color);
    
    // ソケットを描画
    for (let socket of this.sockets) {
      socket.draw();
    }

    // ハイライト時は、その上から「半透明の赤」を重ねる
    if (this.isHighlighted) {
      this.drawHighlight();
    }
    
    pop();
    
    // 回転ハンドルを描画（回転の外で）
    if (this.isMouseOverRotationHandle() || this.isRotating) {
      this.drawRotationHandle();
    }
  }

  /**
   * 部品の形を描画（子クラスでオーバーライド可能）
   * @param {Array} color - 枠線の色
   */
  drawShape(color) {
    stroke(...color);
    strokeWeight(CONST.PARTS.STROKE_WEIGHT);
    fill(CONST.COLORS.BACKGROUND);
    rectMode(CENTER);
    rect(0, 0, CONST.PARTS.WIDTH, CONST.PARTS.HEIGHT, 8);
  }

  /**
   * 削除ハイライトを描画（デフォルトは四角）
   * 形を変えたいパーツは、このメソッドをオーバーライドしてください
   */
  drawHighlight() {
    // stroke(...CONST.DELETE_MODE.HIGHLIGHT_COLOR)
    // strokeWeight(4);
    noStroke();
    // 定数から赤色を取得し、透明度(100)を追加
    fill(...CONST.DELETE_MODE.HIGHLIGHT_COLOR, 100);
    rectMode(CENTER);
    // デフォルト: パーツと同じサイズ・同じ角丸(8)で覆う
    rect(0, 0, CONST.PARTS.WIDTH*1.5, CONST.PARTS.HEIGHT*1.5, 12);
  }

  /**
   * 回転ハンドルを描画
   */
  drawRotationHandle() {
    const handlePos = this.getRotationHandlePos();
    const isHovered = this.isMouseOverRotationHandle();
    
    // ハンドルの円
    noStroke();
    fill(isHovered ? [100, 150, 255, 200] : [150, 150, 150, 150]);
    circle(handlePos.x, handlePos.y, CONST.PARTS.ROTATION_HANDLE_RADIUS * 2);
    
    // 回転マーク（円形矢印）
    push();
    translate(handlePos.x, handlePos.y);
    
    noFill();
    stroke(isHovered ? [255, 255, 255] : [200, 200, 200]);
    strokeWeight(2);
    arc(0, 0, CONST.PARTS.ROTATION_HANDLE_RADIUS * 1.2, 
        CONST.PARTS.ROTATION_HANDLE_RADIUS * 1.2, 
        -PI * 0.75, PI * 0.75);
    
    const arrowSize = 4;
    const arrowAngle = PI * 0.75;
    const radius = CONST.PARTS.ROTATION_HANDLE_RADIUS * 0.6;
    const arrowX = radius * Math.cos(arrowAngle);
    const arrowY = radius * Math.sin(arrowAngle);
    
    fill(isHovered ? [255, 255, 255] : [200, 200, 200]);
    noStroke();
    triangle(arrowX, arrowY,
             arrowX - arrowSize * Math.cos(arrowAngle + PI / 4),
             arrowY - arrowSize * Math.sin(arrowAngle + PI / 4),
             arrowX - arrowSize * Math.cos(arrowAngle - PI / 4),
             arrowY - arrowSize * Math.sin(arrowAngle - PI / 4));
    
    pop();
  }
}
