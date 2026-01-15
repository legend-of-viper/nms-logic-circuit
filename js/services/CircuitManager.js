'use strict';

import { Wire } from '../models/Wire.js';
import { PartFactory } from '../models/PartFactory.js';
import { PowerSystem } from './PowerSystem.js';
import { InputManager } from './InputManager.js';
import { CONST } from '../config/constants.js';

// 部品タイプを数値に変換するマップ（データ圧縮用）
const TYPE_MAP = {
  [CONST.PART_TYPE.POWER]: 0,
  [CONST.PART_TYPE.WALL_SWITCH]: 1,
  [CONST.PART_TYPE.BUTTON]: 2,
  [CONST.PART_TYPE.AUTO_SWITCH]: 3,
  [CONST.PART_TYPE.INVERTER]: 4,
  [CONST.PART_TYPE.COLOR_LIGHT]: 5
};

// 数値から部品タイプに戻すための配列
const TYPE_LIST = [
  CONST.PART_TYPE.POWER,       // 0
  CONST.PART_TYPE.WALL_SWITCH, // 1
  CONST.PART_TYPE.BUTTON,      // 2
  CONST.PART_TYPE.AUTO_SWITCH, // 3
  CONST.PART_TYPE.INVERTER,    // 4
  CONST.PART_TYPE.COLOR_LIGHT  // 5
];

// ソケット名を数値に変換するマップ
const SOCKET_MAP = { 'left': 0, 'right': 1, 'bottom': 2, 'control': 3 };

// 数値からソケット名に戻す配列
const SOCKET_LIST = ['left', 'right', 'bottom', 'control'];

/**
 * 回路マネージャー
 * 回路部品とワイヤーの管理、描画、インタラクションを制御
 */
export class CircuitManager {
  constructor() {
    this.parts = [];
    this.wires = [];

    this.powerSystem = new PowerSystem(this.parts, this.wires);
    this.inputManager = new InputManager();

    this.draggingPart = null;
    this.wiringStartNode = null;
    this.rotationSnapEnabled = true; // デフォルトで90度スナップを有効
    this.isDeleteMode = false; // 削除モード
  }

  /**
   * スクリーン座標をワールド座標に変換
   * （InputManagerに委譲）
   * @param {number} screenX - スクリーンX座標
   * @param {number} screenY - スクリーンY座標
   * @returns {{x: number, y: number}} ワールド座標
   */
  getWorldPosition(screenX, screenY) {
    return this.inputManager.getWorldPosition(screenX, screenY);
  }

  /**
   * InputManagerへのアクセス（UIなどから使用）
   * @returns {InputManager}
   */
  getInputManager() {
    return this.inputManager;
  }

  /**
   * 回転スナップの有効/無効を設定
   * @param {boolean} enabled
   */
  setRotationSnap(enabled) {
    this.rotationSnapEnabled = enabled;
  }

  /**
   * 削除モードの切り替え
   */
  toggleDeleteMode() {
    this.isDeleteMode = !this.isDeleteMode;
    console.log(`削除モード: ${this.isDeleteMode ? 'ON' : 'OFF'}`);
  }

  /**
   * 削除モードの状態を取得
   * @returns {boolean}
   */
  getDeleteMode() {
    return this.isDeleteMode;
  }

  /**
   * パーツを安全に削除（関連するワイヤーも削除）
   * @param {CircuitPart} targetPart - 削除対象のパーツ
   */
  deletePart(targetPart) {
    // 手順A: この部品に繋がっているワイヤーを全て探して消す
    for (let i = this.wires.length - 1; i >= 0; i--) {
      const wire = this.wires[i];
      
      // ワイヤーの始点か終点が、消そうとしている部品なら削除
      if (wire.startSocket.parent === targetPart || wire.endSocket.parent === targetPart) {
        // ソケットの接続情報から削除（三角形が残らないようにする）
        wire.startSocket.disconnectWire(wire);
        wire.endSocket.disconnectWire(wire);
        
        this.wires.splice(i, 1);
      }
    }

    // 手順B: 部品リストから本体を削除
    const index = this.parts.indexOf(targetPart);
    if (index > -1) {
      this.parts.splice(index, 1);
      console.log("部品を削除しました");
    }
  }

  /**
   * ワイヤーを削除
   * @param {Wire} targetWire - 削除対象のワイヤー
   */
  deleteWire(targetWire) {
    // ワイヤーリストから削除
    const index = this.wires.indexOf(targetWire);
    if (index > -1) {
      // ソケットの接続情報から削除
      targetWire.startSocket.disconnectWire(targetWire);
      targetWire.endSocket.disconnectWire(targetWire);
      
      this.wires.splice(index, 1);
      console.log("ワイヤーを削除しました");
    }
  }

  /**
   * 全てのパーツとワイヤーをリセット（削除）
   */
  resetAll() {
    // 全てのワイヤーの接続情報をクリア
    for (let wire of this.wires) {
      wire.startSocket.disconnectWire(wire);
      wire.endSocket.disconnectWire(wire);
    }
    
    // 配列をクリア
    this.parts.length = 0;
    this.wires.length = 0;
    
    // ドラッグ状態などもリセット
    this.draggingPart = null;
    this.wiringStartNode = null;
    
    console.log("全てのパーツとワイヤーをリセットしました");
  }

  /**
   * 部品を作成して追加
   * @param {string} type - 部品タイプ ('POWER', 'WALL_SWITCH', 'BUTTON', etc.)
   * @param {number} x - ワールドX座標
   * @param {number} y - ワールドY座標
   */
  createPart(type, x, y) {
    const newId = Date.now();
    
    // Factoryを使って生成
    const newPart = PartFactory.create(type, newId, x, y);
    
    if (newPart) {
      this.parts.push(newPart);
    }
  }

  /**
   * 仮ワイヤーの描画（マウスについてくる線）
   */
  drawTempWire() {
    if (!this.wiringStartNode) return;
    
    const startPos = this.wiringStartNode.socket.getConnectorWorldPosition();
    
    // マウス座標をワールド座標に変換
    const worldMouse = this.getWorldPosition(mouseX, mouseY);
    
    // 近くのコネクタを探してスナップする
    let endPos = { x: worldMouse.x, y: worldMouse.y };
    let snapped = false;
    
    for (let part of this.parts) {
      for (let socket of part.sockets) {
        const connectorPos = socket.getConnectorWorldPosition();
        const distance = dist(worldMouse.x, worldMouse.y, connectorPos.x, connectorPos.y);
        
        // 同じソケットでなく、かつヒット範囲内ならスナップ
        const isSameSocket = (socket === this.wiringStartNode.socket);
        if (!isSameSocket && distance < CONST.PARTS.SOCKET_HIT_RADIUS) {
          endPos = connectorPos;
          snapped = true;
          break;
        }
      }
      if (snapped) break;
    }
    
    stroke(...CONST.COLORS.WIRE_TEMP, CONST.WIRE.TEMP_ALPHA);
    strokeWeight(2);
    
    line(startPos.x, startPos.y, endPos.x, endPos.y);
  }

  /**
   * 指定座標にある削除対象を取得（ワイヤー優先、次にパーツ）
   * PC/スマホ共通の判定ロジック
   * @param {number} worldX - ワールドX座標
   * @param {number} worldY - ワールドY座標
   * @returns {{type: string, target: any} | null} 削除対象とタイプ
   */
  getDeletionTarget(worldX, worldY) {
    // 1. ワイヤーをチェック（細いので優先的に判定）
    // 逆順ループで手前（描画順が後）のものを優先
    for (let i = this.wires.length - 1; i >= 0; i--) {
      const wire = this.wires[i];
      // 判定閾値は少し広めに（PCは10px、スマホ操作も考慮して15pxくらい余裕を持たせる）
      if (wire.isMouseOver(worldX, worldY, 15)) {
        return { type: 'wire', target: wire };
      }
    }
    
    // 2. パーツをチェック
    const snapDistance = CONST.PARTS.WIDTH * 0.8; // 少し厳しめにして密集地での誤爆を防ぐ
    let closestPart = null;
    let closestDist = snapDistance;

    for (let i = this.parts.length - 1; i >= 0; i--) {
      const part = this.parts[i];
      const center = part.getCenter();
      const distVal = dist(worldX, worldY, center.x, center.y);
      
      if (distVal < closestDist) {
        closestDist = distVal;
        closestPart = part;
      }
    }
    
    if (closestPart) {
      return { type: 'part', target: closestPart };
    }
    
    return null;
  }

  /**
   * 削除モードの警告表示
   */
  drawDeleteModeWarning() {
    if (!this.isDeleteMode) return;
    
    push();
    // 画面中央上部に警告テキスト
    textAlign(CENTER, TOP);
    textSize(18);
    fill(255, 100, 100);
    stroke(0);
    strokeWeight(3);
    text(CONST.MESSAGES.TEXT_DELETE_MODE, width / 2, 20);
    pop();
  }

  /**
   * キャンバスの更新と描画
   */
  update() {
    this.powerSystem.update();

    background(CONST.COLORS.BACKGROUND);

    push(); // 座標系保存
    
    // パンとズームを適用（InputManagerに委譲）
    this.inputManager.applyTransform();

    // 1. パーツを描画
    this.parts.forEach(part => part.draw());

    // 2. 確定済みのワイヤーを描画
    this.wires.forEach(wire => wire.draw());

    // 3. 作成中（ドラッグ中）の仮ワイヤーを描画
    this.drawTempWire();

    pop(); // 座標系復帰

    // 4. 削除モードの警告表示（ズームの影響を受けないようにpopの後）
    this.drawDeleteModeWarning();
  }

  /**
   * マウスボタンを押した時の処理
   * @param {boolean} isMobile - モバイルデバイスかどうか
   */
  handleMousePressed(isMobile = false) {
    // マウス座標をワールド座標に変換
    const worldMouse = this.getWorldPosition(mouseX, mouseY);
    
    // 削除モード中のクリック処理（スマホでは削除カーソルを使うため、PCのみ）
    if (this.isDeleteMode && !isMobile) {
      
      // 共通メソッドを使って判定する
      const result = this.getDeletionTarget(worldMouse.x, worldMouse.y);
      
      if (result) {
        if (result.type === 'wire') {
          this.deleteWire(result.target);
        } else if (result.type === 'part') {
          this.deletePart(result.target);
        }
      }
      // 削除モード中はここで処理終了
      return;
    }

    // 通常モード：後ろ（手前に表示されているもの）から判定
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const part = this.parts[i];
      
      // A. 回転ハンドルをクリックしたか？（回転モード）
      if (part.isMouseOverRotationHandle(worldMouse.x, worldMouse.y)) {
        console.log("回転ハンドルクリック");
        this.draggingPart = part;
        part.onRotationMouseDown(worldMouse.x, worldMouse.y);
        return;
      }
      
      // B. ソケットをクリックしたか？（ワイヤーモード）
      const hoveredSocket = part.getHoveredSocket(worldMouse.x, worldMouse.y);
      if (hoveredSocket) {
        console.log("ソケットクリック:", hoveredSocket.name);
        this.wiringStartNode = { part: part, socket: hoveredSocket };
        // ワイヤリング開始ソケットをマーク
        part.wiringStartSocket = hoveredSocket.name;
        return;
      }

      // C. パーツ本体をクリックしたか？（移動モード or スイッチ操作）
      if (part.isMouseOver(worldMouse.x, worldMouse.y)) {
        this.draggingPart = part;
        part.onMouseDown(worldMouse.x, worldMouse.y);
        // interact()はmouseReleasedで呼ぶように変更
        return;
      }
    }
  }

  /**
   * マウスを動かしている時の処理
   */
  handleMouseDragged() {
    // 2本指操作（パン ＆ ズーム）をInputManagerに委譲
    if (this.inputManager.handleTwoFingerGesture(touches)) {
      // 2本指操作が行われた場合、パーツドラッグをキャンセル
      this.draggingPart = null;
      return;
    }

    // 1本指操作（パーツ移動など）
    if (this.draggingPart) {
      // マウス座標をワールド座標に変換
      const worldMouse = this.getWorldPosition(mouseX, mouseY);
      
      // 回転モードか移動モードかで処理を分ける
      if (this.draggingPart.isRotating) {
        this.draggingPart.onRotationMouseDragged(this.rotationSnapEnabled, worldMouse.x, worldMouse.y);
      } else {
        this.draggingPart.onMouseDragged(worldMouse.x, worldMouse.y);
      }
    }
  }

  /**
   * マウスを離した時の処理
   */
  handleMouseReleased() {
    // 2本指操作のリセット
    this.inputManager.resetTwoFingerGesture();
    
    // マウス座標をワールド座標に変換
    const worldMouse = this.getWorldPosition(mouseX, mouseY);
    
    // ワイヤー作成中だった場合
    if (this.wiringStartNode) {
      let targetSocket = null;
      
      for (let part of this.parts) {
        const hoveredSocket = part.getHoveredSocket(worldMouse.x, worldMouse.y);
        // 同じソケット同士の接続は禁止
        const isSameSocket = (hoveredSocket === this.wiringStartNode.socket);
        if (hoveredSocket && !isSameSocket) {
          targetSocket = hoveredSocket;
          break;
        }
      }

      // 接続成功
      if (targetSocket) {
        console.log("接続完了！");
        const newWire = new Wire(
          this.wiringStartNode.socket,
          targetSocket
        );
        this.wires.push(newWire);
      }

      // ワイヤリング開始ソケットのマークをクリア
      this.wiringStartNode.part.wiringStartSocket = null;
      this.wiringStartNode = null;
    }

    // パーツ移動・回転中だった場合
    if (this.draggingPart) {
      // 回転モードだった場合
      if (this.draggingPart.isRotating) {
        this.draggingPart.onRotationMouseUp();
      } else {
        // 移動モードで、ドラッグが発生しなかった場合のみinteract()を呼ぶ
        if (!this.draggingPart.wasDragged()) {
          this.draggingPart.interact();
        }
        this.draggingPart.onMouseUp();
      }
      
      this.draggingPart = null;
    }
  }

  /**
   * 回路データをシリアライズ（保存・シェア共通処理）
   * @param {boolean} compact - true: URL用の軽量版、false: ファイル保存用の読みやすい版
   * @returns {Object|Array} シリアライズされた回路データ
   */
  serializeCircuitData(compact = false) {
    if (compact) {
      // 軽量版: IDをインデックス化
      // 1. IDのマッピング作成（元のID -> 配列のインデックス）
      const idToIndexMap = new Map();
      this.parts.forEach((part, index) => {
        idToIndexMap.set(part.id, index);
      });
      
      // 2. パーツ情報: [typeNum, x, y, rot, state?]
      // IDは配列のインデックスで代用するため保存しない
      const partsData = this.parts.map(part => {
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
      const wiresData = this.wires.map(wire => [
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
      const partsData = this.parts.map(part => {
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
      
      const wiresData = this.wires.map(wire => ({
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
   */
  restoreFromData(saveData) {
    // 現在の回路をクリア（配列の参照は維持）
    this.parts.length = 0;
    this.wires.length = 0;
    this.draggingPart = null;
    this.wiringStartNode = null;
    
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
          
          this.parts.push(newPart);
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
            this.wires.push(wire);
          }
        }
      });
      
      console.log(`復元完了(v3): パーツ${this.parts.length}個, ワイヤー${this.wires.length}本`);
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
          
          this.parts.push(newPart);
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
            this.wires.push(wire);
          }
        }
      }
    }
    else {
      throw new Error(CONST.MESSAGES.ERROR_INVALID_FILE_FORMAT);
    }
    
    // PowerSystemのティックをリセット
    this.powerSystem.lastTick = -1;
  }

}
