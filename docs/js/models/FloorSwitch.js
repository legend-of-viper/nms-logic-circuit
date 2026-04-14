'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { CONST } from '../config/constants.js';

/**
 * フロアスイッチクラス
 * 2x2の大型パーツで、マウスが上に乗っている間ONになる
 * リアルタイムセンサー機能を持つ
 */
export class FloorSwitch extends CircuitPart {
  constructor(id, x, y) {
    // 2x2サイズ
    const size = CONST.PARTS.WIDTH + CONST.GRID.SIZE * 1;
    super(id, x, y, size, size);
    
    this.type = CONST.PART_TYPE.FLOOR_SWITCH;
    this.isOn = false;

    // ソケットを上部に2つ配置（左右に少し振り分ける）
    const socketY = -this.height / 2;
    const socketOffsetX = CONST.GRID.SIZE * 0.5;
    this.sockets = [
      new Socket(this, 'left', -socketOffsetX, socketY, 'top'),
      new Socket(this, 'right', socketOffsetX, socketY, 'top')
    ];

    // センサー判定用の範囲設定（微調整用）
    this.sensorPadding = 5;
    
    // worldMouseを保持するプロパティ
    this.lastWorldMouse = null;
  }

  /**
   * リアルタイムセンサー判定
   * PowerSystem.update()から毎フレーム呼ばれる
   */
  update() {
    // worldMouseの座標を取得（draw時に更新される）
    if (this.lastWorldMouse) {
      this.isOn = this.checkSensor(this.lastWorldMouse);
    }
  }

  /**
   * センサー範囲内かどうかの独自判定
   */
  checkSensor(worldPos) {
    if (!worldPos) return false;
    
    // 回転を考慮したローカル座標への変換
    const local = this.worldToLocal(worldPos.x, worldPos.y);
    
    // 矩形範囲判定（微調整可能なように isMouseOver とは別に定義）
    const halfW = (this.width / 2) - this.sensorPadding;
    const halfH = (this.height / 2) - this.sensorPadding;

    return (local.x > -halfW && local.x < halfW &&
            local.y > -halfH && local.y < halfH);
  }

  /**
   * 描画処理
   */
  drawShape(color, worldMouse) {
    // worldMouseを保存（update()で使用）
    this.lastWorldMouse = worldMouse;
    
    const w = this.width;
    const h = this.height;
    
    // 1. 外側の枠線
    super.drawShape(color);

    // 2. 内側の枠線
    const innerSize = w * 0.8;
    const innerRadius = CONST.PARTS.RADIUS * 0.5;
    const innerColor = this.isOn ? CONST.COLORS.ON_STATE : CONST.COLORS.OFF_STATE;
    stroke(...innerColor);
    noFill();
    rect(0, 0, innerSize, innerSize, innerRadius);

    // 3. 内部の模様
    this.drawPattern(innerSize, innerColor);
  }

  /**
   * 内部パターン（縦向きの >>> 模様）を描画
   */
  drawPattern(size, color) {
    push();
    fill(...color);
    noStroke();
    
    const count = 4; // 縞の数
    const stripHeight = size * 0.12; // 縞自体の太さ（細めに調整）
    const spacing = size / count;    // 等間隔の計算
    
    // 山の鋭さ（先端の突き出し量）
    const peakDepth = stripHeight * 1.5;
    const w = size * 0.95; // 模様の横幅

    rectMode(CENTER);

    for (let i = 0; i < count; i++) {
      // yの位置を計算（上から下へ等間隔）
      const yPos = -size / 2 + (i + 0.85) * spacing;

      push();
      translate(0, yPos);
      
      // 山形（Chevron）の描画
      beginShape();
      // 左端（外側）
      vertex(-w / 2, -stripHeight / 2);
      // 中央（尖り部分：内側を向くように計算）
      vertex(0, -stripHeight / 2 - peakDepth);
      // 右端（外側）
      vertex(w / 2, -stripHeight / 2);
      
      // 厚み部分
      vertex(w / 2, stripHeight / 2);
      vertex(0, stripHeight / 2 - peakDepth);
      vertex(-w / 2, stripHeight / 2);
      endShape(CLOSE);
      pop();
    }
    
    pop();
  }

  // --- その他のUI用オーバーライド ---
  
  interact() {
    // 手動操作なし（センサー動作のみ）
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
