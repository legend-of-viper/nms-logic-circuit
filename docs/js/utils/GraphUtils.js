'use strict';

import { CONST } from '../config/constants.js';

/**
 * グラフアルゴリズム関連のユーティリティクラス
 * 回路のグラフ構造に対する計算処理を提供
 */
export class GraphUtils {
  /**
   * ドラッグ時のJoint追従係数を計算する
   * Source（動かすパーツ）からの距離と、Anchor（固定パーツ）からの距離の比率で決定
   * @param {CircuitPart} sourcePart - ドラッグを開始するパーツ
   * @returns {Map} Joint Object -> Weight(0.0~1.0) のマップ
   */
  static calculateJointWeights(sourcePart) {
    const weights = new Map(); // 結果用 (Joint Object -> Weight)
    const sourceDist = new Map(); // ID -> Distance
    const anchorDist = new Map(); // ID -> Distance
    const visited = new Set();
    const joints = []; // 関連する全Jointリスト

    // 1. Sourceからの距離を計算 (BFS)
    let queue = [{ part: sourcePart, dist: 0 }];
    visited.add(sourcePart.id);

    while (queue.length > 0) {
      const { part, dist } = queue.shift();
      
      for (const socket of part.sockets) {
        for (const wire of socket.connectedWires) {
          const otherSocket = wire.getOtherEnd(socket);
          if (!otherSocket) continue;
          
          const neighbor = otherSocket.parent;
          
          if (!visited.has(neighbor.id)) {
            visited.add(neighbor.id);
            
            if (neighbor.type === CONST.PART_TYPE.JOINT) {
              sourceDist.set(neighbor.id, dist + 1);
              joints.push(neighbor);
              queue.push({ part: neighbor, dist: dist + 1 });
            }
          }
        }
      }
    }

    if (joints.length === 0) return weights;

    // 2. Anchor（固定端）からの最短距離を計算 (Multi-Source BFS)
    queue = [];
    const anchorVisited = new Set();
    
    // 全Jointについて、「隣がAnchor（固定パーツ）」なら距離1としてスタート
    for (const joint of joints) {
      anchorDist.set(joint.id, Infinity);

      for (const socket of joint.sockets) {
        for (const wire of socket.connectedWires) {
          const otherSocket = wire.getOtherEnd(socket);
          if (!otherSocket) continue;
          
          const neighbor = otherSocket.parent;
          
          // Source以外のパーツ（＝Anchor）を発見したら
          if (neighbor.type !== CONST.PART_TYPE.JOINT && neighbor !== sourcePart) {
            if (!anchorVisited.has(joint.id)) {
               anchorDist.set(joint.id, 1);
               queue.push({ part: joint, dist: 1 });
               anchorVisited.add(joint.id);
            }
          }
        }
      }
    }

    // AnchorからのBFS実行
    while (queue.length > 0) {
      const { part, dist } = queue.shift();
      
      for (const socket of part.sockets) {
        for (const wire of socket.connectedWires) {
          const otherSocket = wire.getOtherEnd(socket);
          if (!otherSocket) continue;
          
          const neighbor = otherSocket.parent;
          
          // Sourceから到達可能なJointのみ対象
          if (neighbor.type === CONST.PART_TYPE.JOINT && sourceDist.has(neighbor.id)) {
            if (!anchorVisited.has(neighbor.id)) {
              anchorDist.set(neighbor.id, dist + 1);
              anchorVisited.add(neighbor.id);
              queue.push({ part: neighbor, dist: dist + 1 });
            }
          }
        }
      }
    }

    // 3. 重みの計算
    for (const joint of joints) {
      const sDist = sourceDist.get(joint.id);
      const aDist = anchorDist.get(joint.id); // 繋がっていない場合はInfinity
      
      let w = 1.0;
      
      if (aDist !== Infinity) {
        // 近いほうの影響を強く受ける（Sourceに近い=1.0、Anchorに近い=0.0）
        w = aDist / (sDist + aDist);
      }
      
      // IDではなくオブジェクトをキーにして保存（描画ループでのアクセス高速化）
      weights.set(joint, w);
    }
    
    return weights;
  }
}
