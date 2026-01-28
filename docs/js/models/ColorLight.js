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
    super(id, x, y);
    
    this.type = CONST.PART_TYPE.COLOR_LIGHT;
    
    // ソケットを作成（入力のみ・下部）
    this.sockets = [
      new Socket(this, 'bottom', 0, CONST.PARTS.HEIGHT * 1.4 / 2, 'bottom')
    ];
  }

  // ==================== マウス・入力処理 ====================
  
  /**
   * マウスがこの部品の上にあるか判定
   * ★修正: 回転を考慮した矩形判定に変更（縦長パーツ対応）
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

    // 3. 軸平行な矩形判定を行う（ColorLightは縦長なので高さが1.5倍）
    const halfW = (CONST.PARTS.WIDTH * scale) / 2;
    const halfH = (CONST.PARTS.HEIGHT * 1.5 * scale) / 2;

    // 回転後の座標が、元の矩形範囲に入っているか
    return (localX > -halfW && localX < halfW &&
            localY > -halfH && localY < halfH);
  }

  // ==================== 設定 ====================

  /**
   * スナップ位置の補正
   * 端子位置を通常パーツの端子位置(20px)と合わせるため、
   * 余分な長さ(8px)の分だけ中心座標を上にずらしてスナップさせる
   */
  getSnapOffset() {
    // 40 * 0.2 = 8px ずらす
    return { x: 0, y: -CONST.PARTS.HEIGHT * 0.2 };
  }

  /**
   * ★追加: 選択枠サイズをオーバーライド（縦長カプセル）
   */
  getSelectionBox() {
    const scale = CONST.MULTI_SELECT_MODE.SELECTION_BORDER_SCALE;
    const w = CONST.PARTS.WIDTH * scale;
    // drawSelectionBorderの実装に合わせて高さを調整
    // (1.5倍パーツ * 1.5倍枠 = 2.25倍) だが、見た目のバランス調整
    const h = CONST.PARTS.HEIGHT * 1.5 * scale;
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
    const w = CONST.PARTS.WIDTH;
    const h = CONST.PARTS.HEIGHT * 1.5;

    // ★ここが変更点
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
    const w = CONST.PARTS.WIDTH * 1.5;
    const h = CONST.PARTS.HEIGHT * 1.5 * 1.5;

    noStroke();
    fill(...CONST.DELETE_MODE.HIGHLIGHT_COLOR, CONST.DELETE_MODE.HIGHLIGHT_ALPHA);
    
    rectMode(CENTER);
    // drawShapeと同じサイズ・形状で描画
    rect(0, 0, w, h, w * 0.5);
  }
  
  /**
   * 選択枠も自分の形（縦長カプセル）に合わせる
   */
  drawSelectionBorder(isDashed = false) {
    const scale = CONST.MULTI_SELECT_MODE.SELECTION_BORDER_SCALE;
    const w = CONST.PARTS.WIDTH * scale;
    const h = CONST.PARTS.HEIGHT * 1.5 * scale; // 高さは1.5倍パーツのさらに1.5倍枠
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
