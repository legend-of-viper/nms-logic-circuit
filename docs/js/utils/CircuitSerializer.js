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
 * ★ v6用: ビット単位の書き込み/読み込みを行うヘルパークラス
 */
class BitStream {
  constructor(base64String = '') {
    this.bits = [];
    this.readIndex = 0;
    
    if (base64String) {
      this.fromBase64(base64String);
    }
  }

  write(value, numBits) {
    for (let i = 0; i < numBits; i++) {
      this.bits.push((value >> i) & 1);
    }
  }

  read(numBits) {
    let value = 0;
    for (let i = 0; i < numBits; i++) {
      if (this.readIndex >= this.bits.length) return 0;
      const bit = this.bits[this.readIndex++];
      value |= (bit << i);
    }
    return value;
  }
  
  write30Signed(val) {
    const v = Math.round(val);
    const clamped = Math.max(-0x20000000, Math.min(0x1FFFFFFF, v));
    const unsigned = (clamped < 0) ? (clamped + 0x40000000) : clamped;
    this.write(unsigned, 30);
  }

  read30Signed() {
    let val = this.read(30);
    if (val & 0x20000000) {
      val |= ~0x3FFFFFFF;
    }
    return val;
  }

  toBase64() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let output = "";
    for (let i = 0; i < this.bits.length; i += 6) {
      let val = 0;
      for (let j = 0; j < 6; j++) {
        if (i + j < this.bits.length) {
          val |= (this.bits[i + j] << j);
        }
      }
      output += chars[val];
    }
    return output;
  }

  fromBase64(str) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const map = {};
    for (let i = 0; i < chars.length; i++) {
      map[chars[i]] = i;
    }
    
    this.bits = [];
    for (let i = 0; i < str.length; i++) {
      const val = map[str[i]];
      if (val === undefined) continue;
      for (let j = 0; j < 6; j++) {
        this.bits.push((val >> j) & 1);
      }
    }
    this.readIndex = 0;
  }
}

/**
 * 回路データのシリアライズ・デシリアライズを担当するクラス
 * 保存形式の変換とデータの復元処理を提供
 */
export class CircuitSerializer {
  /**
   * 回路データをシリアライズ（保存・シェア共通処理）
   * @param {Array} parts - パーツ配列
   * @param {Array} wires - ワイヤー配列
   * @param {boolean} compact - true: URL用の軽量版(v5)、false: ファイル保存用の読みやすい版(v1.1)
   * @param {Object} viewState - {x, y, scale} 視点情報
   * @returns {Object|String} シリアライズされた回路データ
   */
  static serialize(parts, wires, compact = false, viewState = {x:0, y:0, scale:1}) {
    if (compact) {
      // ★ v6 Adaptive Bit Packing (URL共有・複製用)
      return this.serializeToBitStream(parts, wires, viewState);
    } else {
      // v1.1 JSONオブジェクト形式 (ファイル保存用)
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
        version: '1.1',
        parts: partsData,
        wires: wiresData,
        view: {
          x: viewState.x,
          y: viewState.y,
          scale: viewState.scale
        }
      };
    }
  }

  /**
   * ★ v6: 適応型ビットパッキング・シリアライザ (LZStringなし)
   */
  static serializeToBitStream(parts, wires, viewState) {
    const stream = new BitStream();
    
    // ヘッダー: バージョン6 (4bit)
    stream.write(6, 4);

    // バウンディングボックス計算
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    const points = parts.map(p => ({x: p.x, y: p.y}));
    points.push({x: viewState.x, y: viewState.y});
    
    points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    if (minX === Infinity) {
      minX = 0; maxX = 0; minY = 0; maxY = 0;
    }

    // 必要なビット数を計算
    const width = Math.ceil(maxX - minX) + 100;
    const height = Math.ceil(maxY - minY) + 100;
    
    const bitsX = Math.max(1, Math.ceil(Math.log2(width + 1)));
    const bitsY = Math.max(1, Math.ceil(Math.log2(height + 1)));

    // 基準座標（30bit）
    stream.write30Signed(minX);
    stream.write30Signed(minY);
    
    // 相対座標用ビット数（5bit）
    stream.write(bitsX, 5);
    stream.write(bitsY, 5);

    // 視点情報
    stream.write(Math.round(viewState.x - minX), bitsX);
    stream.write(Math.round(viewState.y - minY), bitsY);
    stream.write(Math.round(viewState.scale * 100), 9);

    // IDマッピング
    const idToIndexMap = new Map();
    parts.forEach((part, index) => {
      idToIndexMap.set(part.id, index);
    });

    // パーツ数（15bit）
    stream.write(parts.length, 15);

    // パーツデータ
    parts.forEach(part => {
      stream.write(TYPE_MAP[part.type], 4);
      
      const stateBit = (part.hasOwnProperty('isOn') && part.isOn) ? 1 : 0;
      stream.write(stateBit, 1);

      stream.write(Math.round(part.x - minX), bitsX);
      stream.write(Math.round(part.y - minY), bitsY);
      
      let normRot = part.rotation % (Math.PI * 2);
      if (normRot < 0) normRot += Math.PI * 2;
      const rotInt = Math.floor((normRot / (Math.PI * 2)) * 1023);
      stream.write(rotInt, 10);
    });

    // ワイヤー数（15bit）
    stream.write(wires.length, 15);

    const indexBits = parts.length > 0 ? Math.max(1, Math.ceil(Math.log2(parts.length + 1))) : 1;

    wires.forEach(wire => {
      const startIdx = idToIndexMap.get(wire.startSocket.parent.id);
      const endIdx = idToIndexMap.get(wire.endSocket.parent.id);
      
      stream.write(startIdx, indexBits);
      stream.write(endIdx, indexBits);

      stream.write(SOCKET_MAP[wire.startSocket.name], 3);
      stream.write(SOCKET_MAP[wire.endSocket.name], 3);
    });

    return stream.toBase64();
  }

  /**
   * シリアライズされたデータから回路を復元（読込・URL復元共通処理）
   * @param {Object|Array|String} saveData - シリアライズされた回路データ
   * @param {Array} partsArray - 復元先のパーツ配列
   * @param {Array} wiresArray - 復元先のワイヤー配列
   * @returns {Object|null} 復元した視点情報 {x, y, scale} または null
   */
  static deserialize(saveData, partsArray, wiresArray) {
    // 文字列型ならv6 (Bit Packing) として処理
    if (typeof saveData === 'string') {
      return this.deserializeFromBitStream(saveData, partsArray, wiresArray);
    }

    // 配列をクリア（参照は維持）
    partsArray.length = 0;
    wiresArray.length = 0;
    
    const partIdMap = new Map();
    let restoredView = null;
    
    // v3 (配列形式 - 後方互換性のため維持)
    if (Array.isArray(saveData) && saveData[0] === 3) {
      const partsList = saveData[1];
      const wiresList = saveData[2];
      const tempParts = [];
      const baseId = Date.now();
      
      partsList.forEach((pData, index) => {
        const typeStr = TYPE_LIST[pData[0]];
        const newPart = PartFactory.create(typeStr, baseId + index, pData[1], pData[2]);
        
        if (newPart) {
          newPart.setRotationImmediately(pData[3]);
          if (pData[4] !== undefined) {
            newPart.isOn = (pData[4] === 1);
          }
          partsArray.push(newPart);
          tempParts.push(newPart);
        } else {
          console.warn(`パーツの復元に失敗しました: index ${index}`);
          tempParts.push(null);
        }
      });
      
      wiresList.forEach(wData => {
        const startPart = tempParts[wData[0]];
        const endPart = tempParts[wData[2]];
        if (startPart && endPart) {
          const sSock = startPart.getSocket(SOCKET_LIST[wData[1]]);
          const eSock = endPart.getSocket(SOCKET_LIST[wData[3]]);
          if (sSock && eSock) {
            wiresArray.push(new Wire(sSock, eSock));
          }
        }
      });
      
      if (saveData[3] && saveData[3].length >= 3) {
        restoredView = {
          x: saveData[3][0],
          y: saveData[3][1],
          scale: saveData[3][2]
        };
      }
      
      console.log(`復元完了(v3): パーツ${partsArray.length}個, ワイヤー${wiresArray.length}本`);
      return restoredView;
    }
    // v1.1 (オブジェクト形式 - ファイル保存用)
    else if (saveData.version && saveData.parts && saveData.wires) {
      for (const partData of saveData.parts) {
        const newPart = PartFactory.create(
          partData.type,
          partData.id,
          partData.x,
          partData.y
        );
        
        if (newPart) {
          newPart.setRotationImmediately(partData.rotation || 0);
          if (partData.hasOwnProperty('isOn')) {
            newPart.isOn = partData.isOn;
          }
          partsArray.push(newPart);
          partIdMap.set(partData.id, newPart);
        }
      }
      
      for (const wireData of saveData.wires) {
        const startPart = partIdMap.get(wireData.startPartId);
        const endPart = partIdMap.get(wireData.endPartId);
        
        if (startPart && endPart) {
          const startSocket = startPart.getSocket(wireData.startSocket);
          const endSocket = endPart.getSocket(wireData.endSocket);
          
          if (startSocket && endSocket) {
            wiresArray.push(new Wire(startSocket, endSocket));
          }
        }
      }
      
      if (saveData.view) {
        restoredView = {
          x: saveData.view.x || 0,
          y: saveData.view.y || 0,
          scale: saveData.view.scale || 1.0
        };
      }
      
      console.log(`復元完了(v1.1): パーツ${partsArray.length}個, ワイヤー${wiresArray.length}本`);
      return restoredView;
    }
    else {
      throw new Error(CONST.MESSAGES.ERROR_INVALID_FILE_FORMAT);
    }
  }

  /**
   * ★ v6: ビットストリームからの復元
   */
  static deserializeFromBitStream(base64Str, partsArray, wiresArray) {
    partsArray.length = 0;
    wiresArray.length = 0;
    
    const stream = new BitStream(base64Str);
    
    try {
      const version = stream.read(4);
      if (version !== 6) {
        console.warn("Unsupported version:", version);
        return null;
      }

      const minX = stream.read30Signed();
      const minY = stream.read30Signed();
      const bitsX = stream.read(5);
      const bitsY = stream.read(5);

      const vx = minX + stream.read(bitsX);
      const vy = minY + stream.read(bitsY);
      const vScale = stream.read(9) / 100;
      const restoredView = { x: vx, y: vy, scale: vScale };

      const partsCount = stream.read(15);
      const tempParts = [];
      const baseId = Date.now();

      for (let i = 0; i < partsCount; i++) {
        const typeNum = stream.read(4);
        const stateBit = stream.read(1);
        
        const dx = stream.read(bitsX);
        const dy = stream.read(bitsY);
        const x = minX + dx;
        const y = minY + dy;

        const rotInt = stream.read(10);

        const typeStr = TYPE_LIST[typeNum];
        const newPart = PartFactory.create(typeStr, baseId + i, x, y);

        if (newPart) {
          const rotRad = (rotInt / 1023) * Math.PI * 2;
          newPart.setRotationImmediately(rotRad);

          if (newPart.hasOwnProperty('isOn')) {
            newPart.isOn = (stateBit === 1);
          }
          
          partsArray.push(newPart);
          tempParts.push(newPart);
        } else {
          tempParts.push(null);
        }
      }

      const wiresCount = stream.read(15);
      const indexBits = partsCount > 0 ? Math.max(1, Math.ceil(Math.log2(partsCount + 1))) : 1;

      for (let i = 0; i < wiresCount; i++) {
        const startIdx = stream.read(indexBits);
        const endIdx = stream.read(indexBits);
        const startSockNum = stream.read(3);
        const endSockNum = stream.read(3);

        const startPart = tempParts[startIdx];
        const endPart = tempParts[endIdx];

        if (startPart && endPart) {
          const sSock = startPart.getSocket(SOCKET_LIST[startSockNum]);
          const eSock = endPart.getSocket(SOCKET_LIST[endSockNum]);
          if (sSock && eSock) {
            wiresArray.push(new Wire(sSock, eSock));
          }
        }
      }

      console.log(`復元完了(v6 BitPacked): パーツ${partsCount}個, ワイヤー${wiresCount}本`);
      return restoredView;

    } catch (e) {
      console.error("v6 デシリアライズエラー:", e);
      alert("回路データの読み込みに失敗しました。URLが破損している可能性があります。");
      return null;
    }
  }

  /**
   * ★追加: 圧縮率比較用デバッグメソッド（v3 vs v6）
   */
  static debugCompressionRate(parts, wires, viewState = {x:0, y:0, scale:1}) {
    console.log("=== 圧縮率比較テスト (v3 vs v6) ===");
    console.log(`パーツ数: ${parts.length}, ワイヤー数: ${wires.length}`);
    
    try {
      // v3形式
      const idMap = new Map();
      parts.forEach((p, i) => idMap.set(p.id, i));
      const v3Parts = parts.map(p => {
        const pData = [
          TYPE_MAP[p.type],
          Math.round(p.x),
          Math.round(p.y),
          Math.round(p.rotation * 100) / 100
        ];
        if (p.hasOwnProperty('isOn')) {
          pData.push(p.isOn ? 1 : 0);
        }
        return pData;
      });
      const v3Wires = wires.map(w => [
        idMap.get(w.startSocket.parent.id),
        SOCKET_MAP[w.startSocket.name],
        idMap.get(w.endSocket.parent.id),
        SOCKET_MAP[w.endSocket.name]
      ]);
      const v3ViewData = [
        Math.round(viewState.x),
        Math.round(viewState.y),
        Math.round(viewState.scale * 100) / 100
      ];
      const v3Raw = JSON.stringify([3, v3Parts, v3Wires, v3ViewData]);
      const v3Compressed = LZString.compressToEncodedURIComponent(v3Raw);

      // v6形式（LZStringなし）
      const v6Raw = this.serializeToBitStream(parts, wires, viewState);

      console.log(`v3 (JSON + LZString):`);
      console.log(`  生データ: ${v3Raw.length} chars`);
      console.log(`  圧縮後: ${v3Compressed.length} chars`);
      console.log(`v6 (Bit Packing, LZStringなし):`);
      console.log(`  Base64直接: ${v6Raw.length} chars`);
      
      const reduction = ((1 - v6Raw.length / v3Compressed.length) * 100).toFixed(2);
      console.log(`\nv6削減率: ${reduction}% (vs v3)`);
      console.log("=========================================");
      
      return {
        v3Size: v3Compressed.length,
        v6Size: v6Raw.length,
        reduction: parseFloat(reduction)
      };
    } catch (error) {
      console.error("テスト中にエラー:", error);
      return null;
    }
  }
}
