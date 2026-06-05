'use strict';

import { CONST } from '../config/constants.js';

/**
 * パーツカウンター
 * パーツとワイヤーの数をカウントするユーティリティクラス
 */
export class PartsCounter {
  /**
   * パーツとワイヤーをカウントする
   * @param {Array} parts - パーツの配列
   * @param {Array} wires - ワイヤーの配列
   * @returns {Object} { partCounts: Map, total: number }
   */
  static countParts(parts, wires) {
    // 結果を格納するMap（表示順序を維持）
    const partCounts = new Map();
    
    // 表示順序に従って初期化（すべて0で初期化）
    for (const partType of CONST.PART_COUNT.DISPLAY_ORDER) {
      if (partType === 'WIRE') {
        // ワイヤーは後で処理
        continue;
      }
      partCounts.set(partType, 0);
    }
    
    // パーツをカウント
    for (const part of parts) {
      // 除外対象をスキップ
      if (CONST.PART_COUNT.EXCLUDED_TYPES.includes(part.type)) {
        continue;
      }
      
      // カウント
      const currentCount = partCounts.get(part.type) || 0;
      partCounts.set(part.type, currentCount + 1);
    }
    
    // ワイヤーをカウント（長さ0を除外）
    let validWireCount = 0;
    for (const wire of wires) {
      const startPos = wire.startSocket.getConnectorWorldPosition();
      const endPos = wire.endSocket.getConnectorWorldPosition();
      
      // 長さを計算（p5.jsのdist関数を使用）
      const length = dist(startPos.x, startPos.y, endPos.x, endPos.y);
      
      // SOCKET_HIT_RADIUS未満は「長さ0」として除外
      if (length >= CONST.PARTS.SOCKET_HIT_RADIUS) {
        validWireCount++;
      }
    }
    partCounts.set('WIRE', validWireCount);
    
    // 合計を計算
    let total = 0;
    for (const count of partCounts.values()) {
      total += count;
    }
    
    return {
      partCounts: partCounts,
      total: total
    };
  }
  
  /**
   * パーツタイプから表示名を取得
   * @param {string} partType - パーツタイプ
   * @returns {string} 表示名
   */
  static getDisplayName(partType) {
    return CONST.UI_LABELS[partType] || partType;
  }
}
