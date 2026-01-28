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

  /**
   * 選択されたパーツ群に囲まれた（道連れにすべき）Jointを特定する
   * @param {Array} allParts - 全パーツのリスト
   * @param {Set} selectedParts - ユーザーが選択中のパーツセット
   * @returns {Set} 自動的に追従すべきJointのセット
   */
  static findEnclosedJoints(allParts, selectedParts) {
    const implicitJoints = new Set();
    const visited = new Set(); // 探索済みのJointを記録

    // 全パーツの中から「未選択のJoint」を探して探索開始
    for (const part of allParts) {
      if (part.type !== CONST.PART_TYPE.JOINT) continue;
      if (selectedParts.has(part)) continue; // 既に明示的に選択されている
      if (visited.has(part)) continue; // 既にチェック済みのクラスタに含まれる

      // ---------------------------------------------------
      // Jointのクラスタ（塊）を探索する (幅優先探索: BFS)
      // ---------------------------------------------------
      const cluster = [];   // この塊に含まれるJointリスト
      const queue = [part]; // 探索キュー
      visited.add(part);

      let isEnclosed = true; // この塊は完全に選択パーツに囲まれているか？
      let hasAnchor = false; // 少なくとも1つ、選択パーツ（動くもの）に繋がっているか？

      while (queue.length > 0) {
        const current = queue.shift();
        cluster.push(current);

        const socket = current.getSocket('center');
        if (!socket) continue;

        for (const wire of socket.connectedWires) {
          const otherEnd = wire.getOtherEnd(socket);
          if (!otherEnd) continue;
          
          const neighbor = otherEnd.parent;

          if (neighbor.type === CONST.PART_TYPE.JOINT) {
             // --- 隣がJointの場合 ---
             if (selectedParts.has(neighbor)) {
               // 万が一「選択済みのJoint」があれば、それは「動く壁」なのでアンカー扱い
               hasAnchor = true;
             } else if (!visited.has(neighbor)) {
               // 「未選択のJoint」なら、クラスタの仲間なので探索を広げる
               visited.add(neighbor);
               queue.push(neighbor);
             }
          } else {
             // --- 隣が普通のパーツの場合 ---
             if (selectedParts.has(neighbor)) {
               // 選択済みパーツに繋がっている -> 一緒に動く理由になる
               hasAnchor = true;
             } else {
               // 未選択パーツに繋がっている -> 置いていくべき（囲まれていない）
               isEnclosed = false;
             }
          }
        }
      }

      // 条件判定:
      // 1. 外部への接続がすべて選択済みパーツである (isEnclosed)
      // 2. 孤立しておらず、ちゃんと何かに繋がっている (hasAnchor)
      // これらを満たすなら、クラスタごと道連れリストに追加
      if (isEnclosed && hasAnchor) {
        cluster.forEach(j => implicitJoints.add(j));
      }
    }

    return implicitJoints;
  }
}