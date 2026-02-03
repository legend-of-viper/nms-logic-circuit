'use strict';

import { Wire } from '../models/Wire.js';
import { PartFactory } from '../models/PartFactory.js';
import { PowerSystem } from './PowerSystem.js';
import { InputManager } from './InputManager.js';
import { CONST } from '../config/constants.js';
import { GraphUtils } from '../utils/GraphUtils.js'; // GraphUtilsを使用
import { CircuitSerializer } from '../utils/CircuitSerializer.js';
import { SmoothValue, SmoothRotation } from '../utils/Animator.js';
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

    // 仮ワイヤーの先端位置（アニメーション用）
    this.tempWireEndX = new SmoothValue(0, CONST.ANIMATION.MOVE_SPEED, CONST.ANIMATION.MOVE_SNAP_THRESHOLD);
    this.tempWireEndY = new SmoothValue(0, CONST.ANIMATION.MOVE_SPEED, CONST.ANIMATION.MOVE_SNAP_THRESHOLD);
    
    this.currentSnapSocket = null; // 仮ワイヤーのスナップ先ソケット

    this.detachTargetSocket = null; // 切断対象のソケット
    this.detachStartPos = null;  // 切断開始時のマウス位置

    // 複数選択モード用変数
    this.isMultiSelectMode = false; 
    this.selectedParts = new Set();      // ユーザーが明示的に選択したパーツ
    this.implicitJoints = new Set();     // 自動的に追従するJoint
    this.isGroupDragging = false;
    this.clickedPartWasSelected = false; // Press時点で既に選択済みだったか
    
    // ★追加: グループ回転用変数
    this.isGroupRotating = false;
    this.groupRotationData = new Map(); // 回転開始時の各パーツの状態を保存

    // ★追加: 複数選択カーソルのアニメーション用パラメータ
    // 位置(X,Y), 回転(Rot), サイズ(W,H), 角丸(R) をすべて滑らかに補間する
    this.msCursor = {
      x: new SmoothValue(0, 0.4, 1.0),
      y: new SmoothValue(0, 0.4, 1.0),
      rot: new SmoothRotation(0, 0.3, 0.01),
      w: new SmoothValue(CONST.MULTI_SELECT_MODE.CURSOR_WIDTH, 0.3, 1.0),
      h: new SmoothValue(CONST.MULTI_SELECT_MODE.CURSOR_HEIGHT, 0.3, 1.0),
      r: new SmoothValue(CONST.MULTI_SELECT_MODE.CURSOR_CORNER_RADIUS, 0.3, 1.0)
    };
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
    // 削除モードに入ったら複数選択は解除
    if (this.isDeleteMode) {
      this.setMultiSelectMode(false);
    }
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
   * 複数選択モード切り替え
   */
  toggleMultiSelectMode() {
    this.setMultiSelectMode(!this.isMultiSelectMode);
  }

  setMultiSelectMode(enabled) {
    this.isMultiSelectMode = enabled;
    
    // モードOFF時に選択を全解除
    if (!enabled) {
      this.clearSelection();
    } else {
      // 選択モード時は削除モードをOFF
      this.isDeleteMode = false;
    }
    console.log(`複数選択モード: ${this.isMultiSelectMode ? 'ON' : 'OFF'}`);
  }
  
  getMultiSelectMode() {
    return this.isMultiSelectMode;
  }

  /**
   * 選択状態のクリア
   */
  clearSelection() {
    this.selectedParts.forEach(part => part.isSelected = false);
    this.selectedParts.clear();
    this.implicitJoints.clear();
  }

  /**
   * 選択中のパーツと、その内部で完結するワイヤーを複製する
   * ★修正: 道連れJoint (implicitJoints) も含めて複製するように変更
   */
  duplicateSelectedParts() {
    // 何も選択されていなければ終了
    if (this.selectedParts.size === 0) return;

    this.detectImplicitJoints();

    // 1. まず「複製すべき全パーツ」のセットを作る
    //    (明示的に選択したパーツ + 自動的に道連れになるJoint)
    const partsToDuplicate = new Set([...this.selectedParts, ...this.implicitJoints]);

    // 2. このセット内で完結しているワイヤーを抽出
    const wiresToDuplicate = [];
    for (const wire of this.wires) {
      const startPart = wire.startSocket.parent;
      const endPart = wire.endSocket.parent;
      
      // 始点と終点の両方が「複製対象グループ」に含まれている場合のみ、ワイヤーも複製する
      if (partsToDuplicate.has(startPart) && partsToDuplicate.has(endPart)) {
        wiresToDuplicate.push(wire);
      }
    }

    // 3. シリアライザを使ってディープコピーを作成
    //    パーツリストには partsToDuplicate を渡す
    const serializedData = CircuitSerializer.serialize(
      Array.from(partsToDuplicate), 
      wiresToDuplicate, 
      true // compact mode
    );

    // 4. 一時的な配列に復元（IDは新規発行される）
    const newParts = [];
    const newWires = [];
    CircuitSerializer.deserialize(serializedData, newParts, newWires);

    if (newParts.length === 0) return;

    // 5. 配置を少しずらす（オフセット）
    const OFFSET = CONST.GRID.SIZE; // グリッド1個分ずらす
    newParts.forEach(part => {
      // アニメーションターゲットと現在値の両方をずらす
      part.setPositionImmediately(part.x + OFFSET, part.y + OFFSET);
    });

    // 6. メインの配列に追加
    this.parts.push(...newParts);
    this.wires.push(...newWires);

    // 7. 選択状態を新しいパーツに切り替える
    this.clearSelection(); // 元の選択を解除
    
    if (!this.isMultiSelectMode) {
        this.setMultiSelectMode(true);
    }

    // 新しく生成されたパーツを全て選択状態にする
    newParts.forEach(part => {
      if (part.type !== CONST.PART_TYPE.JOINT) {
        part.isSelected = true;
        this.selectedParts.add(part);
      }
    });
    
    // ★重要: 複製後の新しい配置で、再度「内部Joint」を計算し直す
    // これで複製されたJointも正しくグループとして扱われるようになります
    this.detectImplicitJoints();

    console.log(`${newParts.length}個のパーツ（Joint含む）を複製しました`);
  }

  /**
   * 内部Joint（挟まれたJoint）を特定する
   * GraphUtilsを使って、選択パーツに囲まれたJointを抽出
   */
  detectImplicitJoints() {
    // GraphUtilsに委譲（前回の修正を反映）
    this.implicitJoints = GraphUtils.findEnclosedJoints(this.parts, this.selectedParts);
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
    this.isPanning = false;
    
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

  /**
   * ワイヤーの整理（重複や長さ0のワイヤーを削除）
   * 操作の最後に呼び出すことでゴミデータを掃除する
   */
  consolidateWires() {
    // 配列を操作（削除）するため、後ろからループする
    for (let i = this.wires.length - 1; i >= 0; i--) {
      const wire = this.wires[i];
      const startPos = wire.startSocket.getConnectorWorldPosition();
      const endPos = wire.endSocket.getConnectorWorldPosition();

      // 1. 長さがほぼ0（始点と終点が同じ位置）のワイヤーの処理
      // わずかな誤差許容のため 1.0px 未満なら重なっているとみなす
      if (dist(startPos.x, startPos.y, endPos.x, endPos.y) < 1.0) {
        
        const startPart = wire.startSocket.parent;
        const endPart = wire.endSocket.parent;

        // 削除するかどうかの判定を詳細化
        const isStartJoint = (startPart.type === CONST.PART_TYPE.JOINT);
        const isEndJoint = (endPart.type === CONST.PART_TYPE.JOINT);
        const isSelfConnection = (startPart === endPart); // 自分自身への接続

        // 「どちらかがJoint」または「自己接続（パーツAからパーツA）」の場合は削除対象
        // 逆に言えば「別々の一般パーツ同士」なら長さ0でも残す
        if (isStartJoint || isEndJoint || isSelfConnection) {
          this.deleteWire(wire);
          continue; // このワイヤーは消えたので次のチェックへ
        }
        
        // ここに来る＝一般パーツ同士の接続なので、重なっていても残す
      }

      // 2. 重複ワイヤー（始点・終点が同じペア）を削除
      // 自分より前のワイヤー（j < i）と比較して、同じ接続なら自分（新しい方）を消す
      for (let j = 0; j < i; j++) {
        const other = this.wires[j];
        
        // A->B と A->B、または A->B と B->A を重複とみなす
        const isSameDir = (wire.startSocket === other.startSocket && wire.endSocket === other.endSocket);
        const isReverseDir = (wire.startSocket === other.endSocket && wire.endSocket === other.startSocket);

        if (isSameDir || isReverseDir) {
          this.deleteWire(wire);
          break; // 削除したのでinner loopを抜ける
        }
      }
    }
  }

  // ==================== 描画 ====================
  
  /**
   * グリッドの描画
   */
  drawGrid() {
    const input = this.inputManager;
    const scale = input.viewScale;
    const offX = input.viewOffsetX;
    const offY = input.viewOffsetY;
    const gridSize = CONST.GRID.SIZE;
    const offset = CONST.GRID.DRAW_OFFSET;

    const startX = Math.floor((-offX / scale) / gridSize) * gridSize + offset;
    const endX = Math.floor(((width - offX) / scale) / gridSize + 1) * gridSize + offset;
    const startY = Math.floor((-offY / scale) / gridSize) * gridSize + offset;
    const endY = Math.floor(((height - offY) / scale) / gridSize + 1) * gridSize + offset;

    stroke(...CONST.GRID.COLOR);
    strokeWeight(CONST.GRID.STROKE_WEIGHT);

    for (let x = startX; x <= endX; x += gridSize) {
      line(x, startY, x, endY);
    }

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
    
    let targetX = worldMouse.x;
    let targetY = worldMouse.y;
    
    const snap = this.moveSnapEnabled ? CONST.GRID.SNAP_COARSE : CONST.GRID.SNAP_FINE;
    const offset = {x: CONST.GRID.DRAW_OFFSET, y: CONST.GRID.DRAW_OFFSET};
    const snapPos = MathUtils.snapPosition(targetX, targetY, snap, offset);

    targetX = snapPos.x;
    targetY = snapPos.y;
    
    const nearbySocket = this.findNearbySocket(worldMouse.x, worldMouse.y, this.wiringStartNode.socket)
    if (nearbySocket) {
      const connectorPos = nearbySocket.getConnectorWorldPosition();
      targetX = connectorPos.x;
      targetY = connectorPos.y;
    }

    this.tempWireEndX.setTarget(targetX);
    this.tempWireEndY.setTarget(targetY);

    this.tempWireEndX.update();
    this.tempWireEndY.update();

    stroke(...CONST.COLORS.WIRE_TEMP, CONST.WIRE.TEMP_ALPHA);
    strokeWeight(2);
    
    line(startPos.x, startPos.y, this.tempWireEndX.value, this.tempWireEndY.value);
  }

  /**
   * 指定座標にある削除対象を取得
   */
  getDeletionTarget(worldX, worldY) {
    for (let i = this.wires.length - 1; i >= 0; i--) {
      const wire = this.wires[i];
      if (wire.isMouseOver(worldX, worldY, CONST.DELETE_MODE.WIRE_HIT_DISTANCE)) {
        return { type: 'wire', target: wire };
      }
    }
    
    const snapDistance = CONST.PARTS.WIDTH * CONST.DELETE_MODE.SNAP_DISTANCE_MULTIPLIER / 2;
    let closestPart = null;
    let closestDist = snapDistance;

    for (let i = this.parts.length - 1; i >= 0; i--) {
      const part = this.parts[i];
      if (part.type === CONST.PART_TYPE.JOINT) continue;

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
    textAlign(CENTER, TOP);
    textSize(18);
    fill(255, 100, 100);
    stroke(0);
    strokeWeight(3);
    text(CONST.MESSAGES.TEXT_DELETE_MODE, width / 2, 20);
    pop();
  }

  /**
   * 複数選択モードの表示（テキスト＆カーソル）
   * update() の最後で呼び出す
   */
  drawMultiSelectOverlay() {
    if (!this.isMultiSelectMode) return;
    
    // 1. 画面上部のテキスト表示（画面座標系）
    push();
    textAlign(CENTER, TOP);
    textSize(CONST.MULTI_SELECT_MODE.TEXT_SIZE);
    textStyle(BOLD);
    fill(...CONST.MULTI_SELECT_MODE.COLOR_TEXT);
    stroke(0);
    strokeWeight(CONST.MULTI_SELECT_MODE.TEXT_STROKE_WEIGHT);
    text(CONST.MESSAGES.TEXT_MULTI_SELECT || CONST.UI_LABELS.MULTI_SELECT, width / 2, 20);
    pop();

    // 2. カーソル/ハイライト表示（ワールド座標系）
    push();
    this.inputManager.applyTransform();

    const worldMouse = this.getWorldPosition(mouseX, mouseY);

    // 吸着対象を探す
    let targetPart = null;
    
    // ドラッグ中や操作中は吸着させない（カーソルが暴れるのを防ぐ）
    // ★追加: グループ回転中も吸着させない
    if (!this.isGroupDragging && !this.draggingPart && !this.isGroupRotating) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const part = this.parts[i];
        if (part.type === CONST.PART_TYPE.JOINT) continue;
        if (part.isSelected) continue; // 既に選択済みのものはスキップ

        // 広めの判定範囲で吸着チェック
        if (part.isMouseOver(worldMouse.x, worldMouse.y, CONST.MULTI_SELECT_MODE.SNAP_DISTANCE_MULTIPLIER)) {
          targetPart = part;
          break;
        }
      }
    }

    // --- 目標値の設定 ---
    if (targetPart) {
      // ■ パーツに吸着する場合
      const rotCenter = targetPart.getRotationCenter();
      
      this.msCursor.x.setTarget(rotCenter.x);
      this.msCursor.y.setTarget(rotCenter.y);
      this.msCursor.rot.setTarget(targetPart.rotation);

      // パーツごとのサイズ情報を取得
      const box = targetPart.getSelectionBox();
      this.msCursor.w.setTarget(box.w);
      this.msCursor.h.setTarget(box.h);
      this.msCursor.r.setTarget(box.r);

    } else {
      // ■ マウス位置に追従する場合
      this.msCursor.x.setTarget(worldMouse.x);
      this.msCursor.y.setTarget(worldMouse.y);
      this.msCursor.rot.setTarget(0); // 回転なし

      // デフォルトのカーソルサイズ
      this.msCursor.w.setTarget(CONST.MULTI_SELECT_MODE.CURSOR_WIDTH);
      this.msCursor.h.setTarget(CONST.MULTI_SELECT_MODE.CURSOR_HEIGHT);
      this.msCursor.r.setTarget(CONST.MULTI_SELECT_MODE.CURSOR_CORNER_RADIUS);
    }

    // --- アニメーション更新 ---
    this.msCursor.x.update();
    this.msCursor.y.update();
    this.msCursor.rot.update();
    this.msCursor.w.update();
    this.msCursor.h.update();
    this.msCursor.r.update();

    // --- 描画 ---
    // アニメーション中の値を反映して描画
    push();
    translate(this.msCursor.x.value, this.msCursor.y.value);
    rotate(this.msCursor.rot.value);
    
    // 回転中心補正（パーツに吸着時はpivot考慮）
    if (targetPart) {
      const pivot = targetPart.getPivotOffset();
      translate(-pivot.x, -pivot.y);
    }

    noStroke();
    fill(...CONST.MULTI_SELECT_MODE.COLOR_BG);
    rectMode(CENTER);
    rect(0, 0, this.msCursor.w.value, this.msCursor.h.value, this.msCursor.r.value);

    stroke(...CONST.MULTI_SELECT_MODE.COLOR_STROKE);
    strokeWeight(CONST.MULTI_SELECT_MODE.CURSOR_STROKE_WEIGHT);
    
    // 常に点線で表示（スナップ中も「未確定」であることを示すため点線で統一）
    drawingContext.setLineDash(CONST.MULTI_SELECT_MODE.CURSOR_DASH_PATTERN);
    noFill();
    rect(0, 0, this.msCursor.w.value, this.msCursor.h.value, this.msCursor.r.value);
    drawingContext.setLineDash([]);
    
    pop();
    
    pop(); // applyTransformの解除
  }

  /**
   * 現在の状態から「何を表示すべきか」を判定する可視性ルール
   * @returns {Object} 可視性ルール
   */
  getVisibilityRules() {
    return {
      // 回転ハンドル: 特殊モードやドラッグ操作中以外で表示
      // ★修正: 複数選択モード時も表示を許可（CircuitPart側で選択済みのみ表示）
      showRotationHandles: !this.isDeleteMode && 
                          !this.wiringStartNode &&
                          !this.isGroupDragging &&
                          !this.isGroupRotating &&
                          !this.draggingPart,
      
      // ソケットのTempハンドル（接続候補）: 
      // 特殊モード中は非表示。Jointドラッグ中は接続先を見たいので表示許可
      showTempSockets: !this.isDeleteMode && 
                       !this.isMultiSelectMode &&
                       !this.isGroupDragging &&
                       (!this.draggingPart || this.draggingPart.type === CONST.PART_TYPE.JOINT),
      
      // デタッチハンドル: 特殊モードや各種操作中以外で表示
      showDetachHandles: !this.isDeleteMode && 
                        !this.isMultiSelectMode &&
                        !this.wiringStartNode &&
                        !this.draggingPart &&
                        !this.isGroupDragging,
      
      // Jointのムーブハンドル: 特殊モードや配線中・グループドラッグ中以外で表示
      showJointHandles: !this.isDeleteMode && 
                       !this.isMultiSelectMode &&
                       !this.wiringStartNode &&
                       !this.isGroupDragging,
      
      // 配線中かどうか（ソケットの表示ロジック用）
      isWiring: !!this.wiringStartNode,
      
      // 現在操作中のパーツID（そのパーツ自身は特別扱い）
      activePartId: this.draggingPart?.id || null,
      
      // ★追加: 複数選択モードかどうか（CircuitPart側でハンドルの出し分けに使う）
      isMultiSelectMode: this.isMultiSelectMode
    };
  }

  /**
   * キャンバスの更新と描画
   */
  update() {
    this.powerSystem.update();
    
    this.parts.forEach(part => part.updateAnimation());

    // ★追加: グループ回転中の追従処理（塊感を出すため、毎フレーム即時計算）
    if (this.isGroupRotating && this.draggingPart) {
      this.syncGroupRotation();
    }

    background(CONST.COLORS.BACKGROUND);

    push(); // 座標系保存
    
    this.inputManager.applyTransform();

    if (this.isGridVisible) {
      this.drawGrid();
    }

    const worldMouse = this.getWorldPosition(mouseX, mouseY);
    
    // 可視性ルールを生成
    const visibilityRules = this.getVisibilityRules();

    // 各パーツに可視性ルールを渡して描画
    this.parts.forEach(part => part.draw(worldMouse, visibilityRules));
    this.wires.forEach(wire => wire.draw());

    this.drawTempWire();

    pop(); // 座標系復帰

    this.drawDeleteModeWarning();
    this.drawMultiSelectOverlay();
  }


  // ==================== マウス・入力処理 ====================
  
  /**
   * ★追加: グループ回転中の各パーツ位置をPivotに合わせて同期する
   */
  syncGroupRotation() {
    const pivot = this.draggingPart;
    const pivotData = this.groupRotationData.get(pivot);
    if (!pivotData) return;

    // Pivotの「現在」の角度を使用（これで同期ズレを防ぐ＆円運動させる）
    const currentPivotRot = pivot.rotation; 

    // 初期角度からの差分（初期状態との比較）
    const deltaAngle = currentPivotRot - pivotData.initialRotation;
    const pivotCenter = pivot.getRotationCenter();

    for (const [part, data] of this.groupRotationData) {
      if (data.isPivot) continue;

      // 角度と位置を計算して即時反映 (setImmediate)
      // これにより SmoothValue の線形補間をバイパスし、円運動を直接反映する
      
      const targetRot = data.initialRotation + deltaAngle;
      
      const cos = Math.cos(deltaAngle);
      const sin = Math.sin(deltaAngle);
      const rotatedX = data.offsetFromPivot.x * cos - data.offsetFromPivot.y * sin;
      const rotatedY = data.offsetFromPivot.x * sin + data.offsetFromPivot.y * cos;
      
      const newCenterX = pivotCenter.x + rotatedX;
      const newCenterY = pivotCenter.y + rotatedY;
      const pivotOffset = part.getPivotOffset();

      part.setPositionImmediately(newCenterX - pivotOffset.x - CONST.PARTS.WIDTH / 2, newCenterY - pivotOffset.y - CONST.PARTS.HEIGHT / 2);
      if (part.type !== CONST.PART_TYPE.JOINT) {
        part.setRotationImmediately(targetRot);
      }
    }
  }

  // ==================== マウス・入力処理 ====================
  
  /**
   * マウスボタンを押した時の処理
   */
  handleMousePressed(isMobile = false) {
    const worldMouse = this.getWorldPosition(mouseX, mouseY);
    
    // 1. 削除モード（優先）
    if (this.isDeleteMode && !isMobile) {
      const result = this.getDeletionTarget(worldMouse.x, worldMouse.y);
      if (result) {
        if (result.type === 'wire') {
          this.deleteWire(result.target);
        } else if (result.type === 'part') {
          this.deletePart(result.target);
        }
      } else {
        this.isPanning = true;
      }
      return;
    }

    // 2. クリック判定
    let clickedPart = null;

    // ★修正: 判定ロジックをモードではっきりと分ける
    if (this.isMultiSelectMode) {
      // ===========================================
      // ■ 複数選択モードの判定ロジック
      // ===========================================
      const snapScale = CONST.MULTI_SELECT_MODE.SNAP_DISTANCE_MULTIPLIER;
      
      // ★修正: 判定順序を変更！「未選択パーツ（新規選択）」を最優先にする
      
      // A. まず「未選択」のパーツを探す（新規選択を優先）
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const part = this.parts[i];
        if (part.type === CONST.PART_TYPE.JOINT) continue;
        if (part.isSelected) continue;

        if (part.isMouseOver(worldMouse.x, worldMouse.y, snapScale)) {
          clickedPart = part;
          break;
        }
      }

      // B. 未選択が見つからなければ、「選択済みパーツの回転ハンドル」を判定
      if (!clickedPart) {
        for (const part of this.selectedParts) {
          if (part.isMouseOverRotationHandle(worldMouse.x, worldMouse.y)) {
            this.draggingPart = part; // Pivotとして使用
            this.isGroupRotating = true;
            
            // Pivotパーツの回転開始処理
            part.onRotationMouseDown(worldMouse.x, worldMouse.y);
            
            // グループ回転の初期化（他のパーツの相対位置を保存）
            this.initializeGroupRotation(part);
            return;
          }
        }
      }

      // C. それも見つからなければ、「選択済み」のパーツを探す（ドラッグ移動用）
      if (!clickedPart && !this.isGroupRotating) {
        for (let i = this.parts.length - 1; i >= 0; i--) {
          const part = this.parts[i];
          if (part.type === CONST.PART_TYPE.JOINT) continue;
          
          if (part.isMouseOver(worldMouse.x, worldMouse.y, snapScale)) {
            clickedPart = part;
            break;
          }
        }
      }

    } else {
      // ===========================================
      // ■ 通常モードの判定ロジック
      //   (回転ハンドルなどの特殊判定を含む)
      // ===========================================
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const part = this.parts[i];
        
        // A. 特殊操作（回転ハンドルやソケット）
        // ※このブロックは通常モードでしか実行されないので安全
        if (part.isMouseOverRotationHandle(worldMouse.x, worldMouse.y) || 
            part.getHoveredSocket(worldMouse.x, worldMouse.y) ||
            part.sockets.some(s => s.isMouseOverDetachHandle(worldMouse.x, worldMouse.y))) {
          
          // ここでループを抜ける（clickedPartはnullのまま）
          // 後続の処理で特殊操作として扱われる
          break; 
        }

        // B. パーツ本体のクリック判定
        if (part.isMouseOver(worldMouse.x, worldMouse.y)) {
          clickedPart = part;
          break; 
        }
      }
    }

    // --- 以降は共通処理 ---

    // 複数選択モードの処理
    if (this.isMultiSelectMode) {
      if (clickedPart) {
        if (clickedPart.type === CONST.PART_TYPE.JOINT) {
          return; 
        }

        this.draggingPart = clickedPart;
        this.clickedPartWasSelected = this.selectedParts.has(clickedPart);
        
        if (!this.clickedPartWasSelected) {
          clickedPart.isSelected = true;
          this.selectedParts.add(clickedPart);
        }
        
        this.startGroupDrag(worldMouse);
        return;
      } else {
        if (!isMobile) this.isPanning = true;
        return; 
      }
    }

    // 通常モードの処理
    if (clickedPart) {
      this.draggingPart = clickedPart;
      clickedPart.onMouseDown(worldMouse.x, worldMouse.y);
      
      this.dragJointWeights = null;
      if (clickedPart.type !== CONST.PART_TYPE.JOINT) {
        this.dragJointWeights = GraphUtils.calculateJointWeights(clickedPart);
      }
      return;
    }

    // 通常モード：パーツ以外（回転ハンドルやソケット）の再判定
    // ※elseブロックでbreakした場合はここに来る
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const part = this.parts[i];
      
      if (part.isMouseOverRotationHandle(worldMouse.x, worldMouse.y)) {
        this.draggingPart = part;
        part.onRotationMouseDown(worldMouse.x, worldMouse.y);
        return;
      }

      for (let socket of part.sockets) {
        if (socket.isMouseOverDetachHandle(worldMouse.x, worldMouse.y)) {
          this.detachTargetSocket = socket;
          this.detachStartPos = { x: mouseX, y: mouseY };
          return;
        }
      }
      
      const hoveredSocket = part.getHoveredSocket(worldMouse.x, worldMouse.y);
      if (hoveredSocket) {
        this.wiringStartNode = { part: part, socket: hoveredSocket };
        part.wiringStartSocket = hoveredSocket.name;
        this.tempWireEndX.setImmediate(worldMouse.x);
        this.tempWireEndY.setImmediate(worldMouse.y);
        return;
      }
    }

    // 何もクリックしなかった場合
    if (!isMobile) {
      this.isPanning = true;
    }
  }

  /**
   * グループドラッグ開始処理
   */
  startGroupDrag(worldMouse) {
    this.isGroupDragging = true;
    
    // 1. 各パーツのドラッグ開始位置を記録（相対移動用）
    this.selectedParts.forEach(part => {
      part.onMouseDown(worldMouse.x, worldMouse.y);
    });

    // 2. 内部Joint（道連れにするJoint）を検出
    this.detectImplicitJoints();
    
    // 3. 内部Jointもドラッグ開始状態にする
    this.implicitJoints.forEach(joint => {
      joint.dragStartX = joint.posX.target;
      joint.dragStartY = joint.posY.target;
    });
    
    console.log(`グループ移動開始: パーツ${this.selectedParts.size}個 + Joint${this.implicitJoints.size}個`);
  }

  /**
   * ★追加: グループ回転の初期化
   * 軸となるパーツ（Pivot）以外の相対位置と角度を保存する
   * @param {CircuitPart} pivotPart - 回転軸となるパーツ
   */
  initializeGroupRotation(pivotPart) {
    this.groupRotationData.clear();
    
    // 道連れJointも検出
    this.detectImplicitJoints();
    
    // 影響を受ける全パーツ（選択パーツ＋道連れJoint）
    const allAffected = new Set([...this.selectedParts, ...this.implicitJoints]);
    
    // 回転中心（ピボット）のワールド座標を取得（ピボット自体は位置を変えない）
    const pivotCenter = pivotPart.getRotationCenter();
    const pivotStartRotation = pivotPart.rot.target;
    
    // 各パーツの初期状態を記録
    for (const part of allAffected) {
      if (part === pivotPart) continue;
      
      const partCenter = part.getRotationCenter();
      
      this.groupRotationData.set(part, {
        initialRotation: part.rot.target,
        // ピボット中心からの相対ベクトル
        offsetFromPivot: {
          x: partCenter.x - pivotCenter.x,
          y: partCenter.y - pivotCenter.y
        }
      });
    }
    
    // ピボット自体の初期角度も保存（念のため）
    this.groupRotationData.set(pivotPart, {
      initialRotation: pivotStartRotation,
      isPivot: true
    });
    
    console.log(`グループ回転開始: Pivot ID=${pivotPart.id}, 対象=${allAffected.size}個`);
  }

  /**
   * マウスを動かしている時の処理
   */
  handleMouseDragged(movementX = 0, movementY = 0) {
    if (this.inputManager.handleTwoFingerGesture(touches)) {
      this.draggingPart = null;
      this.dragJointWeights = null;
      this.isGroupDragging = false;
      return;
    }

    if (this.detachTargetSocket) {
      const dragDistance = dist(mouseX, mouseY, this.detachStartPos.x, this.detachStartPos.y);
      const threshold = CONST.PARTS.SOCKET_HIT_RADIUS;
      if (dragDistance > threshold) {
        const socket = this.detachTargetSocket;

        const socketPos = socket.getConnectorWorldPosition();
        const jointX = socketPos.x - CONST.PARTS.WIDTH / 2;
        const jointY = socketPos.y - CONST.PARTS.HEIGHT / 2;
        
        this.createPart(CONST.PART_TYPE.JOINT, jointX, jointY);
        const newJoint = this.parts[this.parts.length - 1];
        const jointSocket = newJoint.getSocket('center');

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

        this.draggingPart = newJoint;
        newJoint.onMouseDown(worldMouse.x, worldMouse.y);

        this.detachTargetSocket = null;
        this.detachStartPos = null;
      }
      return;
    }

    const worldMouse = this.getWorldPosition(mouseX, mouseY);

    // ★追加: グループ回転処理
    if (this.isGroupRotating && this.draggingPart) {
      const pivot = this.draggingPart;
      
      // Pivot自身の回転ターゲットを更新（スナップはここで処理される）
      // 追従パーツの同期は update() 内の syncGroupRotation で行われるので、ここではPivotを動かすだけでOK
      pivot.onRotationMouseDragged(this.rotationSnapEnabled, worldMouse.x, worldMouse.y);
      return;
    }

    // ★修正: グループドラッグ中（リーダー追従方式に変更）
    if (this.isGroupDragging) {
      const snapUnit = this.moveSnapEnabled ? CONST.GRID.SNAP_COARSE : CONST.GRID.SNAP_FINE;
      
      // リーダー（ドラッグの基準となるパーツ）を取得
      // 通常はクリックしたパーツ(draggingPart)だが、念のため選択リストの先頭をフォールバックに
      const leader = this.draggingPart || this.selectedParts.values().next().value;
      
      if (leader) {
        // 1. リーダー自身の移動（ここでスナップ計算が行われる）
        leader.onMouseDragged(worldMouse.x, worldMouse.y, snapUnit);
        
        // 2. リーダーの「移動量（開始位置からの変位）」を算出
        // dragStartX は onMouseDown で記録された「ドラッグ開始時の座標」
        const dx = leader.targetX - leader.dragStartX;
        const dy = leader.targetY - leader.dragStartY;
        
        // 3. リーダー以外の全パーツ（選択パーツ＋道連れJoint）に同じ変位を適用
        
        // 選択パーツ
        this.selectedParts.forEach(part => {
          if (part !== leader) {
            part.posX.setTarget(part.dragStartX + dx);
            part.posY.setTarget(part.dragStartY + dy);
          }
        });
        
        // 道連れJoint
        this.implicitJoints.forEach(joint => {
          // JointはdraggingPartになることはない（選択不可）ので無条件適用でOK
          joint.posX.setTarget(joint.dragStartX + dx);
          joint.posY.setTarget(joint.dragStartY + dy);
        });
      }
      return;
    }

    // 通常の1本指操作
    if (this.draggingPart) {
      if (this.draggingPart.isRotating) {
        this.draggingPart.onRotationMouseDragged(this.rotationSnapEnabled, worldMouse.x, worldMouse.y);
      } else {
        const oldX = this.draggingPart.targetX;
        const oldY = this.draggingPart.targetY;
        
        const snapUnit = this.moveSnapEnabled ? CONST.GRID.SNAP_COARSE : CONST.GRID.SNAP_FINE;
        
        this.draggingPart.onMouseDragged(worldMouse.x, worldMouse.y, snapUnit);
        
        if(this.draggingPart.type === CONST.PART_TYPE.JOINT) {
          if (this.currentSnapSocket) {
            this.currentSnapSocket.isTargeted = false;
            this.currentSnapSocket = null;
          }

          const jointCenterX = this.draggingPart.targetX + CONST.PARTS.WIDTH / 2;
          const jointCenterY = this.draggingPart.targetY + CONST.PARTS.HEIGHT / 2;
          const targetSocket = this.findNearbySocket(jointCenterX, jointCenterY, this.draggingPart);

          const jointSocket = this.draggingPart.getSocket('center');
          const otherEndSockets = jointSocket.connectedWires.map(wire => wire.getOtherEnd(jointSocket));
          const isConnectingToSelf = otherEndSockets.includes(targetSocket);

          if (targetSocket && !isConnectingToSelf) {
            const socketPos = targetSocket.getConnectorWorldPosition();
            this.draggingPart.posX.setTarget(socketPos.x - CONST.PARTS.WIDTH / 2);
            this.draggingPart.posY.setTarget(socketPos.y - CONST.PARTS.HEIGHT / 2);
            targetSocket.isTargeted = true;
            this.currentSnapSocket = targetSocket;
          }
        }

        const dx = this.draggingPart.targetX - oldX;
        const dy = this.draggingPart.targetY - oldY;
        
        if (this.dragJointWeights && (dx !== 0 || dy !== 0)) {
          for (const [joint, weight] of this.dragJointWeights) {
            joint.posX.setTarget(joint.posX.target + dx * weight);
            joint.posY.setTarget(joint.posY.target + dy * weight);
          }
        }
      }
    } 
    else if (this.isPanning) {
      const dx = movementX !== 0 ? movementX : mouseX - pmouseX;
      const dy = movementY !== 0 ? movementY : mouseY - pmouseY;
      this.inputManager.pan(dx, dy);
    }
  }

  /**
   * マウスを離した時の処理
   */
  handleMouseReleased() {
    this.inputManager.resetTwoFingerGesture();
    this.isPanning = false;

    // ★追加: グループ回転終了
    if (this.isGroupRotating) {
      if (this.draggingPart) {
        this.draggingPart.onRotationMouseUp();
      }
      this.isGroupRotating = false;
      this.draggingPart = null;
      this.groupRotationData.clear();
      this.implicitJoints.clear(); // 回転用に計算したJointをクリア
      return;
    }

    // グループドラッグ終了
    if (this.isGroupDragging) {
      let anyPartMoved = false;
      for (const part of this.selectedParts) {
        if (part.wasDragged()) {
          anyPartMoved = true;
          break;
        }
      }
      
      if (!anyPartMoved && this.clickedPartWasSelected) {
        if (this.draggingPart && this.selectedParts.has(this.draggingPart)) {
          this.draggingPart.isSelected = false;
          this.selectedParts.delete(this.draggingPart);
          console.log(`パーツの選択を解除しました: ${this.draggingPart.id}`);
        }
      }
      
      this.isGroupDragging = false;
      this.clickedPartWasSelected = false;
      
      this.draggingPart = null;
      
      this.selectedParts.forEach(part => part.onMouseUp());
      this.implicitJoints.clear();
      return;
    }

    if (this.currentSnapSocket) {
      this.currentSnapSocket.isTargeted = false;
      this.currentSnapSocket = null;
    }

    if(this.detachTargetSocket) {
      this.detachTargetSocket = null;
      this.detachStartPos = null;
    }

    const worldMouse = this.getWorldPosition(mouseX, mouseY);
    
    if (this.wiringStartNode) {
      const startSocket = this.wiringStartNode.socket;
      const startPos = startSocket.getConnectorWorldPosition();
      const distFromStart = dist(worldMouse.x, worldMouse.y, startPos.x, startPos.y);
      
      let cancelThreshold = CONST.PARTS.SOCKET_HIT_RADIUS;
      if (startSocket.parent.type === CONST.PART_TYPE.JOINT) {
         cancelThreshold = CONST.PARTS.JOINT_HIT_RADIUS;
      }
      
      if (distFromStart < cancelThreshold) {
        this.wiringStartNode.part.wiringStartSocket = null;
        this.wiringStartNode = null;
        return;
      }
      
      let targetSocket = this.findNearbySocket(worldMouse.x, worldMouse.y, this.wiringStartNode.socket);
      
      if (!targetSocket) {
        const isOverAnyPart = this.parts.some(p => p.isMouseOver(worldMouse.x, worldMouse.y));
        if (!isOverAnyPart) {
          let centerX = worldMouse.x;
          let centerY = worldMouse.y;
          if (this.moveSnapEnabled) {
            const snap = CONST.GRID.SNAP_COARSE;
            // オフセット（-2px）を適用して、描画位置と一致させる
            const offset = {x: CONST.GRID.DRAW_OFFSET, y: CONST.GRID.DRAW_OFFSET};
            const snapped = MathUtils.snapPosition(centerX, centerY, snap, offset);
            centerX = snapped.x;
            centerY = snapped.y;
          }
          const jointX = centerX - CONST.PARTS.WIDTH / 2;
          const jointY = centerY - CONST.PARTS.HEIGHT / 2;

          this.createPart(CONST.PART_TYPE.JOINT, jointX, jointY);
          const newJoint = this.parts[this.parts.length - 1];
          targetSocket = newJoint.getSocket('center');
        }
      }

      if (targetSocket) {
        const newWire = new Wire(
          this.wiringStartNode.socket,
          targetSocket
        );
        this.wires.push(newWire);
      }

      if (this.wiringStartNode) {
        this.wiringStartNode.part.wiringStartSocket = null;
        this.wiringStartNode = null;
      }
    }

    if (this.draggingPart) {
      if (this.draggingPart.isRotating) {
        this.draggingPart.onRotationMouseUp();
      } else if (this.draggingPart.type === CONST.PART_TYPE.JOINT) {
         const jointCenterX = this.draggingPart.targetX + CONST.PARTS.WIDTH / 2;
         const jointCenterY = this.draggingPart.targetY + CONST.PARTS.HEIGHT / 2;
         const targetSocket = this.findNearbySocket(jointCenterX, jointCenterY, this.draggingPart);
         
         // 自己接続チェックを削除: Jointが接続している先に重ねた場合でもマージを許可
         // 一時的に同じソケット間のワイヤーができても、後続の consolidateWires で削除される
         if (targetSocket) {
            const joint = this.draggingPart;
            const jointSocket = joint.getSocket('center');
            const wiresToReattach = [...jointSocket.connectedWires];
            
            wiresToReattach.forEach(wire => {
              // ワイヤーの付け替え
              if (wire.startSocket === jointSocket) wire.startSocket = targetSocket;
              if (wire.endSocket === jointSocket) wire.endSocket = targetSocket;
              targetSocket.connectWire(wire);
            });
            
            // Jointを削除
            this.deletePart(joint);
         } else {
            // ターゲットがない場合は通常終了（位置ずらしロジックは削除）
            this.draggingPart.onMouseUp();
         }
      } else {
        if (!this.draggingPart.wasDragged()) {
          this.draggingPart.interact();
        }
        this.draggingPart.onMouseUp();
      }
      this.draggingPart = null;
    }

    // 操作終了時にワイヤーを整理（重複・0長ワイヤー削除）
    this.consolidateWires();
  }

  // ==================== シリアライズ ====================
  
  /**
   * 回路データをシリアライズ
   */
  serializeCircuitData(compact = false) {
    const viewState = {
      x: this.inputManager.viewOffsetX,
      y: this.inputManager.viewOffsetY,
      scale: this.inputManager.viewScale
    };
    return CircuitSerializer.serialize(this.parts, this.wires, compact, viewState);
  }

  /**
   * シリアライズされたデータから回路を復元
   */
  restoreFromData(saveData) {
    this.draggingPart = null;
    this.wiringStartNode = null;
    this.isPanning = false;
    
    const restoredView = CircuitSerializer.deserialize(saveData, this.parts, this.wires);
    
    if (restoredView) {
      this.inputManager.viewOffsetX = restoredView.x;
      this.inputManager.viewOffsetY = restoredView.y;
      this.inputManager.viewScale = restoredView.scale;
    } else {
      this.inputManager.viewOffsetX = 0;
      this.inputManager.viewOffsetY = 0;
      this.inputManager.viewScale = 1.0;
    }
    
    this.powerSystem.lastTick = -1;
  }
}
