'use strict';

/**
 * 入力マネージャー
 * マウス/タッチ操作、パン・ズーム、座標変換を担当
 */
export class InputManager {
  constructor() {
    // ビューポート管理用の変数（パン＆ズーム）
    this.viewOffsetX = 0;
    this.viewOffsetY = 0;
    this.viewScale = 1.0;

    // タッチ操作計算用の一時変数
    this.prevTouchDist = -1;
    this.prevTouchCenter = { x: 0, y: 0 };
  }

  /**
   * スクリーン座標をワールド座標に変換
   * （パン＆ズーム適用後の回路内の座標を取得）
   * @param {number} screenX - スクリーンX座標
   * @param {number} screenY - スクリーンY座標
   * @returns {{x: number, y: number}} ワールド座標
   */
  getWorldPosition(screenX, screenY) {
    return {
      x: (screenX - this.viewOffsetX) / this.viewScale,
      y: (screenY - this.viewOffsetY) / this.viewScale
    };
  }

  /**
   * ワールド座標をスクリーン座標に変換
   * @param {number} worldX - ワールドX座標
   * @param {number} worldY - ワールドY座標
   * @returns {{x: number, y: number}} スクリーン座標
   */
  getScreenPosition(worldX, worldY) {
    return {
      x: worldX * this.viewScale + this.viewOffsetX,
      y: worldY * this.viewScale + this.viewOffsetY
    };
  }

  /**
   * 2本指タッチによるパン・ズーム処理
   * @param {Array} touches - タッチポイントの配列
   * @returns {boolean} 2本指操作が行われたかどうか
   */
  handleTwoFingerGesture(touches) {
    if (touches.length !== 2) {
      // 指が2本でなければリセット
      this.prevTouchDist = -1;
      return false;
    }

    // 現在の2点の座標を取得
    const t1 = createVector(touches[0].x, touches[0].y);
    const t2 = createVector(touches[1].x, touches[1].y);

    // 1. 現在の中心点と距離を計算
    const currentCenter = p5.Vector.add(t1, t2).div(2);
    const currentDist = t1.dist(t2);

    // 前回のデータがない場合（タッチ開始直後など）、現在値を記録して終了
    if (this.prevTouchDist <= 0) {
      this.prevTouchDist = currentDist;
      this.prevTouchCenter = { x: currentCenter.x, y: currentCenter.y };
      return true;
    }

    // 2. パン（中心点の移動）の適用
    // 前回の中心点との差分をオフセットに加算
    const dx = currentCenter.x - this.prevTouchCenter.x;
    const dy = currentCenter.y - this.prevTouchCenter.y;
    this.viewOffsetX += dx;
    this.viewOffsetY += dy;

    // 3. ズーム（距離の変化）の適用
    if (currentDist > 0 && this.prevTouchDist > 0) {
      // 拡大率の変化比を計算
      const scaleFactor = currentDist / this.prevTouchDist;
      const newScale = this.viewScale * scaleFactor;

      // 制限（縮小しすぎ、拡大しすぎを防ぐ）
      // 例: 0.2倍 〜 5.0倍
      const constrainedScale = constrain(newScale, 0.2, 5.0);
      
      // 実際に適用される倍率比
      const effectiveFactor = constrainedScale / this.viewScale;

      // 重要: ズーム中心（指の間）がずれないようにオフセットを補正
      // 公式: 新オフセット = 指位置 - (指位置 - 旧オフセット) * 倍率比
      this.viewOffsetX = currentCenter.x - (currentCenter.x - this.viewOffsetX) * effectiveFactor;
      this.viewOffsetY = currentCenter.y - (currentCenter.y - this.viewOffsetY) * effectiveFactor;

      this.viewScale = constrainedScale;
    }

    // 次フレーム用に現在の状態を保存
    this.prevTouchDist = currentDist;
    this.prevTouchCenter = { x: currentCenter.x, y: currentCenter.y };
    
    return true;
  }

  /**
   * ★追加: 指定したスケールへズーム（画面中心を基準）
   * @param {number} newScale - 新しいスケール値
   * @param {number} canvasWidth - キャンバス幅
   * @param {number} canvasHeight - キャンバス高さ
   */
  setZoom(newScale, canvasWidth, canvasHeight) {
    // 制限（縮小しすぎ、拡大しすぎを防ぐ）
    const constrainedScale = constrain(newScale, 0.2, 5.0);
    
    // 現在の画面中心（スクリーン座標）
    const screenCenterX = canvasWidth / 2;
    const screenCenterY = canvasHeight / 2;

    // 現在の画面中心に対応するワールド座標を計算
    // (screen - offset) / oldScale
    const worldCenterX = (screenCenterX - this.viewOffsetX) / this.viewScale;
    const worldCenterY = (screenCenterY - this.viewOffsetY) / this.viewScale;

    // 新しいスケールを適用
    this.viewScale = constrainedScale;

    // ワールド中心が再び画面中心に来るようにオフセットを逆算
    // offset = screen - world * newScale
    this.viewOffsetX = screenCenterX - worldCenterX * this.viewScale;
    this.viewOffsetY = screenCenterY - worldCenterY * this.viewScale;
  }

  /**
   * ★追加: パン（視点移動）
   * @param {number} dx - X移動量
   * @param {number} dy - Y移動量
   */
  pan(dx, dy) {
    this.viewOffsetX += dx;
    this.viewOffsetY += dy;
  }

  /**
   * ビューポート変換を適用
   * p5.jsのtranslateとscaleを使用
   */
  applyTransform() {
    translate(this.viewOffsetX, this.viewOffsetY);
    scale(this.viewScale);
  }

  /**
   * 2本指操作のリセット
   */
  resetTwoFingerGesture() {
    this.prevTouchDist = -1;
  }
}
