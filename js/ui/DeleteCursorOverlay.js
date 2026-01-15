'use strict';

import { CONST } from '../config/constants.js';

/**
 * 削除カーソルオーバーレイ
 * スマホ専用の削除カーソルの制御を担当
 */
export class DeleteCursorOverlay {
  constructor(circuitManager) {
    this.circuitManager = circuitManager;
    
    // 削除カーソルの状態管理
    this.element = null;
    this.handle = null;
    this.isDragging = false;
    this.x = 0;
    this.y = 0;
    this.snappedTarget = null;
  }

  /**
   * 削除カーソルの初期化
   */
  initialize() {
    this.element = document.getElementById('mobile-delete-cursor');
    this.handle = document.querySelector('.delete-cursor-handle');
    
    if (!this.element || !this.handle) return;
    
    // 初期位置を画面中央に設定
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this.updatePosition();
    
    this.setupEventListeners();
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // ハンドルのドラッグイベント
    this.handle.addEventListener('touchstart', (e) => {
      if (!this.circuitManager.getDeleteMode()) return;
      
      e.preventDefault();
      e.stopPropagation();
      this.isDragging = true;
      
      const touch = e.touches[0];
      this.startX = touch.clientX - this.x;
      this.startY = touch.clientY - this.y;
    });
    
    document.addEventListener('touchmove', (e) => {
      if (!this.isDragging) return;
      
      e.preventDefault();
      const touch = e.touches[0];
      this.x = touch.clientX - this.startX;
      this.y = touch.clientY - this.startY;
      
      this.updatePosition();
      this.checkSnap();
    });
    
    document.addEventListener('touchend', (e) => {
      if (!this.isDragging) return;
      
      this.isDragging = false;
    });
    
    // 削除カーソルのタップで削除実行
    this.element.addEventListener('click', (e) => {
      if (!this.circuitManager.getDeleteMode()) return;
      if (this.isDragging) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const snap = this.snappedTarget;
      
      if (snap) {
        if (snap.type === 'wire') {
          this.circuitManager.deleteWire(snap.target);
        } else if (snap.type === 'part') {
          this.circuitManager.deletePart(snap.target);
        }
        
        // 削除後の後始末
        this.snappedTarget = null;
        this.element.classList.remove('snapped');
      }
    });
  }

  /**
   * 削除カーソルの位置とサイズを更新
   */
  updatePosition() {
    if (!this.element) return;
    
    // 1. 現在のズーム倍率を取得
    const scale = this.circuitManager.getInputManager().viewScale;
    
    // 2. カーソル枠のサイズを計算
    const baseSize = CONST.PARTS.WIDTH + 20; 
    const currentSize = baseSize * scale;
    
    // 3. HTML要素に適用
    const frame = this.element.querySelector('.delete-cursor-frame');
    if (frame) {
      frame.style.width = `${currentSize}px`;
      frame.style.height = `${currentSize}px`;

      // 中の「×」マークの文字サイズも合わせる
      const xMark = this.element.querySelector('.delete-cursor-x');
      if (xMark) {
        xMark.style.fontSize = `${36 * scale}px`;
      }
    }
    
    // 4. 位置合わせ
    // ハンドルの高さ（CSSで50px）
    const handleHeight = 50;
    
    // コンテナ全体の高さは「枠」と「ハンドル」の大きい方になる
    const containerHeight = Math.max(currentSize, handleHeight);
    
    // 横位置：枠のサイズ基準で合わせる（左端が揃っているため）
    this.element.style.left = `${this.x - currentSize / 2}px`;
    
    // 縦位置：コンテナ全体の高さ基準で合わせる（垂直中央揃えされているため）
    this.element.style.top = `${this.y - containerHeight / 2}px`;
  }

  /**
   * 削除カーソルのスナップ判定
   */
  checkSnap() {
    if (!this.circuitManager) return;

    // キャンバスのオフセット取得
    const container = document.getElementById(CONST.DOM_IDS.COMMON.CANVAS_CONTAINER);
    const offset = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
    
    const canvasX = this.x - offset.left;
    const canvasY = this.y - offset.top;

    // ワールド座標に変換
    const worldPos = this.circuitManager.getWorldPosition(canvasX, canvasY);
    
    // 共通メソッドを使ってターゲットを取得
    const result = this.circuitManager.getDeletionTarget(worldPos.x, worldPos.y);
    
    if (result) {
      // ターゲットが見つかったら保存（削除実行時に使う）
      this.snappedTarget = result;
      this.element.classList.add('snapped');
      
      let targetX, targetY;
      
      // 対象の種類によってスナップ先の座標を決める
      if (result.type === 'wire') {
        // ワイヤーなら「中点」にスナップ
        const w = result.target;
        const start = w.startSocket.getConnectorWorldPosition();
        const end = w.endSocket.getConnectorWorldPosition();
        targetX = (start.x + end.x) / 2;
        targetY = (start.y + end.y) / 2;
      } else {
        // パーツなら「中心」にスナップ
        const center = result.target.getCenter();
        targetX = center.x;
        targetY = center.y;
      }
      
      // 画面座標に戻してカーソルを移動
      const screenPos = this.worldToScreenPosition(targetX, targetY);
      this.x = screenPos.x + offset.left;
      this.y = screenPos.y + offset.top;
      
      this.updatePosition();
    } else {
      // 何も見つからない時
      this.snappedTarget = null;
      this.element.classList.remove('snapped');
    }
  }

  /**
   * ワールド座標をスクリーン座標に変換
   */
  worldToScreenPosition(worldX, worldY) {
    return this.circuitManager.getInputManager().getScreenPosition(worldX, worldY);
  }

  /**
   * 削除カーソルの表示/非表示を切り替え
   */
  updateVisibility() {
    if (!this.element) return;
    
    const isDeleteMode = this.circuitManager.getDeleteMode();
    
    if (isDeleteMode) {
      this.element.classList.remove('hidden');
      
      // 削除ボタンの少し上にリセット
      const deleteBtn = document.getElementById(CONST.DOM_IDS.MOBILE.FAB_DELETE);
      
      if (deleteBtn) {
        const rect = deleteBtn.getBoundingClientRect();
        
        // X座標: ボタンの水平方向の中心
        this.x = rect.left + rect.width / 2;
        
        // Y座標: ボタンの上端から少し上（例: 60px上）に配置
        this.y = rect.top - 60;
      } else {
        // 万が一ボタンが見つからない場合は、画面中央へ
        this.x = window.innerWidth / 2;
        this.y = window.innerHeight / 2;
      }
      
      // スナップ状態をリセット
      this.snappedTarget = null;
      this.element.classList.remove('snapped');
      this.updatePosition();

    } else {
      this.element.classList.add('hidden');
      this.snappedTarget = null;
    }
  }

  /**
   * 毎フレーム呼ばれる更新処理
   */
  update() {
    if (!this.circuitManager.getDeleteMode()) return;
    
    // もし何かにスナップ中なら、ターゲットの新しい位置にカーソル座標を追従させる
    if (this.snappedTarget) {
      const t = this.snappedTarget;
      let worldX, worldY;
      
      if (t.type === 'wire') {
        // ワイヤーなら中点
        const start = t.target.startSocket.getConnectorWorldPosition();
        const end = t.target.endSocket.getConnectorWorldPosition();
        worldX = (start.x + end.x) / 2;
        worldY = (start.y + end.y) / 2;
      } else {
        // パーツなら中心
        const center = t.target.getCenter();
        worldX = center.x;
        worldY = center.y;
      }

      // ワールド座標 → スクリーン座標 に変換
      const screenPos = this.worldToScreenPosition(worldX, worldY);
      
      // ヘッダーなどのオフセットを加算
      const container = document.getElementById(CONST.DOM_IDS.COMMON.CANVAS_CONTAINER);
      const offset = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
      
      this.x = screenPos.x + offset.left;
      this.y = screenPos.y + offset.top;
    }
    
    // サイズと位置をHTMLに反映
    this.updatePosition();
  }
}
