'use strict';

import { Wire } from '../models/Wire.js';
import { PartFactory } from '../models/PartFactory.js';
import { CircuitEngine } from './CircuitEngine.js';
import { CONST } from '../config/constants.js';

/**
 * 回路シミュレーターサービス
 * 回路部品とワイヤーの管理、描画、インタラクションを制御
 */
export class CircuitSimulator {
  constructor() {
    this.parts = [];
    this.wires = [];

    this.engine = new CircuitEngine(this.parts, this.wires);

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
   * @param {string} type - 部品タイプ ('SWITCH', 'BUTTON', etc.)
   */
  createPart(type) {
    const newId = Date.now();
    
    // 部品ごとの初期配置X座標（元のコードの挙動を再現）
    // Refactor: 将来的には定数ファイルやUI側で管理しても良い
    const basePositions = {
      'POWER': 100,
      'WALL_SWITCH': 100,
      'BUTTON': 200,
      'AUTO_SWITCH': 300,
      'INVERTER': 400,
      'COLOR_LIGHT': 500
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
      const center = part.getCenterPos();
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
      const center = targetPart.getCenterPos();
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
    this.engine.calculate();

    background(CONST.COLORS.BACKGROUND);

    // 1. パーツを更新して描画
    for (let part of this.parts) {
      part.update();
      part.draw();
    }

    // 2. 確定済みのワイヤーを描画
    for (let wire of this.wires) {
      wire.draw();
    }

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
   * データの保存（未実装）
   */
  save() {
    console.log("保存機能は未実装です");
    // TODO: 将来的にJSON形式でデータを保存
  }

  /**
   * データの読込（未実装）
   */
  load() {
    console.log("読込機能は未実装です");
    // TODO: 将来的にJSONデータを読み込み
  }
}
