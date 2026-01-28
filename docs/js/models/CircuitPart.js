'use strict';

import { CONST } from '../config/constants.js';
import { SmoothValue, SmoothRotation } from '../utils/Animator.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * 回路部品の基底クラス
 * すべての回路部品はこのクラスを継承する
 */
export class CircuitPart {
  constructor(id, x, y) {
    this.id = id;
    
    // ★リファクタリング: アニメーション対応の座標管理
    this.posX = new SmoothValue(x, CONST.ANIMATION.MOVE_SPEED, CONST.ANIMATION.MOVE_SNAP_THRESHOLD);
    this.posY = new SmoothValue(y, CONST.ANIMATION.MOVE_SPEED, CONST.ANIMATION.MOVE_SNAP_THRESHOLD);
    
    this.isDragging = false;
    this.offsetX = 0;
    this.offsetY = 0;
    
    // ドラッグ判定用の初期位置
    this.dragStartX = 0;
    this.dragStartY = 0;

    // ★リファクタリング: アニメーション対応の回転管理
    this.rot = new SmoothRotation(0, CONST.ANIMATION.ROTATION_SPEED, CONST.ANIMATION.ROTATION_SNAP_THRESHOLD);
    
    this.isRotating = false;
    this.rotationStartAngle = 0;

    // ソケット配列（子クラスで初期化する）
    this.sockets = [];
    
    // ワイヤリング開始ソケット名（一時的なマーカー）
    this.wiringStartSocket = null;

    this.isHighlighted = false;
    
    // ★追加: 選択状態フラグ
    this.isSelected = false;
  }

  // ==================== プロパティアクセサ ====================
  
  /**
   * X座標のゲッター（既存コードとの互換性維持）
   */
  get x() {
    return this.posX.value;
  }
  
  /**
   * Y座標のゲッター（既存コードとの互換性維持）
   */
  get y() {
    return this.posY.value;
  }
  
  /**
   * 回転角度のゲッター（既存コードとの互換性維持）
   */
  get rotation() {
    return this.rot.value;
  }
  
  /**
   * 目標X座標のゲッター
   */
  get targetX() {
    return this.posX.target;
  }
  
  /**
   * 目標Y座標のゲッター
   */
  get targetY() {
    return this.posY.target;
  }
  
  /**
   * 目標回転角度のゲッター
   */
  get targetRotation() {
    return this.rot.target;
  }

  // ==================== ライフサイクル ====================
  
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

  // ==================== インタラクション ====================
  
  /**
   * ユーザーがクリックした時の処理（抽象メソッド）
   */
  interact() {
    console.log(`Part ${this.id}: 触られました`);
  }

  // ==================== 状態管理 ====================
  
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

  // ==================== 座標・位置計算 ====================
  
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
    const pivot = this.getPivotOffset();
    
    // 1. 回転中心からの相対座標に変換
    // localX, localY は「部品中心」からの座標なので、そこからPivot分を引く
    const relX = localX - pivot.x;
    const relY = localY - pivot.y;

    // 2. 回転を適用
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const rotatedX = relX * cos - relY * sin;
    const rotatedY = relX * sin + relY * cos;
    
    // 3. ワールド座標上の回転中心位置に加算
    const rotCenter = this.getRotationCenter();
    return {
      x: rotCenter.x + rotatedX,
      y: rotCenter.y + rotatedY
    };
  }

  /**
   * ワールド座標をローカル座標に変換（当たり判定などに使用）
   * @param {number} worldX - ワールドX座標
   * @param {number} worldY - ワールドY座標
   * @returns {{x: number, y: number}} ローカル座標
   */
  worldToLocal(worldX, worldY) {
    const rotCenter = this.getRotationCenter();
    
    // 1. 回転中心からの相対座標
    const dx = worldX - rotCenter.x;
    const dy = worldY - rotCenter.y;
    
    // 2. 回転の逆
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const unrotatedX = dx * cos - dy * sin;
    const unrotatedY = dx * sin + dy * cos;
    
    // 3. ピボットオフセットを足して「部品中心」からの座標に戻す
    const pivot = this.getPivotOffset();
    return {
      x: unrotatedX + pivot.x,
      y: unrotatedY + pivot.y
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

  // ==================== 接続管理 ====================
  
  /**
   * 名前でソケットを取得
   * @param {string} socketName
   * @returns {Socket|null}
   */
  getSocket(socketName) {
    return this.sockets.find(s => s.name === socketName) || null;
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

  // ==================== マウス・入力処理 ====================
  
  /**
   * マウスがこの部品の上にあるか判定
   * ★修正: 回転を考慮した矩形判定に変更
   * @param {number} mx - マウスX座標
   * @param {number} my - マウスY座標
   * @param {number} scale - 判定サイズの倍率（デフォルト1.0）
   */
  isMouseOver(mx, my, scale = 1.0) {
    // 引数がなければグローバルのmouseXを使う（互換性維持）
    const x = mx !== undefined ? mx : mouseX;
    const y = my !== undefined ? my : mouseY;
    
    // 1. パーツ中心からの相対ベクトルを計算
    const center = this.getCenter();
    const dx = x - center.x;
    const dy = y - center.y;

    // 2. パーツの回転角度分だけ「逆回転」させる
    // これで、マウス座標を「パーツが回転していない状態のローカル座標系」に変換できる
    const angle = -this.rotation;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    // 3. 軸平行な矩形判定を行う
    const halfW = (CONST.PARTS.WIDTH * scale) / 2;
    const halfH = (CONST.PARTS.HEIGHT * scale) / 2;

    // 回転後の座標が、元の矩形範囲に入っているか
    return (localX > -halfW && localX < halfW &&
            localY > -halfH && localY < halfH);
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
   * スナップ時のオフセット（補正値）を取得
   * 通常は {x:0, y:0} だが、サイズが特殊なパーツ等はこれをオーバーライドする
   */
  getSnapOffset() {
    return { x: 0, y: 0 };
  }

  /**
   * 回転中心のオフセット（補正値）を取得
   * スナップオフセットの「逆」を返すことで、
   * 位置をずらしても回転中心はグリッド上に維持されるようにする
   */
  getPivotOffset() {
    const snap = this.getSnapOffset();
    return {
      x: -snap.x,
      y: -snap.y
    };
  }

  /**
   * ★追加: ワールド座標系での回転中心を取得
   */
  getRotationCenter() {
    const center = this.getCenter();
    const pivot = this.getPivotOffset();
    // 回転前のワールド座標上のピボット位置
    return {
      x: center.x + pivot.x,
      y: center.y + pivot.y
    };
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
    
    // ★変更: アニメーション中かもしれないので、ターゲット座標を基準にオフセットを計算
    // こうすることで、移動中に掴んでもターゲットグリッドとの相対位置が維持される
    this.offsetX = this.posX.target - x;
    this.offsetY = this.posY.target - y;
    
    // ドラッグ判定の基準点もターゲット座標にする
    this.dragStartX = this.posX.target;
    this.dragStartY = this.posY.target;
  }

  /**
   * マウスをドラッグしている時の処理
   * @param {number} mx - マウスX座標
   * @param {number} my - マウスY座標
   * @param {number} snapUnit - スナップする単位（ピクセル）
   */
  onMouseDragged(mx, my, snapUnit) {
    if (this.isDragging) {
      const x = mx !== undefined ? mx : mouseX;
      const y = my !== undefined ? my : mouseY;
      
      const rawX = x + this.offsetX;
      const rawY = y + this.offsetY;
      
      const snap = snapUnit || CONST.GRID.SNAP_FINE;
      
      // ★リファクタリング: MathUtilsを使用したスナップ処理
      const offset = this.getSnapOffset();
      const snapped = MathUtils.snapPosition(rawX, rawY, snap, offset);
      
      this.posX.setTarget(snapped.x);
      this.posY.setTarget(snapped.y);
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
    // ★変更: ターゲット座標の移動量で判定（スナップ単位で動いたか）
    const dx = Math.abs(this.posX.target - this.dragStartX);
    const dy = Math.abs(this.posY.target - this.dragStartY);
    return dx > threshold || dy > threshold;
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
    
    // ★追加: ドラッグ開始時に目標値を現在値に合わせる（変な飛び跳ね防止）
    this.rot.setTarget(this.rot.value);
    
    const center = this.getCenter();
    // ★変更: targetRotation を基準にオフセットを計算
    this.rotationStartAngle = Math.atan2(y - center.y, x - center.x) - this.rot.target;
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
      
      // 生の回転角度を計算
      const rawRotation = currentAngle - this.rotationStartAngle;
      
      // ★リファクタリング: MathUtilsを使用したスナップ処理
      const snapDegrees = snapEnabled ? 90 : 5;
      const snappedRotation = MathUtils.snapAngle(rawRotation, snapDegrees);
      
      this.rot.setTarget(snappedRotation);
    }
  }

  /**
   * 回転モードを終了
   */
  onRotationMouseUp() {
    this.isRotating = false;
  }

  /**
   * ★リファクタリング: アニメーション更新用メソッド
   * 毎フレーム呼び出して、現在値を目標値に近づける
   */
  updateAnimation() {
    this.rot.update();
    this.posX.update();
    this.posY.update();
  }

  /**
   * アニメーションせずに角度と位置を即時設定する（ロード時や初期化用）
   * @param {number} angle - ラジアン
   */
  setRotationImmediately(angle) {
    this.rot.setImmediate(angle);
  }
  
  /**
   * アニメーションせずに位置を即時設定する（ロード時や初期化用）
   * @param {number} x - X座標
   * @param {number} y - Y座標
   */
  setPositionImmediately(x, y) {
    this.posX.setImmediate(x);
    this.posY.setImmediate(y);
  }

  // ==================== 描画 ====================
  
  /**
   * 描画処理
   * @param {{x: number, y: number}} worldMouse - ワールド座標のマウス位置
   * @param {Object} visibilityRules - 可視性ルール
   */
  draw(worldMouse, visibilityRules = {}) {
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

    // 部品中心(getCenter)ではなく、回転中心(getRotationCenter)に移動
    const rotCenter = this.getRotationCenter();
    translate(rotCenter.x, rotCenter.y);
    rotate(this.rotation);
    
    // 描画原点は「部品中心」である必要があるので、
    // 回転した後にピボット分だけ逆移動して原点を戻す
    const pivot = this.getPivotOffset();
    translate(-pivot.x, -pivot.y);
    
    // 部品本体を描画（原点中心）
    // visibilityRulesも渡す（WireJointで使用）
    this.drawShape(color, worldMouse, visibilityRules);
    
    // ソケットを描画（visibilityRulesを渡す）
    for (let socket of this.sockets) {
      socket.draw(worldMouse, visibilityRules);
    }

    // ハイライト時は、その上から「半透明の赤」を重ねる
    if (this.isHighlighted) {
      this.drawHighlight();
    }
    
    // ★追加: 選択されている場合、青緑色の枠を表示
    if (this.isSelected) {
      this.drawSelectionBorder();
    }
    
    pop();
    
    // 回転ハンドルを描画（回転の外で）
    const mx = worldMouse ? worldMouse.x : undefined;
    const my = worldMouse ? worldMouse.y : undefined;
    const isHovered = this.isMouseOverRotationHandle(mx, my);
    
    // 回転中 OR (ホバー中 AND ルールで許可されている) なら表示
    const shouldShow = this.isRotating || (isHovered && visibilityRules.showRotationHandles);
    
    if (shouldShow) {
      this.drawRotationHandle(worldMouse);
    }
  }

  /**
   * 部品の形を描画（子クラスでオーバーライド可能）
   * @param {Array} color - 枠線の色
   * @param {{x: number, y: number}} worldMouse - ワールド座標のマウス位置
   * @param {Object} visibilityRules - 可視性ルール
   */
  drawShape(color, worldMouse, visibilityRules) {
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
    const scale = CONST.DELETE_MODE.HIGHLIGHT_SCALE;
    const alpha = CONST.DELETE_MODE.HIGHLIGHT_ALPHA;
    const cornerRadius = CONST.DELETE_MODE.HIGHLIGHT_CORNER_RADIUS;
    
    noStroke();
    fill(...CONST.DELETE_MODE.HIGHLIGHT_COLOR, alpha);
    rectMode(CENTER);
    rect(0, 0, CONST.PARTS.WIDTH * scale, CONST.PARTS.HEIGHT * scale, cornerRadius);
  }

  /**
   * ★追加: 複数選択モード用の枠サイズ情報を取得
   * アニメーションターゲットとして使用する
   * @returns {{w: number, h: number, r: number}} 幅, 高さ, 角丸半径
   */
  getSelectionBox() {
    const scale = CONST.MULTI_SELECT_MODE.SELECTION_BORDER_SCALE;
    return {
      w: CONST.PARTS.WIDTH * scale,
      h: CONST.PARTS.HEIGHT * scale,
      r: CONST.MULTI_SELECT_MODE.SELECTION_BORDER_CORNER_RADIUS
    };
  }

  /**
   * ★追加: 選択時の枠線描画
   */
  drawSelectionBorder(isDashed = false) {
    const scale = CONST.MULTI_SELECT_MODE.SELECTION_BORDER_SCALE;
    const cornerRadius = CONST.MULTI_SELECT_MODE.SELECTION_BORDER_CORNER_RADIUS;
    const borderWeight = CONST.MULTI_SELECT_MODE.SELECTION_STROKE_WEIGHT;
    
    noStroke();
    fill(...CONST.MULTI_SELECT_MODE.COLOR_BG);
    rectMode(CENTER);
    rect(0, 0, CONST.PARTS.WIDTH * scale, CONST.PARTS.HEIGHT * scale, cornerRadius);

    noFill();
    stroke(...CONST.MULTI_SELECT_MODE.COLOR_STROKE);
    strokeWeight(borderWeight);
    if (isDashed) {
      drawingContext.setLineDash(CONST.MULTI_SELECT_MODE.CURSOR_DASH_PATTERN);
    } else {
      drawingContext.setLineDash([]);
    }
    // パーツより一回り大きく描画
    rect(0, 0, CONST.PARTS.WIDTH * scale, CONST.PARTS.HEIGHT * scale, cornerRadius);
    drawingContext.setLineDash([]);
  }

  /**
   * 回転ハンドルを描画
   */
  drawRotationHandle(worldMouse) {
    const handlePos = this.getRotationHandlePos();
    
    // 引数で受け取ったワールド座標を使って判定を行う
    // これでズーム・パン後も正しい位置で判定されます
    const mx = worldMouse ? worldMouse.x : undefined;
    const my = worldMouse ? worldMouse.y : undefined;
    const isHovered = this.isMouseOverRotationHandle(mx, my);
    
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
