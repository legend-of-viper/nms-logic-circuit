'use strict';

/**
 * 値を目標値に向かって滑らかに変化させるクラス
 * 座標、透明度、スケールなど、様々な数値のアニメーションに使用できる
 */
export class SmoothValue {
  /**
   * @param {number} initialValue - 初期値
   * @param {number} speed - 1フレームで近づく割合 (0.0～1.0)
   * @param {number} snapThreshold - 目標値と見なす誤差の範囲
   */
  constructor(initialValue, speed = 0.3, snapThreshold = 0.5) {
    this.value = initialValue;
    this.target = initialValue;
    this.speed = speed;
    this.threshold = snapThreshold;
  }

  /**
   * 目標値を設定
   * @param {number} v - 新しい目標値
   */
  setTarget(v) {
    this.target = v;
  }

  /**
   * アニメーションなしで即時反映（ロード時や初期化時に使用）
   * @param {number} v - 設定する値
   */
  setImmediate(v) {
    this.value = v;
    this.target = v;
  }

  /**
   * 毎フレーム呼ぶ更新処理
   * @returns {boolean} アニメーション中かどうか（true=動いている, false=停止）
   */
  update() {
    const diff = this.target - this.value;
    
    // 差が小さければ吸着
    if (Math.abs(diff) < this.threshold) {
      this.value = this.target;
      return false; // 動いていない
    }
    
    // イージング（線形補間）
    this.value += diff * this.speed;
    return true; // 動いている
  }

  /**
   * 現在アニメーション中かどうか
   * @returns {boolean}
   */
  isAnimating() {
    return Math.abs(this.target - this.value) >= this.threshold;
  }
}

/**
 * 角度専用（-PI ~ PI のループ対応版）
 * 最短経路で回転するように計算する
 */
export class SmoothRotation extends SmoothValue {
  /**
   * @param {number} initialValue - 初期角度（ラジアン）
   * @param {number} speed - 1フレームで近づく割合 (0.0～1.0)
   * @param {number} snapThreshold - 目標値と見なす誤差の範囲（ラジアン）
   */
  constructor(initialValue, speed = 0.2, snapThreshold = 0.001) {
    super(initialValue, speed, snapThreshold);
  }

  /**
   * 角度の更新処理（最短経路で回転）
   * @returns {boolean} アニメーション中かどうか
   */
  update() {
    let diff = this.target - this.value;

    // 角度の正規化（最短経路で回転させる計算）
    // 例: 350度から10度に回転する場合、-340度ではなく+20度で回転
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // 差が小さければ吸着
    if (Math.abs(diff) < this.threshold) {
      this.value = this.target;
      
      // 値の発散防止（見た目は同じだが数値を -PI ~ PI の範囲内に戻す）
      this.normalizeValue();
      
      return false;
    }

    // イージング
    this.value += diff * this.speed;
    return true;
  }

  /**
   * 値を -PI ~ PI の範囲に正規化する
   * 数値の発散を防ぐため、定期的に呼ぶと良い
   */
  normalizeValue() {
    if (this.value > Math.PI) {
      this.value -= Math.PI * 2;
      this.target -= Math.PI * 2;
    } else if (this.value < -Math.PI) {
      this.value += Math.PI * 2;
      this.target += Math.PI * 2;
    }
  }
}
