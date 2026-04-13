'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { CONST } from '../config/constants.js';

// ColorLight固有の色定義
const LOCAL_CONST = {
  LIT_COLOR: [255, 200, 100],      // 点灯時の明るい色（暖色系）
  UNLIT_COLOR: [40, 40, 50],       // 消灯時の暗い色
};

/**
 * カラーライトクラス
 * 入力に電力が供給されると点灯するライト
 * 状態(isOn)を持たず、現在の通電状態をダイレクトに反映する
 */
export class ColorLight extends CircuitPart {
  constructor(id, x, y) {
    // ★リファクタリング: 縦長サイズをコンストラクタで指定
    super(id, x, y, CONST.PARTS.WIDTH, CONST.PARTS.HEIGHT * 1.5);
    
    this.type = CONST.PART_TYPE.COLOR_LIGHT;

    // ソケットを作成（入力のみ・下部）
    this.sockets = [
      new Socket(this, 'bottom', 0, CONST.PARTS.HEIGHT * 1.4 / 2, 'bottom')
    ];

    // パーツが縦に20px伸びて、ソケット位置の基準が10px下にずれている
    // 加えてソケット位置を28px下にずらしたので、ソケット位置が38pxの位置にある
    // ソケット位置が20px（通常パーツの位置）だとスナップがうまくいくので、オフセットを−18pxとする
    // ※スナップ位置の基準点はパーツ左上、ソケット位置の基準点はパーツ中心であることに注意
    this.snapOffset = { x: 0, y: -18 };
    // 回転中心はソケットの20px上（−20px）にしたい（通常パーツの位置）
    // ソケットは28pxの位置にあるので、その−20px、8px分回転位置をオフセットする
    // ※回転の基準点はパーツ中心であることに注意
    this._pivotOffset = { x: 0, y: 8 };
  }

  // ==================== 設定 ====================

  /**
   * ★追加: 選択枠サイズをオーバーライド（縦長カプセル）
   */
  getSelectionBox() {
    const scale = CONST.MULTI_SELECT_MODE.SELECTION_BORDER_SCALE;
    const w = this.width * scale;
    const h = this.height * scale;
    const r = w * 0.5; // 完全な円形カプセルにするため幅の半分
    
    return { w, h, r };
  }

  // ==================== インタラクション ====================
  
  /**
   * インタラクションなし
   */
  interact() {
    // 何もしない
  }

  // ==================== 描画 ====================
  
  /**
   * カラーライトの形を描画
   * 状態更新なし - ライトは論理的な状態を持たず、ただ電気を表示するだけなので
   * onTick も update も不要です。
   */
  drawShape(color) {
    // ★リファクタリング: this.width / this.height を使用
    const w = this.width;
    const h = this.height;

    // 描画の瞬間に、ソケットに電気が来ているかを直接チェック！
    const bottomSocket = this.getSocket('bottom');
    const isPowered = bottomSocket ? bottomSocket.isPowered : false;
    
    // 通電していれば点灯色、そうでなければ消灯色
    const fillColor = isPowered ? LOCAL_CONST.LIT_COLOR : LOCAL_CONST.UNLIT_COLOR;
    const strokeColor = isPowered ? CONST.COLORS.WIRE_ON : CONST.COLORS.OFF_STATE;

    // カプセル型を描画
    fill(...fillColor);
    stroke(...strokeColor);
    strokeWeight(CONST.PARTS.STROKE_WEIGHT);
    rectMode(CENTER);
    rect(0, 0, w, h, w * 0.5);
  }

  /**
   * ハイライト描画をオーバーライド
   * 自分の形（縦長カプセル）に合わせて描画する
   */
  drawHighlight() {
    // ★リファクタリング: this.width / this.height を使用
    const scale = CONST.DELETE_MODE.HIGHLIGHT_SCALE;
    const w = this.width * scale;
    const h = this.height * scale;

    noStroke();
    fill(...CONST.DELETE_MODE.HIGHLIGHT_COLOR, CONST.DELETE_MODE.HIGHLIGHT_ALPHA);
    
    rectMode(CENTER);
    rect(0, 0, w, h, w * 0.5);
  }
  
  /**
   * 選択枠も自分の形（縦長カプセル）に合わせる
   */
  drawSelectionBorder(isDashed = false) {
    // ★リファクタリング: this.width / this.height を使用
    const scale = CONST.MULTI_SELECT_MODE.SELECTION_BORDER_SCALE;
    const w = this.width * scale;
    const h = this.height * scale;
    const cornerRadius = w * 0.5;

    // 1. 半透明の塗り
    noStroke();
    fill(...CONST.MULTI_SELECT_MODE.COLOR_BG);
    rectMode(CENTER);
    rect(0, 0, w, h, cornerRadius);

    // 2. 枠線
    noFill();
    stroke(...CONST.MULTI_SELECT_MODE.COLOR_STROKE);
    strokeWeight(CONST.MULTI_SELECT_MODE.SELECTION_STROKE_WEIGHT);
    if (isDashed) {
      drawingContext.setLineDash(CONST.MULTI_SELECT_MODE.CURSOR_DASH_PATTERN);
    } else {
      drawingContext.setLineDash([]);
    }
    rect(0, 0, w, h, cornerRadius);
    drawingContext.setLineDash([]);
  }
}
