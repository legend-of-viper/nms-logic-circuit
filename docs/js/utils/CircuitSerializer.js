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

// 15bitマスク (0～32767: サロゲートペア領域 0xD800～ を回避)
const MASK_15BIT = 0x7FFF;

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
      // ★ v5 Safe Binary形式 (URL共有・複製用)
      return this.serializeToSafeBinary(parts, wires, viewState);
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
   * ★ v5: サロゲートペアフリー・30bit座標対応のバイナリシリアライズ
   * 数値を15bitごとに区切って文字化することで、安全性と圧縮率を両立
   */
  static serializeToSafeBinary(parts, wires, viewState) {
    const buffer = [];

    // ヘルパー: 値を15bit文字に変換して追加
    const push15 = (val) => {
      buffer.push(String.fromCharCode(val & MASK_15BIT));
    };

    // ヘルパー: 30bit符号付き整数を2文字で追加
    // 範囲: -536,870,912 ～ +536,870,911
    const push32 = (val) => {
      const v = Math.round(val);
      // 30bit範囲にクランプ
      const clamped = Math.max(-0x20000000, Math.min(0x1FFFFFFF, v));
      
      // 負の数を正の整数空間にマッピング (2の補数表現)
      const unsigned = (clamped < 0) ? (clamped + 0x40000000) : clamped;
      
      push15(unsigned);          // 下位15bit
      push15(unsigned >>> 15);   // 上位15bit
    };

    // ヘッダー: バージョン5 (文字コード5)
    push15(5);

    // 視点情報 (座標は30bit)
    push32(viewState.x);
    push32(viewState.y);
    push15(Math.round(viewState.scale * 100));

    // IDマッピング
    const idToIndexMap = new Map();
    parts.forEach((part, index) => {
      idToIndexMap.set(part.id, index);
    });

    // パーツ数
    push15(parts.length);

    // パーツデータ
    parts.forEach(part => {
      // Type(4bit) + State(1bit) をパック
      const typeNum = TYPE_MAP[part.type];
      const stateBit = (part.hasOwnProperty('isOn') && part.isOn) ? 1 : 0;
      const typeAndState = typeNum | (stateBit << 4);
      push15(typeAndState);

      // 座標 (30bit)
      push32(part.x);
      push32(part.y);
      
      // 回転 (0~2PI -> 0~32767)
      let normRot = part.rotation % (Math.PI * 2);
      if (normRot < 0) normRot += Math.PI * 2;
      const rotInt = Math.floor((normRot / (Math.PI * 2)) * MASK_15BIT);
      push15(rotInt);
    });

    // ワイヤー数
    push15(wires.length);

    // ワイヤーデータ
    wires.forEach(wire => {
      const startIdx = idToIndexMap.get(wire.startSocket.parent.id);
      const endIdx = idToIndexMap.get(wire.endSocket.parent.id);
      
      // インデックス(15bit: 最大32767パーツまで対応)
      push15(startIdx);
      push15(endIdx);

      // ソケット番号 (Start 4bit + End 4bit)
      const startSockNum = SOCKET_MAP[wire.startSocket.name];
      const endSockNum = SOCKET_MAP[wire.endSocket.name];
      const socketsPacked = startSockNum | (endSockNum << 4);
      push15(socketsPacked);
    });

    return buffer.join('');
  }

  /**
   * シリアライズされたデータから回路を復元（読込・URL復元共通処理）
   * @param {Object|Array|String} saveData - シリアライズされた回路データ
   * @param {Array} partsArray - 復元先のパーツ配列
   * @param {Array} wiresArray - 復元先のワイヤー配列
   * @returns {Object|null} 復元した視点情報 {x, y, scale} または null
   */
  static deserialize(saveData, partsArray, wiresArray) {
    // 文字列型なら v5 (Safe Binary) として処理
    if (typeof saveData === 'string') {
      return this.deserializeFromSafeBinary(saveData, partsArray, wiresArray);
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
   * ★ v5: バイナリ文字列からの復元
   */
  static deserializeFromSafeBinary(packedStr, partsArray, wiresArray) {
    partsArray.length = 0;
    wiresArray.length = 0;
    
    let cursor = 0;
    
    // ヘルパー: 15bit読み出し
    const read15 = () => {
      return packedStr.charCodeAt(cursor++);
    };
    
    // ヘルパー: 30bit符号付き整数読み出し
    const read32 = () => {
      const low = read15();
      const high = read15();
      
      // ビット結合 (High << 15 | Low)
      let val = low | (high << 15);
      
      // 符号復元: 29bit目(0x20000000)が立っていたら負の数
      if (val & 0x20000000) {
        // 上位ビットを全て1で埋めて 32bit符号付き整数にする
        val |= ~0x3FFFFFFF;
      }
      return val;
    };

    try {
      const version = read15();
      if (version !== 5) {
        console.warn("Unsupported packed version:", version);
        return null;
      }

      // 視点情報
      const vx = read32();
      const vy = read32();
      const vScale = read15() / 100;
      const restoredView = { x: vx, y: vy, scale: vScale };

      // パーツ
      const partsCount = read15();
      const tempParts = [];
      const baseId = Date.now();

      for (let i = 0; i < partsCount; i++) {
        const typeAndState = read15();
        const x = read32();
        const y = read32();
        const rotInt = read15();

        const typeNum = typeAndState & 0x0F;
        const stateBit = (typeAndState >> 4) & 0x01;
        
        const typeStr = TYPE_LIST[typeNum];
        const newPart = PartFactory.create(typeStr, baseId + i, x, y);

        if (newPart) {
          // 回転復元
          const rotRad = (rotInt / MASK_15BIT) * Math.PI * 2;
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

      // ワイヤー
      const wiresCount = read15();
      for (let i = 0; i < wiresCount; i++) {
        const startIdx = read15();
        const endIdx = read15();
        const socketsPacked = read15();

        const startPart = tempParts[startIdx];
        const endPart = tempParts[endIdx];

        if (startPart && endPart) {
          const startSockNum = socketsPacked & 0x0F;
          const endSockNum = (socketsPacked >> 4) & 0x0F;

          const sSock = startPart.getSocket(SOCKET_LIST[startSockNum]);
          const eSock = endPart.getSocket(SOCKET_LIST[endSockNum]);

          if (sSock && eSock) {
            wiresArray.push(new Wire(sSock, eSock));
          }
        }
      }

      console.log(`復元完了(v5 Safe): パーツ${partsArray.length}個, ワイヤー${wiresArray.length}本`);
      return restoredView;

    } catch (e) {
      console.error("v5 デシリアライズエラー:", e);
      alert("回路データの読み込みに失敗しました。URLが破損している可能性があります。");
      return null;
    }
  }

  /**
   * ★追加: 圧縮率比較用デバッグメソッド
   * ブラウザコンソールで CircuitSerializer.debugCompressionRate(parts, wires) を呼ぶと確認可能
   */
  static debugCompressionRate(parts, wires, viewState = {x:0, y:0, scale:1}) {
    console.log("=== 圧縮率比較テスト ===");
    console.log(`パーツ数: ${parts.length}, ワイヤー数: ${wires.length}`);
    
    try {
      // v3形式（参考用：手動生成）
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

      // v5形式
      const v5Raw = this.serializeToSafeBinary(parts, wires, viewState);
      const v5Compressed = LZString.compressToEncodedURIComponent(v5Raw);

      console.log(`v3 (JSON配列):`);
      console.log(`  生データ: ${v3Raw.length} chars`);
      console.log(`  圧縮後: ${v3Compressed.length} chars`);
      console.log(`v5 (Safe Binary):`);
      console.log(`  生データ: ${v5Raw.length} chars`);
      console.log(`  圧縮後: ${v5Compressed.length} chars`);
      
      const reduction = ((1 - v5Compressed.length / v3Compressed.length) * 100).toFixed(2);
      console.log(`削減率: ${reduction}%`);
      console.log("========================");
      
      return {
        v3Size: v3Compressed.length,
        v5Size: v5Compressed.length,
        reduction: parseFloat(reduction)
      };
    } catch (error) {
      console.error("テスト中にエラー:", error);
      return null;
    }
  }
}
