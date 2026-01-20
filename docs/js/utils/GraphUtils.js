'use strict';

import { CONST } from '../config/constants.js';

/**
 * グラフアルゴリズム関連のユーティリティクラス
 * 回路のグラフ構造に対する計算処理を提供
 */
export class GraphUtils {
  /**
   * ドラッグ時のJoint追従係数を計算する
   * 仕様変更:
   * ・アンカー（固定パーツ）に繋がっているJoint群 -> 全く動かない (Weight 0.0)
   * ・アンカーに繋がっていない（浮いている）Joint群 -> 完全に追従する (Weight 1.0)
   * @param {CircuitPart} sourcePart - ドラッグを開始するパーツ
   * @returns {Map} Joint Object -> Weight(0.0 or 1.0) のマップ
   */
  static calculateJointWeights(sourcePart) {
    const weights = new Map();
    const visited = new Set();
    const joints = []; // Sourceに連結している全Jointリスト
    let hasAnchor = false; // アンカー（固定パーツ）が見つかったか

    // Sourceを訪問済みにしておく（逆流防止）
    visited.add(sourcePart.id);

    // BFS用のキュー
    let queue = [];

    // 1. まずSourceに直接繋がっているJointを探してキューに入れる
    for (const socket of sourcePart.sockets) {
      for (const wire of socket.connectedWires) {
        const otherSocket = wire.getOtherEnd(socket);
        if (!otherSocket) continue;
        
        const neighbor = otherSocket.parent;
        
        if (neighbor.type === CONST.PART_TYPE.JOINT) {
          if (!visited.has(neighbor.id)) {
            visited.add(neighbor.id);
            joints.push(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }

    // 2. Jointを辿って連結成分を探索
    while (queue.length > 0) {
      const currentJoint = queue.shift();

      for (const socket of currentJoint.sockets) {
        for (const wire of socket.connectedWires) {
          const otherSocket = wire.getOtherEnd(socket);
          if (!otherSocket) continue;

          const neighbor = otherSocket.parent;

          // Sourceに戻るルートは無視
          if (neighbor.id === sourcePart.id) continue;

          if (neighbor.type === CONST.PART_TYPE.JOINT) {
            // まだ訪れていないJointなら探索を続ける
            if (!visited.has(neighbor.id)) {
              visited.add(neighbor.id);
              joints.push(neighbor);
              queue.push(neighbor);
            }
          } else {
            // JointでもSourceでもないパーツ = Anchor（固定端）を発見
            hasAnchor = true;
            // Anchorの先は探索不要なのでキューには入れない
          }
        }
      }
    }

    // 3. 重みの決定
    // アンカーが見つかったら「動かない(0.0)」、見つからなければ「ついてくる(1.0)」
    const weightValue = hasAnchor ? 0.0 : 1.0;

    for (const joint of joints) {
      weights.set(joint, weightValue);
    }
    
    return weights;
  }
}