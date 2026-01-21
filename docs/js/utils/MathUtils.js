'use strict';

/**
 * 数学計算のユーティリティ関数群
 * 角度計算、スナップ処理など、プロジェクト全体で使用する数学的な処理をまとめる
 */
export class MathUtils {
  /**
   * 角度を -PI ~ PI の範囲に正規化する
   * @param {number} radians - 正規化する角度（ラジアン）
   * @returns {number} 正規化された角度
   */
  static normalizeAngle(radians) {
    let normalized = radians;
    while (normalized > Math.PI) normalized -= Math.PI * 2;
    while (normalized < -Math.PI) normalized += Math.PI * 2;
    return normalized;
  }

  /**
   * 値を指定ステップで丸める（スナップ処理）
   * 座標や角度など、様々な値に使用できる
   * @param {number} value - 丸める値
   * @param {number} step - スナップする単位
   * @returns {number} 丸められた値
   */
  static snapValue(value, step) {
    return Math.round(value / step) * step;
  }

  /**
   * 角度を指定ステップでスナップする（ラジアン単位）
   * @param {number} radians - スナップする角度（ラジアン）
   * @param {number} stepDegrees - スナップ角度（度数法）例: 90, 45, 5 など
   * @returns {number} スナップされた角度（ラジアン）
   */
  static snapAngle(radians, stepDegrees) {
    // ラジアン → 度数法
    const degrees = radians * 180 / Math.PI;
    // スナップ
    const snappedDegrees = Math.round(degrees / stepDegrees) * stepDegrees;
    // 度数法 → ラジアン
    return snappedDegrees * Math.PI / 180;
  }

  /**
   * 座標をグリッドにスナップする（オフセット対応版）
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @param {number} snapUnit - スナップする単位（ピクセル）
   * @param {Object} offset - オフセット {x, y}
   * @returns {{x: number, y: number}} スナップされた座標
   */
  static snapPosition(x, y, snapUnit, offset = {x: 0, y: 0}) {
    return {
      x: Math.round((x - offset.x) / snapUnit) * snapUnit + offset.x,
      y: Math.round((y - offset.y) / snapUnit) * snapUnit + offset.y
    };
  }

  /**
   * 2つの角度の差分を最短経路で計算する
   * @param {number} target - 目標角度（ラジアン）
   * @param {number} current - 現在の角度（ラジアン）
   * @returns {number} 最短経路の差分（-PI ~ PI）
   */
  static angleDifference(target, current) {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  /**
   * 線形補間（lerp）
   * @param {number} start - 開始値
   * @param {number} end - 終了値
   * @param {number} t - 補間係数 (0.0 ~ 1.0)
   * @returns {number} 補間された値
   */
  static lerp(start, end, t) {
    return start + (end - start) * t;
  }

  /**
   * 値を指定範囲内にクランプする
   * @param {number} value - クランプする値
   * @param {number} min - 最小値
   * @param {number} max - 最大値
   * @returns {number} クランプされた値
   */
  static clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
}
