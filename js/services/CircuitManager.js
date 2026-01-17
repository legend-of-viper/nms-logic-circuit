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
    // 影響を受ける隣接パーツを記録するセット
    const neighborsToCheck = new Set();

    // 手順A: この部品に繋がっているワイヤーを全て探して消す
    for (let i = this.wires.length - 1; i >= 0; i--) {
      const wire = this.wires[i];
      
      if (wire.startSocket.parent === targetPart || wire.endSocket.parent === targetPart) {
        // 反対側のパーツを記録しておく
        const otherPart = (wire.startSocket.parent === targetPart) 
                          ? wire.endSocket.parent 
                          : wire.startSocket.parent;
        neighborsToCheck.add(otherPart);

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

    // 手順C: 道連れでワイヤーが消えた先のJointをチェック
    neighborsToCheck.forEach(part => {
      this.cleanupOrphanedJoint(part);
    });
  }

  /**
   * ワイヤーを削除
   * @param {Wire} targetWire - 削除対象のワイヤー
   */
  deleteWire(targetWire) {
    const startPart = targetWire.startSocket.parent;
    const endPart = targetWire.endSocket.parent;

    const index = this.wires.indexOf(targetWire);
    if (index > -1) {
      targetWire.startSocket.disconnectWire(targetWire);
      targetWire.endSocket.disconnectWire(targetWire);
      
      this.wires.splice(index, 1);
      console.log("ワイヤーを削除しました");

      // 両端がJointなら、もう不要かチェックして消す
      this.cleanupOrphanedJoint(startPart);
      this.cleanupOrphanedJoint(endPart);
    }
  }

  /**
   * 孤立したJointを自動削除
   * @param {CircuitPart} part - チェック対象のパーツ
   */
  cleanupOrphanedJoint(part) {
    // Joint以外、または既に削除済みのパーツなら何もしない
    if (!part || part.type !== CONST.PART_TYPE.JOINT || !this.parts.includes(part)) {
      return;
    }

    // 接続されているワイヤーの数を数える
    let totalWires = 0;
    for (const socket of part.sockets) {
      totalWires += socket.connectedWires.length;
    }

    // ワイヤーが1本もなければ、Joint自体を削除
    if (totalWires === 0) {
      const index = this.parts.indexOf(part);
      if (index > -1) {
        this.parts.splice(index, 1);
      }
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
      
      // Jointは削除ターゲットとして検出しない（ユーザーに意識させない）
      if (part.type === CONST.PART_TYPE.JOINT) {
        continue;
      }

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
   * ドラッグ時のJoint追従係数を計算する
   * Source（動かすパーツ）からの距離と、Anchor（固定パーツ）からの距離の比率で決定
   * @param {CircuitPart} sourcePart - ドラッグを開始するパーツ
   * @returns {Map} Joint Object -> Weight(0.0~1.0) のマップ
   */
  calculateJointWeights(sourcePart) {
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
        
        // Joint追従のための重みマップを作成
        this.dragJointWeights = null;
        
        if (part.type !== CONST.PART_TYPE.JOINT) {
          // Joint以外のパーツを掴んだ時だけ計算する
          this.dragJointWeights = this.calculateJointWeights(part);
        }
        
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
      this.dragJointWeights = null;
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
        // 移動前の座標を記録
        const oldX = this.draggingPart.x;
        const oldY = this.draggingPart.y;
        
        // パーツを移動
        this.draggingPart.onMouseDragged(worldMouse.x, worldMouse.y);
        
        // 移動量を計算
        const dx = this.draggingPart.x - oldX;
        const dy = this.draggingPart.y - oldY;
        
        // 重みマップを使ってJointを追従させる
        if (this.dragJointWeights && (dx !== 0 || dy !== 0)) {
          for (const [joint, weight] of this.dragJointWeights) {
            joint.x += dx * weight;
            joint.y += dy * weight;
          }
        }
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
      // 引き出し元のスナップ範囲内に戻されたらキャンセルする処理
      const startSocket = this.wiringStartNode.socket;
      const startPos = startSocket.getConnectorWorldPosition();
      const distFromStart = dist(worldMouse.x, worldMouse.y, startPos.x, startPos.y);
      
      // 判定距離を設定
      // Jointの場合はそのヒット半径(20px等)、通常ソケットの場合はソケットヒット半径(12px等)を使用
      let cancelThreshold = CONST.PARTS.SOCKET_HIT_RADIUS;
      if (startSocket.parent.type === CONST.PART_TYPE.JOINT) {
         cancelThreshold = CONST.PARTS.JOINT_HIT_RADIUS;
      }
      
      // 距離が近すぎる場合はキャンセル
      if (distFromStart < cancelThreshold) {
        console.log("ワイヤー生成をキャンセル（元の位置に戻されました）");
        this.wiringStartNode.part.wiringStartSocket = null;
        this.wiringStartNode = null;
        return; // ここで処理を終了
      }

      let targetSocket = null;
      
      // 1. 既存のソケットを探す
      for (let part of this.parts) {
        const hoveredSocket = part.getHoveredSocket(worldMouse.x, worldMouse.y);
        // 同じソケット同士の接続は禁止
        const isSameSocket = (hoveredSocket === this.wiringStartNode.socket);
        if (hoveredSocket && !isSameSocket) {
          targetSocket = hoveredSocket;
          break;
        }
      }

      // 2. ソケットが見つからなかった場合 -> 「虚空」かチェック
      if (!targetSocket) {
        // マウスが他のパーツの上になければ「中継点」を作る
        const isOverAnyPart = this.parts.some(p => p.isMouseOver(worldMouse.x, worldMouse.y));
        
        if (!isOverAnyPart) {
          // 中継点（Joint）を生成して接続する
          console.log("中継点を作成");
          
          // マウス位置が「中心」になるように座標を補正する
          // CircuitPartは左上座標(x,y)で管理されるため、幅・高さの半分を引く必要がある
          const jointX = worldMouse.x - CONST.PARTS.WIDTH / 2;
          const jointY = worldMouse.y - CONST.PARTS.HEIGHT / 2;

          // 補正した座標で作成
          this.createPart(CONST.PART_TYPE.JOINT, jointX, jointY);
          
          // 今作ったばかりのパーツを取得
          const newJoint = this.parts[this.parts.length - 1];
          targetSocket = newJoint.getSocket('center');
        }
      }

      // 3. 接続処理（Joint作成により targetSocket が確保されていればここを通る）
      if (targetSocket) {
        console.log("接続完了！");
        const newWire = new Wire(
          this.wiringStartNode.socket,
          targetSocket
        );
        this.wires.push(newWire);
      }

      // ワイヤリング開始ソケットのマークをクリア
      if (this.wiringStartNode) {
        this.wiringStartNode.part.wiringStartSocket = null;
        this.wiringStartNode = null;
      }
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
