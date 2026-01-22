'use strict';

import { Wire } from '../models/Wire.js';
import { PartFactory } from '../models/PartFactory.js';
import { PowerSystem } from './PowerSystem.js';
import { InputManager } from './InputManager.js';
import { CONST } from '../config/constants.js';
import { GraphUtils } from '../utils/GraphUtils.js';
import { CircuitSerializer } from '../utils/CircuitSerializer.js';
import { SmoothValue } from '../utils/Animator.js';
import { MathUtils } from '../utils/MathUtils.js';

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
    this.moveSnapEnabled = false;    // デフォルトはOFF（細かい移動 2.75px）
    this.isDeleteMode = false; // 削除モード
    this.isGridVisible = true; // グリッド表示フラグ（デフォルトで表示）
    
    // 画面パンニング中かどうか
    this.isPanning = false;

    // ★追加: 仮ワイヤーの先端位置（アニメーション用）
    this.tempWireEndX = new SmoothValue(0, CONST.ANIMATION.MOVE_SPEED, CONST.ANIMATION.MOVE_SNAP_THRESHOLD);
    this.tempWireEndY = new SmoothValue(0, CONST.ANIMATION.MOVE_SPEED, CONST.ANIMATION.MOVE_SNAP_THRESHOLD);
    
    this.currentSnapSocket = null; // 仮ワイヤーのスナップ先ソケット

    this.detachTargetSocket = null; // 切断対象のソケット
    this.detachStartPos = null;  // 切断開始時のマウス位置
  }

  // ==================== 初期化・状態管理 ====================
  
  /**
   * 回転スナップの有効/無効を設定
   * @param {boolean} enabled
   */
  setRotationSnap(enabled) {
    this.rotationSnapEnabled = enabled;
  }

  /**
   * 移動スナップの有効/無効を設定
   * @param {boolean} enabled
   */
  setMoveSnap(enabled) {
    this.moveSnapEnabled = enabled;
  }

  /**
   * グリッド表示の有効/無効を設定
   * @param {boolean} visible 
   */
  setGridVisible(visible) {
    this.isGridVisible = visible;
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
    this.isPanning = false; // ★追加: パンニング状態もリセット
    
    console.log("全てのパーツとワイヤーをリセットしました");
  }

  // ==================== ヘルパー ====================
  
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
   * 指定座標の近くにある、自分以外のパーツのソケットを探す
   * @param {number} x - ワールドX座標（探索の中心点）
   * @param {number} y - ワールドY座標（探索の中心点）
   * @param {CircuitPart|Socket|null} excludeTarget - 除外する対象（パーツまたはソケット）
   * @param {number} threshold - 検索半径
   * @returns {Socket|null} 見つかったソケット
   */
  findNearbySocket(x, y, excludeTarget, threshold = CONST.PARTS.SOCKET_HIT_RADIUS) {
    for (let part of this.parts) {
      if (part === excludeTarget) continue;

      for (let socket of part.sockets) {
        if(socket === excludeTarget) continue;

        const pos = socket.getConnectorWorldPosition();
        const distVal = dist(x, y, pos.x, pos.y);
        if (distVal < threshold) {
          return socket;
        }
      }
    }
    return null;
  }

  // ==================== 部品・ワイヤー管理 ====================
  
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

  // ==================== 描画 ====================
  
  /**
   * ★追加: グリッドの描画
   * 現在のビューポート（表示領域）を計算して、必要な分だけ線を描く
   */
  drawGrid() {
    const input = this.inputManager;
    const scale = input.viewScale;
    const offX = input.viewOffsetX;
    const offY = input.viewOffsetY;
    const gridSize = CONST.GRID.SIZE;
    const offset = CONST.GRID.DRAW_OFFSET;

    // 現在の画面に見えているワールド座標の範囲を計算
    // (画面の左上座標 - オフセット) / スケール = ワールド左上
    const startX = Math.floor((-offX / scale) / gridSize) * gridSize + offset;
    const endX = Math.floor(((width - offX) / scale) / gridSize + 1) * gridSize + offset;
    const startY = Math.floor((-offY / scale) / gridSize) * gridSize + offset;
    const endY = Math.floor(((height - offY) / scale) / gridSize + 1) * gridSize + offset;

    stroke(...CONST.GRID.COLOR);
    // ズームしても線の太さが変わらないように見せたい場合は 1/scale にする
    // ここではあえてそのままにして、ズームすると線も太くなる「図面」っぽさを出します
    strokeWeight(CONST.GRID.STROKE_WEIGHT);

    // 縦線を描画
    for (let x = startX; x <= endX; x += gridSize) {
      line(x, startY, x, endY);
    }

    // 横線を描画
    for (let y = startY; y <= endY; y += gridSize) {
      line(startX, y, endX, y);
    }
  }

  /**
   * 仮ワイヤーの描画（マウスについてくる線）
   */
  drawTempWire() {
    if (!this.wiringStartNode) return;
    
    const startPos = this.wiringStartNode.socket.getConnectorWorldPosition();
    const worldMouse = this.getWorldPosition(mouseX, mouseY);
    
    // 目標座標（ターゲット）を計算
    let targetX = worldMouse.x;
    let targetY = worldMouse.y;
    
    const snap = this.moveSnapEnabled ? CONST.GRID.SNAP_COARSE : CONST.GRID.SNAP_FINE; // 22px or 2.75px
    const offset = {x: CONST.GRID.DRAW_OFFSET, y: CONST.GRID.DRAW_OFFSET};
    const snapPos = MathUtils.snapPosition(targetX, targetY, snap, offset);

    targetX = snapPos.x;
    targetY = snapPos.y;
    
    // 近くのコネクタを探してスナップする（こちらはGridSnapに関わらず優先）
    const nearbySocket = this.findNearbySocket(worldMouse.x, worldMouse.y, this.wiringStartNode.socket)
    if (nearbySocket) {
      const connectorPos = nearbySocket.getConnectorWorldPosition();
      targetX = connectorPos.x;
      targetY = connectorPos.y;
    }

    // ★追加: アニメーション処理（現在値を目標値に近づける）
    
    this.tempWireEndX.setTarget(targetX);
    this.tempWireEndY.setTarget(targetY);

    this.tempWireEndX.update();
    this.tempWireEndY.update();

    // 描画
    stroke(...CONST.COLORS.WIRE_TEMP, CONST.WIRE.TEMP_ALPHA);
    strokeWeight(2);
    
    // アニメーション済みの座標を使用
    line(startPos.x, startPos.y, this.tempWireEndX.value, this.tempWireEndY.value);
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
    
    // ★追加: 全パーツのアニメーション（回転など）を更新
    this.parts.forEach(part => part.updateAnimation());

    background(CONST.COLORS.BACKGROUND);

    push(); // 座標系保存
    
    // パンとズームを適用（InputManagerに委譲）
    this.inputManager.applyTransform();

    // グリッドを描画（パーツの背面に描くため、最初に行う）
    if (this.isGridVisible) {
      this.drawGrid();
    }

    // 現在のワールドマウス座標を計算
    const worldMouse = this.getWorldPosition(mouseX, mouseY);

    // 1. パーツを描画
    // ★変更: ワールド座標のマウス位置をdrawに渡す
    this.parts.forEach(part => part.draw(worldMouse));

    // 2. 確定済みのワイヤーを描画
    this.wires.forEach(wire => wire.draw());

    // 3. 作成中（ドラッグ中）の仮ワイヤーを描画
    this.drawTempWire();

    pop(); // 座標系復帰

    // 4. 削除モードの警告表示（ズームの影響を受けないようにpopの後）
    this.drawDeleteModeWarning();
  }


  // ==================== マウス・入力処理 ====================
  
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
      } else {
        // ★追加: 削除対象がない場合はパン操作を開始
        this.isPanning = true;
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

      // ★追加: ソケットの取り外しハンドルをクリックしたか？
      for (let socket of part.sockets) {
        if (socket.isMouseOverDetachHandle(worldMouse.x, worldMouse.y)) {
           console.log("デタッチ操作待機中:", socket.name);
           
          this.detachTargetSocket = socket;
          this.detachStartPos = { x: mouseX, y: mouseY };
           
           return; // 処理終了
        }
      }
      
      // B. ソケットをクリックしたか？（ワイヤーモード）
      const hoveredSocket = part.getHoveredSocket(worldMouse.x, worldMouse.y);
      if (hoveredSocket) {
        console.log("ソケットクリック:", hoveredSocket.name);
        this.wiringStartNode = { part: part, socket: hoveredSocket };
        // ワイヤリング開始ソケットをマーク
        part.wiringStartSocket = hoveredSocket.name;

        // ★追加: 仮ワイヤーの現在位置をマウス位置で初期化（アニメーション用）
        this.tempWireEndX.setImmediate(worldMouse.x);
        this.tempWireEndY.setImmediate(worldMouse.y);
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
          this.dragJointWeights = GraphUtils.calculateJointWeights(part);
        }
        
        // interact()はmouseReleasedで呼ぶように変更
        return;
      }
    }

    // ★追加: 何もクリックしなかった場合、PCレイアウトならパン操作を開始
    if (!isMobile) {
      this.isPanning = true;
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

    if (this.detachTargetSocket) {
      // 一定距離以上ドラッグしたら切断を実行
      const dragDistance = dist(mouseX, mouseY, this.detachStartPos.x, this.detachStartPos.y);
      const threshold = CONST.PARTS.SOCKET_HIT_RADIUS; // ピクセル単位の閾値
      if (dragDistance > threshold) {
        console.log("ソケットのワイヤーを切断:", this.detachTargetSocket.name); 

        const socket = this.detachTargetSocket;

        // ソケット位置に新しいWireJointを作成
        const socketPos = socket.getConnectorWorldPosition();
        const jointX = socketPos.x - CONST.PARTS.WIDTH / 2;
        const jointY = socketPos.y - CONST.PARTS.HEIGHT / 2;
        
        this.createPart(CONST.PART_TYPE.JOINT, jointX, jointY);
        const newJoint = this.parts[this.parts.length - 1]; // 最新のパーツが新しいJoint
        const jointSocket = newJoint.getSocket('center');

        // 既存のワイヤーを新しいJointに接続し直す
        const wiresToDetach = [...socket.connectedWires];
        wiresToDetach.forEach(wire => {
          socket.disconnectWire(wire);
          if (wire.startSocket === socket) wire.startSocket = jointSocket;
          if (wire.endSocket === socket) wire.endSocket = jointSocket;
          jointSocket.connectWire(wire);
        });

        const worldMouse = this.getWorldPosition(mouseX, mouseY);
        newJoint.posX.setTarget(worldMouse.x);
        newJoint.posY.setTarget(worldMouse.y);

        // 新しいWireJointをドラッグ状態にする
        this.draggingPart = newJoint;
        // const worldMouse = this.getWorldPosition(mouseX, mouseY);
        newJoint.onMouseDown(worldMouse.x, worldMouse.y);

        // リセット
        this.detachTargetSocket = null;
        this.detachStartPos = null;
      }
    }

    // 1本指操作（パーツ移動など）
    if (this.draggingPart) {
      // マウス座標をワールド座標に変換
      const worldMouse = this.getWorldPosition(mouseX, mouseY);
      
      // 回転モードか移動モードかで処理を分ける
      if (this.draggingPart.isRotating) {
        this.draggingPart.onRotationMouseDragged(this.rotationSnapEnabled, worldMouse.x, worldMouse.y);
      } else {
        // 移動量の計算は「ターゲット座標」の差分で行う
        // これにより、パーツがスナップ移動した時だけジョイントも追従する
        const oldX = this.draggingPart.targetX;
        const oldY = this.draggingPart.targetY;
        
        // 設定に応じてスナップ単位を決定 (ON: 22px, OFF: 2.75px)
        const snapUnit = this.moveSnapEnabled ? CONST.GRID.SNAP_COARSE : CONST.GRID.SNAP_FINE;
        
        // パーツを移動（スナップ単位を渡す）
        this.draggingPart.onMouseDragged(worldMouse.x, worldMouse.y, snapUnit);
        
        // Jointの場合は近くのソケットにスナップさせる
        if(this.draggingPart.type === CONST.PART_TYPE.JOINT) {
          // 現在のスナップソケットをリセット
          if (this.currentSnapSocket) {
            this.currentSnapSocket.isTargeted = false;
            this.currentSnapSocket = null;
          }

          // ジョイントの中心座標に近いソケットを探す
          const jointCenterX = this.draggingPart.targetX + CONST.PARTS.WIDTH / 2;
          const jointCenterY = this.draggingPart.targetY + CONST.PARTS.HEIGHT / 2;
          const targetSocket = this.findNearbySocket(jointCenterX, jointCenterY, this.draggingPart);

          // 見つけたソケットが、現在ドラッグ中のJointの反対側のソケットでないか確認
          const jointSocket = this.draggingPart.getSocket('center');
          const otherEndSockets = jointSocket.connectedWires.map(wire => wire.getOtherEnd(jointSocket));
          const isConnectingToSelf = otherEndSockets.includes(targetSocket);

          // 近くにソケットが見つかり、かつ自分自身に接続しようとしていない場合
          if (targetSocket && !isConnectingToSelf) {
            // 見つかったソケットにスナップさせる
            const socketPos = targetSocket.getConnectorWorldPosition();
            this.draggingPart.posX.setTarget(socketPos.x - CONST.PARTS.WIDTH / 2);
            this.draggingPart.posY.setTarget(socketPos.y - CONST.PARTS.HEIGHT / 2);

            // スナップ先ソケットをマーク
            targetSocket.isTargeted = true;
            this.currentSnapSocket = targetSocket;
          }
        }

        // 移動量を計算（スナップ済みの値同士の差分）
        const dx = this.draggingPart.targetX - oldX;
        const dy = this.draggingPart.targetY - oldY;
        
        // 重みマップを使ってJointを追従させる
        if (this.dragJointWeights && (dx !== 0 || dy !== 0)) {
          for (const [joint, weight] of this.dragJointWeights) {
            // Jointのターゲット座標を更新（スナップに合わせて動く）
            joint.posX.setTarget(joint.posX.target + dx * weight);
            joint.posY.setTarget(joint.posY.target + dy * weight);
          }
        }
      }
    } 
    // ★追加: 画面のパンニング（PC用ドラッグ移動）
    else if (this.isPanning) {
      // p5.jsのpmouseX/Y（前フレームのマウス座標）との差分で移動
      this.inputManager.pan(mouseX - pmouseX, mouseY - pmouseY);
    }
  }

  /**
   * マウスを離した時の処理
   */
  handleMouseReleased() {
    // 2本指操作のリセット
    this.inputManager.resetTwoFingerGesture();
    
    // ★追加: パンニング状態のリセット
    this.isPanning = false;

    // スナップソケットをリセット
    if (this.currentSnapSocket) {
      this.currentSnapSocket.isTargeted = false;
      this.currentSnapSocket = null;
    }

    // デタッチ操作のリセット
    if(this.detachTargetSocket) {
      this.detachTargetSocket = null;
      this.detachStartPos = null;
    }

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
      
      // 1. 既存のソケットを探す
      let targetSocket = this.findNearbySocket(worldMouse.x, worldMouse.y, this.wiringStartNode.socket);
      

      // 2. ソケットが見つからなかった場合 -> 「虚空」かチェック
      if (!targetSocket) {
        // マウスが他のパーツの上になければ「中継点」を作る
        const isOverAnyPart = this.parts.some(p => p.isMouseOver(worldMouse.x, worldMouse.y));
        
        if (!isOverAnyPart) {
          // 中継点（Joint）を生成して接続する
          console.log("中継点を作成");
          
          // ★追加: Grid Snapが有効なら、生成位置（中心）をスナップさせる
          let centerX = worldMouse.x;
          let centerY = worldMouse.y;
          
          if (this.moveSnapEnabled) {
            const snap = CONST.GRID.SNAP_COARSE;
            centerX = Math.round(centerX / snap) * snap;
            centerY = Math.round(centerY / snap) * snap;
          }
          
          // マウス位置（またはスナップ後の位置）が「中心」になるように座標を補正する
          // CircuitPartは左上座標(x,y)で管理されるため、幅・高さの半分を引く必要がある
          const jointX = centerX - CONST.PARTS.WIDTH / 2;
          const jointY = centerY - CONST.PARTS.HEIGHT / 2;

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
      } else if (this.draggingPart.type === CONST.PART_TYPE.JOINT) {

        const jointCenterX = this.draggingPart.targetX + CONST.PARTS.WIDTH / 2;
        const jointCenterY = this.draggingPart.targetY + CONST.PARTS.HEIGHT / 2;
        const targetSocket = this.findNearbySocket(jointCenterX, jointCenterY, this.draggingPart);
        
        // 見つけたソケットが、現在ドラッグ中のJointの反対側のソケットでないか確認
        const jointSocket = this.draggingPart.getSocket('center');
        const otherEndSockets = jointSocket.connectedWires.map(wire => wire.getOtherEnd(jointSocket));
        const isConnectingToSelf = otherEndSockets.includes(targetSocket);

        // 近くにソケットが見つかり、かつ自分自身に接続しようとしていない場合
        if (targetSocket && !isConnectingToSelf) {
          console.log("ジョイントをソケットにスナップ");
          const joint = this.draggingPart;
          const jointSocket = joint.getSocket('center');

          // ジョイントにつながっているワイヤーを全てターゲットへ付け替える
          const wiresToReattach = [...jointSocket.connectedWires];
          wiresToReattach.forEach(wire => {
            if (wire.startSocket === jointSocket) {
              wire.startSocket = targetSocket;
            }
            if (wire.endSocket === jointSocket) {
              wire.endSocket = targetSocket;
            }
            targetSocket.connectWire(wire);
          });

          // ジョイントを削除
          this.deletePart(joint);
        } else {
          // 接続しなかった場合で、相手と自分の距離が近すぎる場合は距離を取る
          const min_dist = CONST.PARTS.SOCKET_HIT_RADIUS;
          
          for (let otherSocket of otherEndSockets) {
            if (!otherSocket) continue;

            const otherPos = otherSocket.getConnectorWorldPosition();
            const d = dist(jointCenterX, jointCenterY, otherPos.x, otherPos.y);

            if (d < min_dist) {
              // 相手と自分との角度を計算
              let angle = Math.atan2(jointCenterY - otherPos.y, jointCenterX - otherPos.x);
              if (d === 0) angle = 0;

              const pushX = otherPos.x + Math.cos(angle) * min_dist;
              const pushY = otherPos.y + Math.sin(angle) * min_dist;

              this.draggingPart.posX.setTarget(pushX - CONST.PARTS.WIDTH / 2);
              this.draggingPart.posY.setTarget(pushY - CONST.PARTS.HEIGHT / 2);
            }
          }
          this.draggingPart.onMouseUp();
        }
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

  // ==================== シリアライズ ====================
  
  /**
   * 回路データをシリアライズ（保存・シェア共通処理）
   * ★修正: 視点情報（パン・ズーム）も含める
   * @param {boolean} compact - true: URL用の軽量版、false: ファイル保存用の読みやすい版
   * @returns {Object|Array} シリアライズされた回路データ
   */
  serializeCircuitData(compact = false) {
    // InputManagerから現在の視点情報を取得
    const viewState = {
      x: this.inputManager.viewOffsetX,
      y: this.inputManager.viewOffsetY,
      scale: this.inputManager.viewScale
    };

    // シリアライザーに視点情報（viewState）を第4引数として渡す
    return CircuitSerializer.serialize(this.parts, this.wires, compact, viewState);
  }

  /**
   * シリアライズされたデータから回路を復元（読込・URL復元共通処理）
   * ★修正: 復元された視点情報を適用する
   * @param {Object|Array} saveData - シリアライズされた回路データ
   */
  restoreFromData(saveData) {
    // ドラッグ状態をクリア
    this.draggingPart = null;
    this.wiringStartNode = null;
    this.isPanning = false; // パン中フラグもリセット
    
    // CircuitSerializerに処理を委譲（戻り値として視点情報を受け取る）
    const restoredView = CircuitSerializer.deserialize(saveData, this.parts, this.wires);
    
    // 視点情報が復元できた場合、InputManagerに適用
    if (restoredView) {
      this.inputManager.viewOffsetX = restoredView.x;
      this.inputManager.viewOffsetY = restoredView.y;
      this.inputManager.viewScale = restoredView.scale;
    } else {
      // 古いデータなどで視点情報がない場合はリセット（初期位置）
      this.inputManager.viewOffsetX = 0;
      this.inputManager.viewOffsetY = 0;
      this.inputManager.viewScale = 1.0;
    }
    
    // PowerSystemのティックをリセット
    this.powerSystem.lastTick = -1;
  }

}