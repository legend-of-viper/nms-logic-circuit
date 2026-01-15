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
    // ★追加: 毎フレームの処理の最初に、全ワイヤーのハイライトをリセット
    if (this.circuitManager.wires) {
      this.circuitManager.wires.forEach(w => w.isHighlighted = false);
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

      // ★追加: ターゲットがワイヤーならハイライトさせる
      if (result.type === 'wire') {
        result.target.isHighlighted = true;
      }
      
      // スナップ時の見た目変更（クラス付与などで強調したければここで）
      // this.pcElement.classList.add('snapped'); 
    } else {
      // ターゲットなし：マウス位置に追従
      displayX = worldMouse.x;
      displayY = worldMouse.y;
      
      // this.pcElement.classList.remove('snapped');
    }

    // 座標適用
    this.applyPositionToElement(this.pcElement, displayX, displayY);
    
    // 常に表示（削除モード中はずっと出しておく）
    this.pcElement.classList.add('visible');
  }

  updateMobile() {
    if (!this.mobileElement) return;

    if (this.pcElement) this.pcElement.classList.remove('visible');
    
    this.mobileElement.classList.remove('hidden');

    if (this.snappedTarget) {
      // ★追加: スマホはイベント時しか判定しないため、毎フレームここでハイライトを再適用する
      if (this.snappedTarget.type === 'wire') {
        this.snappedTarget.target.isHighlighted = true;
      }
      
      const { x, y } = this.getTargetCenter(this.snappedTarget);
      const inputMgr = this.circuitManager.getInputManager();
      const screenPos = inputMgr.getScreenPosition(x, y);
      
      // ★修正: スマホ側もキャンバス自体のオフセットを取得するように変更
      const canvas = document.querySelector(`#${CONST.DOM_IDS.COMMON.CANVAS_CONTAINER} canvas`);
      const offset = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
      
      this.x = screenPos.x + offset.left;
      this.y = screenPos.y + offset.top;
    }
    
    this.updateMobileDOMPosition();
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
   * ★修正: コンテナではなく「キャンバス要素そのもの」のオフセットを加算する
   */
  applyPositionToElement(element, worldX, worldY) {
    const inputMgr = this.circuitManager.getInputManager();
    const screenPos = inputMgr.getScreenPosition(worldX, worldY);
    const currentScale = inputMgr.viewScale;
    const size = (CONST.PARTS.WIDTH + 10) * currentScale;

    // ★修正点: コンテナ(div)ではなく、実際のキャンバス(canvas)の座標を取得する
    // p5.jsはcanvas要素を生成するので、それを探す
    const canvas = document.querySelector(`#${CONST.DOM_IDS.COMMON.CANVAS_CONTAINER} canvas`);
    // キャンバスが見つからない場合（初期化前など）のガード
    const offset = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };

    // スクリーンの絶対座標 = キャンバスの左上座標 + キャンバス内の相対座標
    element.style.left = `${offset.left + screenPos.x - size / 2}px`;
    element.style.top = `${offset.top + screenPos.y - size / 2}px`;
    
    element.style.width = `${size}px`;
    element.style.height = `${size}px`;
    element.style.fontSize = `${30 * currentScale}px`;
  }

  // --- スマホ用イベントリスナー等は変更なし ---
  setupMobileEventListeners() {
    // ... (元のコードのまま) ...
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
      
      this.updateMobileDOMPosition();
      this.checkSnap();
    });
    
    document.addEventListener('touchend', (e) => {
      this.isDragging = false;
    });
    
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
        this.mobileElement.classList.remove('snapped');
      }
    });
  }
  
  updateMobileDOMPosition() {
      // ... (元のコードのまま) ...
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

  checkSnap() {
    // ... (元のコードのまま、ただしOffset計算だけ念の為ここも修正推奨) ...
    if (!this.circuitManager) return;

    // ★修正推奨: ここもCanvas座標基準にする
    const canvas = document.querySelector(`#${CONST.DOM_IDS.COMMON.CANVAS_CONTAINER} canvas`);
    const offset = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
    
    const canvasX = this.x - offset.left;
    const canvasY = this.y - offset.top;

    const worldPos = this.circuitManager.getWorldPosition(canvasX, canvasY);
    const result = this.circuitManager.getDeletionTarget(worldPos.x, worldPos.y);
    
    if (result) {
      this.snappedTarget = result;
      this.mobileElement.classList.add('snapped');
      
      let targetX, targetY;
      
      if (result.type === 'wire') {
        result.target.isHighlighted = true;
        const w = result.target;
        const start = w.startSocket.getConnectorWorldPosition();
        const end = w.endSocket.getConnectorWorldPosition();
        targetX = (start.x + end.x) / 2;
        targetY = (start.y + end.y) / 2;
      } else {
        const center = result.target.getCenter();
        targetX = center.x;
        targetY = center.y;
      }
      
      const screenPos = this.worldToScreenPosition(targetX, targetY);
      this.x = screenPos.x + offset.left;
      this.y = screenPos.y + offset.top;
      
      this.updateMobileDOMPosition();
    } else {
      this.snappedTarget = null;
      this.mobileElement.classList.remove('snapped');
    }
  }

  worldToScreenPosition(worldX, worldY) {
    return this.circuitManager.getInputManager().getScreenPosition(worldX, worldY);
  }
  
  updateVisibility() {
      // ... (元のコードのまま) ...
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
      this.mobileElement.classList.remove('snapped');
      this.updateMobileDOMPosition();

    } else {
      this.mobileElement.classList.add('hidden');
      this.snappedTarget = null;
    }
  }
}