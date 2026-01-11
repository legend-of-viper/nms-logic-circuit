'use strict';

import { Wire } from '../models/Wire.js';
import { PartFactory } from '../models/PartFactory.js';
import { PowerSystem } from './PowerSystem.js';
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

    this.draggingPart = null;
    this.wiringStartNode = null;
    this.rotationSnapEnabled = true; // デフォルトで90度スナップを有効
    this.isDeleteMode = false; // 削除モード
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
   * 部品を作成して追加
   * @param {string} type - 部品タイプ ('POWER', 'WALL_SWITCH', 'BUTTON', etc.)
   */
  createPart(type) {
    const newId = Date.now();
    
    // 部品ごとの初期配置X座標
    const basePositions = {
      [CONST.PART_TYPE.POWER]: 100,
      [CONST.PART_TYPE.WALL_SWITCH]: 100,
      [CONST.PART_TYPE.BUTTON]: 200,
      [CONST.PART_TYPE.AUTO_SWITCH]: 300,
      [CONST.PART_TYPE.INVERTER]: 400,
      [CONST.PART_TYPE.COLOR_LIGHT]: 500
    };

    // デフォルトは100、それ以外はマップから取得
    const baseX = basePositions[type] || 100;
    
    // 座標に少しランダム性を持たせる (p5.jsのrandom関数を使用)
    const x = baseX + random(50);
    const y = 100 + random(50);

    // ★Factoryを使って生成
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
    
    // 近くのコネクタを探してスナップする
    let endPos = { x: mouseX, y: mouseY };
    let snapped = false;
    
    for (let part of this.parts) {
      for (let socket of part.sockets) {
        const connectorPos = socket.getConnectorWorldPosition();
        const distance = dist(mouseX, mouseY, connectorPos.x, connectorPos.y);
        
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
   * 削除対象のハイライト表示
   * カーソル位置にハイライトを描画し、近くのパーツやワイヤーにスナップ
   */
  highlightDeletionTarget() {
    if (!this.isDeleteMode) return;
    
    // 近くのワイヤーを探す（優先的に判定）
    let targetWire = null;
    for (let i = this.wires.length - 1; i >= 0; i--) {
      const wire = this.wires[i];
      if (wire.isMouseOver(mouseX, mouseY, 10)) {
        targetWire = wire;
        break;
      }
    }
    
    // ワイヤーが見つかった場合はワイヤーをハイライト
    if (targetWire) {
      push();
      const start = targetWire.startSocket.getConnectorWorldPosition();
      const end = targetWire.endSocket.getConnectorWorldPosition();
      
      // ワイヤーを太くハイライト
      stroke(...CONST.DELETE_MODE.HIGHLIGHT_COLOR);
      strokeWeight(CONST.DELETE_MODE.HIGHLIGHT_STROKE_WEIGHT + 2);
      line(start.x, start.y, end.x, end.y);
      
      // ワイヤーの中点にバツ印を表示
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      
      strokeWeight(3);
      const crossSize = 12;
      line(
        midX - crossSize, midY - crossSize,
        midX + crossSize, midY + crossSize
      );
      line(
        midX + crossSize, midY - crossSize,
        midX - crossSize, midY + crossSize
      );
      pop();
      return;
    }
    
    // ワイヤーが見つからなかった場合、近くのパーツを探す
    let targetPart = null;
    const snapDistance = CONST.PARTS.WIDTH * CONST.DELETE_MODE.SNAP_DISTANCE_MULTIPLIER;
    
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const part = this.parts[i];
      const center = part.getCenter();
      const distance = dist(mouseX, mouseY, center.x, center.y);
      
      if (distance < snapDistance) {
        targetPart = part;
        break; // 最初に見つかったパーツにスナップ
      }
    }
    
    // ハイライトを描画
    push();
    noFill();
    stroke(...CONST.DELETE_MODE.HIGHLIGHT_COLOR);
    strokeWeight(CONST.DELETE_MODE.HIGHLIGHT_STROKE_WEIGHT);
    
    const halfW = CONST.PARTS.WIDTH / 2;
    const halfH = CONST.PARTS.HEIGHT / 2;
    const padding = 8;
    
    let highlightX, highlightY;
    
    if (targetPart) {
      // パーツにスナップ（中心座標を取得）
      const center = targetPart.getCenter();
      highlightX = center.x;
      highlightY = center.y;
      
      // スナップ時はより強調（太い線、より大きなパディング）
      strokeWeight(CONST.DELETE_MODE.HIGHLIGHT_STROKE_WEIGHT + 1);
    } else {
      // カーソル位置に表示
      highlightX = mouseX;
      highlightY = mouseY;
      
      // 半透明にして「まだスナップしていない」感を出す
      stroke(...CONST.DELETE_MODE.HIGHLIGHT_COLOR, 150);
    }
    
    // ハイライト枠を描画（中心座標基準）
    rectMode(CENTER);
    rect(
      highlightX,
      highlightY,
      CONST.PARTS.WIDTH + padding * 2,
      CONST.PARTS.HEIGHT + padding * 2,
      5
    );
    rectMode(CORNER); // デフォルトに戻す
    
    // バツ印を表示
    strokeWeight(3);
    const crossSize = 12;
    line(
      highlightX - crossSize, highlightY - crossSize,
      highlightX + crossSize, highlightY + crossSize
    );
    line(
      highlightX + crossSize, highlightY - crossSize,
      highlightX - crossSize, highlightY + crossSize
    );
    pop();
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
    text("⚠️ DELETE MODE（削除モード）", width / 2, 20);
    pop();
  }

  /**
   * キャンバスの更新と描画
   */
  update() {
    this.powerSystem.update();

    background(CONST.COLORS.BACKGROUND);

    // 1. パーツを描画
    this.parts.forEach(part => part.draw());

    // 2. 確定済みのワイヤーを描画
    this.wires.forEach(wire => wire.draw());

    // 3. 作成中（ドラッグ中）の仮ワイヤーを描画
    this.drawTempWire();

    // 4. 削除モード中なら、削除対象をハイライト
    this.highlightDeletionTarget();

    // 5. 削除モードの警告表示
    this.drawDeleteModeWarning();
  }

  /**
   * マウスボタンを押した時の処理
   */
  handleMousePressed() {
    // 削除モード中のクリック処理
    if (this.isDeleteMode) {
      // まずワイヤーをチェック（優先的に削除）
      for (let i = this.wires.length - 1; i >= 0; i--) {
        const wire = this.wires[i];
        if (wire.isMouseOver(mouseX, mouseY, 10)) {
          this.deleteWire(wire);
          return;
        }
      }
      
      // ワイヤーが見つからなかったらパーツをチェック
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const part = this.parts[i];
        if (part.isMouseOver()) {
          this.deletePart(part);
          return;
        }
      }
      // パーツもワイヤーも見つからなかった場合は何もしない
      return;
    }

    // 通常モード：後ろ（手前に表示されているもの）から判定
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const part = this.parts[i];
      
      // A. 回転ハンドルをクリックしたか？（回転モード）
      if (part.isMouseOverRotationHandle()) {
        console.log("回転ハンドルクリック");
        this.draggingPart = part;
        part.onRotationMouseDown();
        return;
      }
      
      // B. ソケットをクリックしたか？（ワイヤーモード）
      const hoveredSocket = part.getHoveredSocket();
      if (hoveredSocket) {
        console.log("ソケットクリック:", hoveredSocket.name);
        this.wiringStartNode = { part: part, socket: hoveredSocket };
        // ワイヤリング開始ソケットをマーク
        part.wiringStartSocket = hoveredSocket.name;
        return;
      }

      // C. パーツ本体をクリックしたか？（移動モード or スイッチ操作）
      if (part.isMouseOver()) {
        this.draggingPart = part;
        part.onMouseDown();
        // interact()はmouseReleasedで呼ぶように変更
        return;
      }
    }
  }

  /**
   * マウスを動かしている時の処理
   */
  handleMouseDragged() {
    if (this.draggingPart) {
      // 回転モードか移動モードかで処理を分ける
      if (this.draggingPart.isRotating) {
        this.draggingPart.onRotationMouseDragged(this.rotationSnapEnabled);
      } else {
        this.draggingPart.onMouseDragged();
      }
    }
  }

  /**
   * マウスを離した時の処理
   */
  handleMouseReleased() {
    // ワイヤー作成中だった場合
    if (this.wiringStartNode) {
      let targetSocket = null;
      
      for (let part of this.parts) {
        const hoveredSocket = part.getHoveredSocket();
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
      // 究極の軽量版v3: IDをインデックス化
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
    
    // v3形式（究極軽量版：配列のみ）の場合
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
    // v2形式（軽量版）の場合
    else if (saveData.v === 2 && Array.isArray(saveData.p) && Array.isArray(saveData.w)) {
      // パーツ復元: [id, typeNum, x, y, rot, state?]
      for (const pData of saveData.p) {
        const id = pData[0];
        const typeStr = TYPE_LIST[pData[1]];
        const x = pData[2];
        const y = pData[3];
        const rot = pData[4];
        
        const newPart = PartFactory.create(typeStr, id, x, y);
        
        if (newPart) {
          newPart.rotation = rot;
          
          // 6番目の要素があればisOnを復元
          if (pData[5] !== undefined) {
            newPart.isOn = (pData[5] === 1);
          }
          
          this.parts.push(newPart);
          partIdMap.set(id, newPart);
        }
      }
      
      // ワイヤー復元: [startID, startSockNum, endID, endSockNum]
      for (const wData of saveData.w) {
        const startPart = partIdMap.get(wData[0]);
        const startSockName = SOCKET_LIST[wData[1]];
        const endPart = partIdMap.get(wData[2]);
        const endSockName = SOCKET_LIST[wData[3]];
        
        if (startPart && endPart) {
          const startSocket = startPart.getSocket(startSockName);
          const endSocket = endPart.getSocket(endSockName);
          
          if (startSocket && endSocket) {
            const wire = new Wire(startSocket, endSocket);
            this.wires.push(wire);
          }
        }
      }
    }
    // v1形式（旧形式）の場合
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
