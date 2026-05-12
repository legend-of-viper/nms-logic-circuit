'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { CONST } from '../config/constants.js';

/**
 * テキストラベルクラス
 * 自由なテキストを表示できる汎用パーツ
 * 左右にソケットを持ち、通電を素通しする
 */
export class TextLabel extends CircuitPart {
  constructor(id, x, y, text = "txt") {
    // テキストから幅を計算（グリッド幅の倍数）
    const width = TextLabel.calculateWidth(text);
    super(id, x, y, width, CONST.PARTS.HEIGHT);
    
    this.type = CONST.PART_TYPE.TEXT_LABEL;
    this.text = text.substring(0, 50); // 50文字制限
    this.fontSize = this.calculateFontSize();
    
    // ソケットを作成（左右端に配置）
    this.sockets = [
      new Socket(this, 'left', -this.width / 2, 0, 'left'),
      new Socket(this, 'right', this.width / 2, 0, 'right')
    ];
  }

  // ==================== 静的メソッド ====================
  
  /**
   * テキストから必要な幅を計算（グリッド幅の倍数）
   * @param {string} text - 表示するテキスト
   * @returns {number} 計算された幅（グリッド幅の倍数）
   */
  static calculateWidth(text) {
    if (!text || text.length === 0) {
      return CONST.PARTS.WIDTH; // 最小幅（1グリッド分）
    }
    
    // 50文字に切り詰めてから測定
    const trimmedText = text.substring(0, 50);
    
    // 仮のフォントサイズで測定
    push();
    textSize(20);
    textFont("'Courier New', Courier, monospace");
    const measuredWidth = textWidth(trimmedText);
    pop();
    
    // 余白を追加
    const padding = 0;
    const requiredWidth = measuredWidth + padding;
    
    // グリッド単位の数を計算
    // Power Doorと同様の計算: n個並べると n*WIDTH + (n-1)*STROKE
    const gridUnit = CONST.PARTS.WIDTH + CONST.PARTS.STROKE_WEIGHT;
    const gridMultiplier = Math.max(1, Math.ceil((requiredWidth + CONST.PARTS.STROKE_WEIGHT) / gridUnit));
    
    // 最終的な幅 = n*WIDTH + (n-1)*STROKE
    const finalWidth = gridMultiplier * CONST.PARTS.WIDTH + (gridMultiplier - 1) * CONST.PARTS.STROKE_WEIGHT;
    
    return finalWidth;
  }

  // ==================== インスタンスメソッド ====================
  
  /**
   * テキストが幅に収まる最適なフォントサイズを計算
   * @returns {number} フォントサイズ（px）
   */
  calculateFontSize() {
    const maxSize = 20;
    const minSize = 8;
    const padding = 10; // 左右の余白
    const availableWidth = this.width - padding;
    
    push();
    textFont("Monaco, Menlo, 'Courier New', Consolas, monospace");
    
    // 最大サイズから試していき、収まるサイズを探す
    for (let size = maxSize; size >= minSize; size--) {
      textSize(size);
      const w = textWidth(this.text);
      if (w <= availableWidth) {
        pop();
        return size;
      }
    }
    
    pop();
    return minSize;
  }

  // ==================== インタラクション ====================
  
  /**
   * インタラクション（編集不可）
   */
  interact() {
    // テキストは配置後変更不可
  }

  // ==================== 描画 ====================
  
  /**
   * テキストラベルの形を描画
   * @param {Array} color - 枠線の色（基本色だが、通電時は上書きされる）
   */
  drawShape(color) {
    // 通電状態をチェック
    const isPowered = this.sockets.some(s => s.isPowered);
    const strokeColor = isPowered ? CONST.COLORS.WIRE_ON : color;
    
    // 背景ボックス
    stroke(...strokeColor);
    strokeWeight(CONST.PARTS.STROKE_WEIGHT);
    fill(CONST.COLORS.BACKGROUND);
    rectMode(CENTER);
    rect(0, 0, this.width, this.height, 8);
    
    // テキスト描画
    fill(255, 255, 255); // 白文字
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(this.fontSize);
    textFont("Monaco, Menlo, 'Courier New', Consolas, monospace");
    text(this.text, 0, 0);
  }

  /**
   * 選択枠サイズをオーバーライド（可変幅に対応）
   * PowerDoorと同様に倍率を調整
   */
  getSelectionBox() {
    const scale = CONST.MULTI_SELECT_MODE.SELECTION_BORDER_SCALE * 0.9;
    return {
      w: this.width * scale,
      h: this.height * scale,
      r: CONST.MULTI_SELECT_MODE.SELECTION_BORDER_CORNER_RADIUS
    };
  }

  /**
   * ハイライト描画をオーバーライド（可変幅に対応）
   * PowerDoorと同様に倍率を調整
   */
  drawHighlight() {
    const scale = CONST.DELETE_MODE.HIGHLIGHT_SCALE * 0.8;
    const alpha = CONST.DELETE_MODE.HIGHLIGHT_ALPHA;
    const cornerRadius = CONST.DELETE_MODE.HIGHLIGHT_CORNER_RADIUS;
    
    noStroke();
    fill(...CONST.DELETE_MODE.HIGHLIGHT_COLOR, alpha);
    rectMode(CENTER);
    rect(0, 0, this.width * scale, this.height * scale, cornerRadius);
  }

  /**
   * 選択枠描画をオーバーライド（可変幅に対応）
   * PowerDoorと同様に倍率を調整
   */
  drawSelectionBorder(isDashed = false) {
    const scale = CONST.MULTI_SELECT_MODE.SELECTION_BORDER_SCALE * 0.9;
    const cornerRadius = CONST.MULTI_SELECT_MODE.SELECTION_BORDER_CORNER_RADIUS;
    const borderWeight = CONST.MULTI_SELECT_MODE.SELECTION_STROKE_WEIGHT;
    
    noStroke();
    fill(...CONST.MULTI_SELECT_MODE.COLOR_BG);
    rectMode(CENTER);
    rect(0, 0, this.width * scale, this.height * scale, cornerRadius);

    noFill();
    stroke(...CONST.MULTI_SELECT_MODE.COLOR_STROKE);
    strokeWeight(borderWeight);
    if (isDashed) {
      drawingContext.setLineDash(CONST.MULTI_SELECT_MODE.CURSOR_DASH_PATTERN);
    } else {
      drawingContext.setLineDash([]);
    }
    rect(0, 0, this.width * scale, this.height * scale, cornerRadius);
    drawingContext.setLineDash([]);
  }
}
