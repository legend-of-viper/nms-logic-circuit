'use strict';

import { CONST } from '../config/constants.js';
import { deviceDetector } from '../utils/DeviceDetector.js';

/**
 * 削除カーソルオーバーレイ（PC/スマホ統合版）
 */
export class DeleteCursorOverlay {
  constructor(circuitManager) {
    this.circuitManager = circuitManager;
    
    // スマホ用
    this.mobileElement = null;
    this.handle = null;
    this.isDragging = false;
    this.x = 0;
    this.y = 0;
    this.startX = 0; // 追加: 初期化
    this.startY = 0; // 追加: 初期化
    this.snappedTarget = null;

    // PC用
    this.pcElement = null;
  }

  initialize() {
    this.mobileElement = document.getElementById('mobile-delete-cursor');
    this.handle = document.querySelector('.delete-cursor-handle');
    if (this.mobileElement && this.handle) {
      this.x = window.innerWidth / 2;
      this.y = window.innerHeight / 2;
      this.setupMobileEventListeners();
    }

    this.pcElement = document.getElementById('pc-delete-highlight');
  }

  update() {
    // 毎フレームの処理の最初に、全ワイヤーのハイライトをリセット
    if (this.circuitManager.wires) {
      this.circuitManager.wires.forEach(w => w.isHighlighted = false);
    }

    // 全リセット（パーツ）
    if (this.circuitManager.parts) {
      this.circuitManager.parts.forEach(p => p.isHighlighted = false);
    }

    if (!this.circuitManager.getDeleteMode()) {
      this.hideAll();
      return;
    }

    if (deviceDetector.isMobile()) {
      this.updateMobile();
    } else {
      this.updatePC();
    }
  }

  hideAll() {
    if (this.mobileElement) this.mobileElement.classList.add('hidden');
    if (this.pcElement) this.pcElement.classList.remove('visible');
    this.snappedTarget = null;
  }

  /**
   * PC用の更新処理
   * ★修正: ターゲットがない時もマウスに追従するように変更
   */
  updatePC() {
    if (!this.pcElement) return;

    // スマホ用は隠す
    if (this.mobileElement) this.mobileElement.classList.add('hidden');

    // マウス位置からターゲット判定
    const worldMouse = this.circuitManager.getWorldPosition(mouseX, mouseY);
    const result = this.circuitManager.getDeletionTarget(worldMouse.x, worldMouse.y);

    let displayX, displayY;

    if (result) {
      // ターゲットあり：ターゲットの中心にスナップ
      const center = this.getTargetCenter(result);
      displayX = center.x;
      displayY = center.y;

      // ターゲットがワイヤーならハイライトさせる
      if (result.type === 'wire') {
        result.target.isHighlighted = true;
      } else if (result.type === 'part') {
        result.target.isHighlighted = true; // ★パーツもON
      }
      
      // スナップ時の見た目変更（クラス付与などで強調したければここで）
      // this.pcElement.classList.add('snapped'); 
      this.pcElement.classList.add('target-snapped');
    } else {
      // ターゲットなし：マウス位置に追従
      displayX = worldMouse.x;
      displayY = worldMouse.y;
      
      // this.pcElement.classList.remove('snapped');
      this.pcElement.classList.remove('target-snapped');
    }

    // 座標適用
    this.applyPositionToElement(this.pcElement, displayX, displayY);
    
    // 常に表示（削除モード中はずっと出しておく）
    this.pcElement.classList.add('visible');
  }

  /**
   * スマホ用の更新処理
   */
  updateMobile() {
    if (!this.mobileElement) return;

    if (this.pcElement) this.pcElement.classList.remove('visible');
    
    this.mobileElement.classList.remove('hidden');
    const frame = this.mobileElement.querySelector('.delete-cursor-frame');

    // 共通のキャンバス情報を取得
    const canvasInfo = this.getCanvasRect();
    if (!canvasInfo) return;

    // カーソルのDOM座標 → キャンバス内座標
    const canvasX = this.x - canvasInfo.left;
    const canvasY = this.y - canvasInfo.top;

    // キャンバス内座標 → ワールド座標
    const worldPos = this.circuitManager.getWorldPosition(canvasX, canvasY);
    
    // ターゲット判定
    const result = this.circuitManager.getDeletionTarget(worldPos.x, worldPos.y);
    this.snappedTarget = result;

    if (this.snappedTarget) {
      // ■ ターゲットあり
      this.snappedTarget.target.isHighlighted = true;

      // カーソルの枠を消す（target-snappedクラス付与）
      if (frame) frame.classList.add('target-snapped');

      // スナップ位置へ吸着表示
      const { x, y } = this.getTargetCenter(this.snappedTarget);
      
      // ワールド座標からスクリーン座標へ逆変換して吸着させる
      const inputMgr = this.circuitManager.getInputManager();
      const screenPos = inputMgr.getScreenPosition(x, y);
      
      this.x = screenPos.x + canvasInfo.left;
      this.y = screenPos.y + canvasInfo.top;

    } else {
      // ■ ターゲットなし
      if (frame) frame.classList.remove('target-snapped');
    }
    
    // DOM位置の更新
    this.updateMobileDOMPosition();
  }

  /**
   * キャンバスの位置情報を取得するヘルパー
   */
  getCanvasRect() {
    const canvas = document.querySelector(`#${CONST.DOM_IDS.COMMON.CANVAS_CONTAINER} canvas`);
    return canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
  }

  getTargetCenter(result) {
    if (result.type === 'wire') {
      const start = result.target.startSocket.getConnectorWorldPosition();
      const end = result.target.endSocket.getConnectorWorldPosition();
      return {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2
      };
    } else {
      return result.target.getCenter();
    }
  }

  /**
   * 座標をDOM要素に適用
   */
  applyPositionToElement(element, worldX, worldY) {
    const inputMgr = this.circuitManager.getInputManager();
    const screenPos = inputMgr.getScreenPosition(worldX, worldY);
    const currentScale = inputMgr.viewScale;
    const size = (CONST.PARTS.WIDTH + 10) * currentScale;

    const offset = this.getCanvasRect(); // ヘルパー再利用

    element.style.left = `${offset.left + screenPos.x - size / 2}px`;
    element.style.top = `${offset.top + screenPos.y - size / 2}px`;
    
    element.style.width = `${size}px`;
    element.style.height = `${size}px`;
    element.style.fontSize = `${30 * currentScale}px`;
  }

  setupMobileEventListeners() {
    // ハンドルでのドラッグ開始
    this.handle.addEventListener('touchstart', (e) => {
      if (!this.circuitManager.getDeleteMode()) return;
      
      e.preventDefault();
      e.stopPropagation();
      this.isDragging = true;
      
      const touch = e.touches[0];
      this.startX = touch.clientX - this.x;
      this.startY = touch.clientY - this.y;
    });
    
    // 画面全体でのドラッグ追従
    document.addEventListener('touchmove', (e) => {
      if (!this.isDragging) return;
      
      e.preventDefault(); // スクロール防止
      const touch = e.touches[0];
      this.x = touch.clientX - this.startX;
      this.y = touch.clientY - this.startY;
      
      this.updateMobileDOMPosition();
    });
    
    // ドラッグ終了
    document.addEventListener('touchend', (e) => {
      this.isDragging = false;
    });
    
    // タップ（削除実行）
    this.mobileElement.addEventListener('click', (e) => {
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
        
        this.snappedTarget = null;
        // クラス削除も target-snapped に統一
        const frame = this.mobileElement.querySelector('.delete-cursor-frame');
        if (frame) frame.classList.remove('target-snapped');
      }
    });
  }
  
  updateMobileDOMPosition() {
    if (!this.mobileElement) return;
    
    const scale = this.circuitManager.getInputManager().viewScale;
    const baseSize = CONST.PARTS.WIDTH + 20; 
    const currentSize = baseSize * scale;
    
    const frame = this.mobileElement.querySelector('.delete-cursor-frame');
    if (frame) {
      frame.style.width = `${currentSize}px`;
      frame.style.height = `${currentSize}px`;

      const xMark = this.mobileElement.querySelector('.delete-cursor-x');
      if (xMark) {
        xMark.style.fontSize = `${36 * scale}px`;
      }
    }
    
    const handleHeight = 50;
    const containerHeight = Math.max(currentSize, handleHeight);
    
    this.mobileElement.style.left = `${this.x - currentSize / 2}px`;
    this.mobileElement.style.top = `${this.y - containerHeight / 2}px`;
  }
  
  updateVisibility() {
    if (!this.mobileElement) return;
  
    const isDeleteMode = this.circuitManager.getDeleteMode();
    
    if (isDeleteMode) {
      this.mobileElement.classList.remove('hidden');
      
      const deleteBtn = document.getElementById(CONST.DOM_IDS.MOBILE.FAB_DELETE);
      
      if (deleteBtn) {
        const rect = deleteBtn.getBoundingClientRect();
        this.x = rect.left + rect.width / 2;
        this.y = rect.top - 60;
      } else {
        this.x = window.innerWidth / 2;
        this.y = window.innerHeight / 2;
      }
      
      this.snappedTarget = null;
      
      // リセット
      const frame = this.mobileElement.querySelector('.delete-cursor-frame');
      if (frame) frame.classList.remove('target-snapped');
      
      this.updateMobileDOMPosition();

    } else {
      this.mobileElement.classList.add('hidden');
      this.snappedTarget = null;
    }
  }
}
