'use strict';

import { Wire } from '../models/Wire.js';
import { PartFactory } from '../models/PartFactory.js';
import { CONST } from '../config/constants.js';

// 部品タイプを数値に変換するマップ（データ圧縮用）
const TYPE_MAP = {
  [CONST.PART_TYPE.POWER]: 0,
  [CONST.PART_TYPE.WALL_SWITCH]: 1,
  [CONST.PART_TYPE.BUTTON]: 2,
  [CONST.PART_TYPE.AUTO_SWITCH]: 3,
  [CONST.PART_TYPE.INVERTER]: 4,
  [CONST.PART_TYPE.COLOR_LIGHT]: 5,
  [CONST.PART_TYPE.JOINT]: 6
};

// 数値から部品タイプに戻すための配列
const TYPE_LIST = [
  CONST.PART_TYPE.POWER,       // 0
  CONST.PART_TYPE.WALL_SWITCH, // 1
  CONST.PART_TYPE.BUTTON,      // 2
  CONST.PART_TYPE.AUTO_SWITCH, // 3
  CONST.PART_TYPE.INVERTER,    // 4
  CONST.PART_TYPE.COLOR_LIGHT, // 5
  CONST.PART_TYPE.JOINT        // 6
];

// ソケット名を数値に変換するマップ
const SOCKET_MAP = { 'left': 0, 'right': 1, 'bottom': 2, 'control': 3, 'center': 4 };

// 数値からソケット名に戻す配列
const SOCKET_LIST = ['left', 'right', 'bottom', 'control', 'center'];

/**
 * 回路データのシリアライズ・デシリアライズを担当するクラス
 * 保存形式の変換とデータの復元処理を提供
 */
export class CircuitSerializer {
  /**
   * 回路データをシリアライズ（保存・シェア共通処理）
   * @param {Array} parts - パーツ配列
   * @param {Array} wires - ワイヤー配列
   * @param {boolean} compact - true: URL用の軽量版、false: ファイル保存用の読みやすい版
   * @returns {Object|Array} シリアライズされた回路データ
   */
  static serialize(parts, wires, compact = false) {
    if (compact) {
      // 軽量版: IDをインデックス化
      // 1. IDのマッピング作成（元のID -> 配列のインデックス）
      const idToIndexMap = new Map();
      parts.forEach((part, index) => {
        idToIndexMap.set(part.id, index);
      });
      
      // 2. パーツ情報: [typeNum, x, y, rot, state?]
      // IDは配列のインデックスで代用するため保存しない
      const partsData = parts.map(part => {
        const x = Math.round(part.x);
        const y = Math.round(part.y);
        const rot = Math.round(part.rotation * 100) / 100;
        const typeNum = TYPE_MAP[part.type];
        
        const pData = [typeNum, x, y, rot];
        
        // isOnを持つ場合のみ追加（0 or 1）
        if (part.hasOwnProperty('isOn')) {
          pData.push(part.isOn ? 1 : 0);
        }
        
        return pData;
      });
      
      // 3. ワイヤー情報: [startIndex, startSockNum, endIndex, endSockNum]
      // IDではなくインデックス（0,1,2...）を保存
      const wiresData = wires.map(wire => [
        idToIndexMap.get(wire.startSocket.parent.id),
        SOCKET_MAP[wire.startSocket.name],
        idToIndexMap.get(wire.endSocket.parent.id),
        SOCKET_MAP[wire.endSocket.name]
      ]);
      
      // キー名すら使わず、配列のみにする
      // 構造: [version, partsArray, wiresArray]
      return [3, partsData, wiresData];
    } else {
      // 通常版: 読みやすい形式（ファイル保存用）
      const partsData = parts.map(part => {
        const data = {
          id: part.id,
          type: part.type,
          x: part.x,
          y: part.y,
          rotation: part.rotation
        };
        
        if (part.hasOwnProperty('isOn')) {
          data.isOn = part.isOn;
        }
        
        return data;
      });
      
      const wiresData = wires.map(wire => ({
        startPartId: wire.startSocket.parent.id,
        startSocket: wire.startSocket.name,
        endPartId: wire.endSocket.parent.id,
        endSocket: wire.endSocket.name
      }));
      
      return {
        version: '1.0',
        parts: partsData,
        wires: wiresData
      };
    }
  }

  /**
   * シリアライズされたデータから回路を復元（読込・URL復元共通処理）
   * @param {Object|Array} saveData - シリアライズされた回路データ
   * @param {Array} partsArray - 復元先のパーツ配列
   * @param {Array} wiresArray - 復元先のワイヤー配列
   */
  static deserialize(saveData, partsArray, wiresArray) {
    // 配列をクリア（参照は維持）
    partsArray.length = 0;
    wiresArray.length = 0;
    
    const partIdMap = new Map();
    
    // 軽量版（配列のみ）の場合
    if (Array.isArray(saveData) && saveData[0] === 3) {
      const partsList = saveData[1];
      const wiresList = saveData[2];
      
      // 復元したパーツを一時的に保持する配列（インデックスでアクセス）
      const tempParts = [];
      const baseId = Date.now(); // ID衝突防止のベースタイムスタンプ
      
      // パーツ復元: [typeNum, x, y, rot, state?]
      partsList.forEach((pData, index) => {
        const typeStr = TYPE_LIST[pData[0]];
        const x = pData[1];
        const y = pData[2];
        const rot = pData[3];
        
        // IDを新規発行（ベース時刻 + インデックス）
        const newId = baseId + index;
        
        const newPart = PartFactory.create(typeStr, newId, x, y);
        
        if (newPart) {
          newPart.rotation = rot;
          
          // 5番目の要素があればisOnを復元
          if (pData[4] !== undefined) {
            newPart.isOn = (pData[4] === 1);
          }
          
          partsArray.push(newPart);
          tempParts.push(newPart); // インデックス参照用に保持
        } else {
          // 生成に失敗してもnullを入れてインデックスずれを防ぐ
          console.warn(`パーツの復元に失敗しました: index ${index}`);
          tempParts.push(null);
        }
      });
      
      // ワイヤー復元: [startIndex, startSockNum, endIndex, endSockNum]
      wiresList.forEach(wData => {
        const startPart = tempParts[wData[0]];
        const startSockName = SOCKET_LIST[wData[1]];
        const endPart = tempParts[wData[2]];
        const endSockName = SOCKET_LIST[wData[3]];
        
        if (startPart && endPart) {
          const startSocket = startPart.getSocket(startSockName);
          const endSocket = endPart.getSocket(endSockName);
          
          if (startSocket && endSocket) {
            const wire = new Wire(startSocket, endSocket);
            wiresArray.push(wire);
          }
        }
      });
      
      console.log(`復元完了(v3): パーツ${partsArray.length}個, ワイヤー${wiresArray.length}本`);
    }
    // 通常形式の場合
    else if (saveData.version && saveData.parts && saveData.wires) {
      // パーツを復元
      for (const partData of saveData.parts) {
        const newPart = PartFactory.create(
          partData.type,
          partData.id,
          partData.x,
          partData.y
        );
        
        if (newPart) {
          newPart.rotation = partData.rotation || 0;
          
          if (partData.hasOwnProperty('isOn')) {
            newPart.isOn = partData.isOn;
          }
          
          partsArray.push(newPart);
          partIdMap.set(partData.id, newPart);
        }
      }
      
      // ワイヤーを復元
      for (const wireData of saveData.wires) {
        const startPart = partIdMap.get(wireData.startPartId);
        const endPart = partIdMap.get(wireData.endPartId);
        
        if (startPart && endPart) {
          const startSocket = startPart.getSocket(wireData.startSocket);
          const endSocket = endPart.getSocket(wireData.endSocket);
          
          if (startSocket && endSocket) {
            const wire = new Wire(startSocket, endSocket);
            wiresArray.push(wire);
          }
        }
      }
    }
    else {
      throw new Error(CONST.MESSAGES.ERROR_INVALID_FILE_FORMAT);
    }
  }
}
