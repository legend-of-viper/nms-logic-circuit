'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { CONST } from '../config/constants.js';
import { SmoothValue } from '../utils/Animator.js';

/**
 * 電動ドアクラス
 * 電力が供給されている間は閉じ、供給が止まると開く
 */
export class PowerDoor extends CircuitPart {
  constructor(id, x, y) {
    const doorW = CONST.PARTS.WIDTH * 4 + CONST.PARTS.STROKE_WEIGHT * 3;
    const doorH = CONST.PARTS.HEIGHT * 2.75 + CONST.PARTS.STROKE_WEIGHT * 2;
    
    super(id, x, y, doorW, doorH);
    
    this.type = CONST.PART_TYPE.POWER_DOOR;
    // 初期値は全開(0.0)
    this.doorOpenRatio = new SmoothValue(0.0, 0.08, 0.001);
    this.currentSpeed = 0; // 1ミリ秒あたりの移動速度

    // パーツが下方向に伸びた分を補正した上で、そこからグリッド2つ分上の位置をソケットにする
    const socketOffset = (doorH - CONST.PARTS.HEIGHT) / 2 - CONST.GRID.SIZE * 2
    this.sockets = [
      new Socket(this, 'surface', 0, socketOffset, 'surface')
    ];
    const snapOffset = doorH + CONST.PARTS.STROKE_WEIGHT * 0.5;
    this.snapOffset = { x: 0, y: snapOffset };
    const pivotOffset = socketOffset + CONST.GRID.SIZE * 1.5;
    this._pivotOffset = { x: 0, y: pivotOffset};
  }

  /**
   * 毎フレームの更新処理
   */
  update() {
    // const inputSocket = this.getSocket('top');
    const inputSocket = this.getSocket('surface');
    const isPowered = inputSocket ? inputSocket.isPowered : false;

    // 目標値（1.0＝閉、0.0＝開）
    this.doorOpenRatio.setTarget(isPowered ? 1.0 : 0.0);

    const target = this.doorOpenRatio.target;
    const current = this.doorOpenRatio.value;

    if (target === current) {
      this.currentSpeed = 0;
      return;
    }

    // --- ミリ秒ベースの計算 ---
    // 1秒(1000ms)で 1.0 動かしたい場合、加速度はさらに小さな値になります
    const accelerationPerMs = 0.000002; 
    const dt = deltaTime; // 前フレームからの経過ミリ秒 (p5.js標準変数)

    // 動作スピード
    this.currentSpeed = 0.0014
    if (current < 0.3) {
      this.currentSpeed = this.currentSpeed * 0.5;
    }
    if (isPowered) {
      // 【閉じる時（目標 1.0）：加速】
      this.doorOpenRatio.value = Math.min(target, current + this.currentSpeed * dt);
    } 
    else {
      // 【開く時（目標 0.0）：減速】
      this.doorOpenRatio.value = Math.max(target, current - this.currentSpeed * dt);
    }
  }

  /**
   * ドアの描画
   */
  drawShape(color) {
    const w = this.width;
    const h = this.height;
    
    // 内枠用のサイズ計算
    const innerW = w * 0.85;
    const innerH = h * 0.82;
    const innerY = h * 0.08; // 少し下にずらす
    const frameRadius = 4;

    // 現在の通電状態を直接取得
    const inputSocket = this.getSocket('surface');
    const isPowered = inputSocket ? inputSocket.isPowered : false;
    
    // 状態に応じた色を決定
    const stateColor = isPowered ? CONST.COLORS.ON_STATE : CONST.COLORS.OFF_STATE;

    // --- 1. 外側メインフレーム ---
    stroke(...stateColor); // 通電状態で色を切り替え
    strokeWeight(CONST.PARTS.STROKE_WEIGHT);
    fill(CONST.COLORS.BACKGROUND);
    rectMode(CENTER);
    rect(0, 0, w, h, frameRadius);

    // --- 2. 内側フレーム ---
    stroke(...stateColor); // 通電状態で色を切り替え
    strokeWeight(CONST.PARTS.STROKE_WEIGHT);
    fill(CONST.COLORS.BACKGROUND); // 背景は暗い色で固定
    rect(0, innerY, innerW, innerH, frameRadius);

    // --- 3. シャッターパネル ---
    const ratio = this.doorOpenRatio.value; // 1.0=閉(通電目標), 0.0=開(非通電目標)
    const shutterH = innerH * ratio;

    if (shutterH > 0.5) {
      noStroke();
      fill(...stateColor); // 通電状態で色を切り替え（余計なアクセントなし）
      
      rectMode(CORNER);
      // 内枠の上端から描画
      rect(
        -innerW / 2, 
        -innerH / 2 + innerY, 
        innerW, 
        shutterH,
        2
      );
    }
  }

  // --- その他のUI用オーバーライド ---
  
  interact() {
    // 手動操作なし
  }

  getSelectionBox() {
    const scale = CONST.MULTI_SELECT_MODE.SELECTION_BORDER_SCALE * 0.9;
    return { w: this.width * scale, h: this.height * scale, r: CONST.DELETE_MODE.HIGHLIGHT_CORNER_RADIUS };
  }

  drawHighlight() {
    const scale = CONST.DELETE_MODE.HIGHLIGHT_SCALE * 0.8;
    const alpha = CONST.DELETE_MODE.HIGHLIGHT_ALPHA;
    const cornerRadius = CONST.DELETE_MODE.HIGHLIGHT_CORNER_RADIUS;
    
    noStroke();
    fill(...CONST.DELETE_MODE.HIGHLIGHT_COLOR, alpha);
    rectMode(CENTER);
    // 自身の width/height を使って描画
    rect(0, 0, this.width * scale, this.height * scale, cornerRadius);
  }

  drawSelectionBorder(isDashed = false) {
    const scale = CONST.MULTI_SELECT_MODE.SELECTION_BORDER_SCALE * 0.9;
    const w = this.width * scale;
    const h = this.height * scale;
    noStroke();
    fill(...CONST.MULTI_SELECT_MODE.COLOR_BG);
    rectMode(CENTER);
    rect(0, 0, w, h, 4);
    noFill();
    stroke(...CONST.MULTI_SELECT_MODE.COLOR_STROKE);
    strokeWeight(CONST.MULTI_SELECT_MODE.SELECTION_STROKE_WEIGHT);
    if (isDashed) drawingContext.setLineDash(CONST.MULTI_SELECT_MODE.CURSOR_DASH_PATTERN);
    rect(0, 0, w, h, CONST.DELETE_MODE.HIGHLIGHT_CORNER_RADIUS);
    drawingContext.setLineDash([]);
  }
}