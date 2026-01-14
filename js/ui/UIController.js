'use strict';

import { CONST } from '../config/constants.js';
import { PartFactory } from '../models/PartFactory.js';
import { deviceDetector } from '../utils/DeviceDetector.js';

/**
 * UIコントローラー
 * ボタンやその他のUI要素の初期化とイベント管理を担当
 */
export class UIController {
  constructor(simulator, storage) {
    this.simulator = simulator;
    this.storage = storage;
    
    // スマホ専用削除カーソルの状態管理
    this.deleteCursor = {
      element: null,
      handle: null,
      isDragging: false,
      x: 0,
      y: 0,
      snappedPart: null
    };
  }

  /**
   * UIの初期化
   * デバイス判定、ボタンラベルの設定とイベントリスナーの登録
   */
  initialize() {
    this.applyDeviceMode();
    this.setupLabels();
    this.setupButtonIcons();
    this.setupEventListeners();
    this.setupDeleteCursor();
  }

  /**
   * デバイスモードの適用
   * デバイス判定を行い、適切なCSSクラスを設定
   */
  applyDeviceMode() {
    const body = document.body;
    deviceDetector.logDeviceInfo();

    if (deviceDetector.isMobile()) {
      console.log("Mobile Mode Activated");
      body.classList.add('mobile-mode');
      body.classList.remove('pc-mode');
    } else {
      console.log("PC Mode Activated");
      body.classList.add('pc-mode');
      body.classList.remove('mobile-mode');
    }
  }

  /**
   * 共通のアクションバインド関数
   * PC用とモバイル用など、複数の要素に対して同じイベントハンドラを登録する
   * @param {string[]} ids - ボタンIDの配列
   * @param {Function} handler - 実行する関数
   */
  bindAction(ids, handler) {
    ids.forEach(id => {
      const elem = document.getElementById(id);
      if (elem) {
        elem.addEventListener('click', handler);
      }
    });
  }

  /**
   * ボタンラベルを定数から設定
   */
setupLabels() {
    // textContent（ボタンの中の文字）ではなく、title（マウスホバー時の説明）に設定する
    // これで「日本語が読めなくても形で見分けられ、迷ったらマウスを乗せれば名前が出る」状態になります
    document.getElementById('btn-power').title = CONST.UI_LABELS.POWER;
    document.getElementById('btn-auto-switch').title = CONST.UI_LABELS.AUTO_SWITCH;
    document.getElementById('btn-inverter').title = CONST.UI_LABELS.INVERTER;
    document.getElementById('btn-button').title = CONST.UI_LABELS.BUTTON;
    document.getElementById('btn-wall-switch').title = CONST.UI_LABELS.WALL_SWITCH;
    document.getElementById('btn-color-light').title = CONST.UI_LABELS.COLOR_LIGHT;
    
    // ★修正: 削除ボタンもテキストを消し、ツールチップのみ設定する
    const deleteBtn = document.getElementById('btn-delete-mode');
    deleteBtn.textContent = ''; // 文字を消す
    deleteBtn.title = CONST.UI_LABELS.DELETE_MODE; // ツールチップを設定

    document.getElementById('btn-save').textContent = CONST.UI_LABELS.SAVE;
    document.getElementById('btn-load').textContent = CONST.UI_LABELS.LOAD;
    document.getElementById('btn-share').textContent = CONST.UI_LABELS.SHARE;

    // スマホ用設定スイッチのラベルも更新
    const mobileSnapLabel = document.querySelector('.mobile-toggle .label-text');
    if (mobileSnapLabel) mobileSnapLabel.textContent = CONST.UI_LABELS.ROTATION_SNAP;
    
    // パーツボタンの文字はCSSで透明にしていますが、念のため空にしておくならここで行います
    const partBtnIds = ['btn-power', 'btn-auto-switch', 'btn-inverter', 'btn-button', 'btn-wall-switch', 'btn-color-light'];
    partBtnIds.forEach(id => {
      const btn = document.getElementById(id);
      if(btn) btn.textContent = '';
    });
  }

  /**
   * 各パーツのアイコンを動的に生成してボタンの背景にする
   * PC用とモバイル用の両方のボタンにアイコンを設定
   */
  setupButtonIcons() {
    // パーツタイプに対して、適用したいボタンIDのリストを定義
    const mapping = [
      { 
        type: CONST.PART_TYPE.POWER, 
        ids: [CONST.DOM_IDS.PC.POWER, CONST.DOM_IDS.MOBILE.POWER]
      },
      { 
        type: CONST.PART_TYPE.AUTO_SWITCH, 
        ids: [CONST.DOM_IDS.PC.AUTO_SWITCH, CONST.DOM_IDS.MOBILE.AUTO_SWITCH]
      },
      { 
        type: CONST.PART_TYPE.INVERTER, 
        ids: [CONST.DOM_IDS.PC.INVERTER, CONST.DOM_IDS.MOBILE.INVERTER]
      },
      { 
        type: CONST.PART_TYPE.BUTTON, 
        ids: [CONST.DOM_IDS.PC.BUTTON, CONST.DOM_IDS.MOBILE.BUTTON]
      },
      { 
        type: CONST.PART_TYPE.WALL_SWITCH, 
        ids: [CONST.DOM_IDS.PC.WALL_SWITCH, CONST.DOM_IDS.MOBILE.WALL_SWITCH]
      },
      { 
        type: CONST.PART_TYPE.COLOR_LIGHT, 
        ids: [CONST.DOM_IDS.PC.COLOR_LIGHT, CONST.DOM_IDS.MOBILE.COLOR_LIGHT]
      }
    ];

    // p5.jsの描画状態を保存
    push();
    
    // アイコン生成用にキャンバスを一時的に使用
    // （ユーザーには一瞬すぎて見えませんが、メインキャンバスを使って絵を作ります）
    
    mapping.forEach(item => {
      // 1. 背景をクリア
      // background(CONST.COLORS.BACKGROUND);
      clear();
      
      // 2. ダミーのパーツを生成
      const dummyPart = PartFactory.create(item.type, -1, 0, 0);
      
      if (dummyPart) {

        // 3. 画面中央に移動
        translate(width / 2, height / 2);
        
        // ソケットの描画
        for (let socket of dummyPart.sockets) {
            // ソケットも通電色（青）にして目立たせる
            socket.isPowered = true;
            
            // 通常の描画処理を呼び出す（これで基部の四角形が描かれます）
            socket.draw();

            // 【オプション】接続ピン（三角マーク）も常に表示したい場合
            // 通常はマウスホバー時しか出ないので、アイコン用に無理やり描画する処理を追加
            // （お好みで、ここが無くて基部だけでも十分アイコンとして成立します）
            push();
            const pos = socket.getConnectorWorldPosition();
            // worldToLocalでローカル座標に戻す計算が必要ですが、
            // 簡易的にソケットの位置から少しずらすだけで描画してみます
            const connectorSize = CONST.PARTS.CONNECTOR_RADIUS;
            
            fill(CONST.COLORS.WIRE_ON); // 青色
            noStroke();
            
            // ソケットの方向に応じて丸を描いて「接続点」を表現
            let cx = socket.localX;
            let cy = socket.localY;
            const offset = CONST.PARTS.CONNECTOR_HEIGHT;

            if (socket.direction === 'left') cx -= offset;
            if (socket.direction === 'right') cx += offset;
            if (socket.direction === 'bottom') cy += offset;
            
            circle(cx, cy, connectorSize * 2);
            pop();
        }

        // 本体の描画、アイコン用に明るい色（ON_STATE）で描画
        dummyPart.drawShape(CONST.COLORS.ON_STATE);
        
        // 4. 画像として切り出し
        let scale = 1.4; // デフォルトの倍率
        switch (item.type) {
          case CONST.PART_TYPE.COLOR_LIGHT:
            scale = 1.8; // ライトは縦長なので広めに切り取る
            break;
        }
        const size = CONST.PARTS.WIDTH * scale;
        const img = get(width / 2 - size / 2, height / 2 - size / 2, size, size);
        
        // 5. 定義されたすべてのIDに対して背景画像を設定
        const imgData = img.canvas.toDataURL();
        item.ids.forEach(btnId => {
          const btn = document.getElementById(btnId);
          if (btn) {
            btn.style.backgroundImage = `url(${imgData})`;
          }
        });
        
        // 座標を戻す
        translate(-width / 2, -height / 2);
      }
    });

    // ★追記: ループの後に、削除ボタン用のアイコン生成処理を追加
    clear();
    translate(width / 2, height / 2);

    // ゴミ箱アイコンを描画
    // 色設定: ボタン背景が赤になるので、アイコンは白で見やすくする
    stroke(255);
    strokeWeight(3);
    noFill();
    
    // 1. ゴミ箱の本体
    // 少し台形っぽくするとゴミ箱らしく見える
    beginShape();
    vertex(-12, -8);
    vertex(12, -8);
    vertex(10, 18);
    vertex(-10, 18);
    endShape(CLOSE);
    
    // 2. 蓋
    rectMode(CENTER);
    rect(0, -12, 30, 4); // 蓋の板
    rect(0, -16, 8, 4);  // 蓋の取っ手

    // 3. 本体の縦縞（ディテール）
    line(-5, -2, -4, 12);
    line(0, -2, 0, 12);
    line(5, -2, 4, 12);

    // 画像として切り出し
    const trashSize = 60; // 少し大きめに切り取る
    const trashImg = get(width / 2 - trashSize / 2, height / 2 - trashSize / 2, trashSize, trashSize);
    
    const deleteBtn = document.getElementById('btn-delete-mode');
    if (deleteBtn) {
      deleteBtn.style.backgroundImage = `url(${trashImg.canvas.toDataURL()})`;
    }

    const mobileDeleteBtn = document.getElementById('btn-mobile-delete');
    if (mobileDeleteBtn) {
      mobileDeleteBtn.style.backgroundImage = `url(${trashImg.canvas.toDataURL()})`;
    }

    // 座標リセット
    translate(-width / 2, -height / 2);

    pop();
    
    // 最後に画面を綺麗にクリアしておく（次のdrawループで上書きされるので必須ではないが念のため）
    background(CONST.COLORS.BACKGROUND);
  }

  /**
   * イベントリスナーの登録
   * PC用とモバイル用のイベントを統合的に管理
   */
  setupEventListeners() {
    // 部品追加ボタン（PC用とモバイル用を一括登録）
    this.bindAction(
      [CONST.DOM_IDS.PC.POWER, CONST.DOM_IDS.MOBILE.POWER],
      () => this.handleAddPart(CONST.PART_TYPE.POWER)
    );
    
    this.bindAction(
      [CONST.DOM_IDS.PC.AUTO_SWITCH, CONST.DOM_IDS.MOBILE.AUTO_SWITCH],
      () => this.handleAddPart(CONST.PART_TYPE.AUTO_SWITCH)
    );
    
    this.bindAction(
      [CONST.DOM_IDS.PC.INVERTER, CONST.DOM_IDS.MOBILE.INVERTER],
      () => this.handleAddPart(CONST.PART_TYPE.INVERTER)
    );
    
    this.bindAction(
      [CONST.DOM_IDS.PC.BUTTON, CONST.DOM_IDS.MOBILE.BUTTON],
      () => this.handleAddPart(CONST.PART_TYPE.BUTTON)
    );
    
    this.bindAction(
      [CONST.DOM_IDS.PC.WALL_SWITCH, CONST.DOM_IDS.MOBILE.WALL_SWITCH],
      () => this.handleAddPart(CONST.PART_TYPE.WALL_SWITCH)
    );
    
    this.bindAction(
      [CONST.DOM_IDS.PC.COLOR_LIGHT, CONST.DOM_IDS.MOBILE.COLOR_LIGHT],
      () => this.handleAddPart(CONST.PART_TYPE.COLOR_LIGHT)
    );
    
    // 削除モードボタン（PC用とモバイル用）
    this.bindAction(
      [CONST.DOM_IDS.PC.DELETE_MODE, CONST.DOM_IDS.MOBILE.FAB_DELETE],
      () => this.handleToggleDeleteMode()
    );
    
    // ファイル操作ボタン（PC用とモバイル用）
    this.bindAction(
      [CONST.DOM_IDS.PC.SAVE, CONST.DOM_IDS.MOBILE.SAVE],
      () => this.handleSave()
    );
    
    this.bindAction(
      [CONST.DOM_IDS.PC.LOAD, CONST.DOM_IDS.MOBILE.LOAD],
      () => this.handleLoad()
    );
    
    this.bindAction(
      [CONST.DOM_IDS.PC.SHARE, CONST.DOM_IDS.MOBILE.SHARE],
      () => this.handleShare()
    );
    
    // 90度スナップチェックボックス（PC用とモバイル用で同期）
    const pcCheckbox = document.getElementById(CONST.DOM_IDS.PC.ROTATION_SNAP);
    const mobileCheckbox = document.getElementById(CONST.DOM_IDS.MOBILE.ROTATION_SNAP);
    
    if (pcCheckbox) {
      pcCheckbox.addEventListener('change', (event) => {
        this.simulator.setRotationSnap(event.target.checked);
        if (mobileCheckbox) mobileCheckbox.checked = event.target.checked;
      });
    }
    
    if (mobileCheckbox) {
      mobileCheckbox.addEventListener('change', (event) => {
        this.simulator.setRotationSnap(event.target.checked);
        if (pcCheckbox) pcCheckbox.checked = event.target.checked;
      });
    }
    
    // モバイル固有のUI操作
    this.setupMobileInteractions();
  }

  /**
   * スマホ専用: 削除カーソルの初期化
   */
  setupDeleteCursor() {
    if (!deviceDetector.isMobile()) return;
    
    this.deleteCursor.element = document.getElementById('mobile-delete-cursor');
    this.deleteCursor.handle = document.querySelector('.delete-cursor-handle');
    
    if (!this.deleteCursor.element || !this.deleteCursor.handle) return;
    
    // 初期位置を画面中央に設定
    this.deleteCursor.x = window.innerWidth / 2;
    this.deleteCursor.y = window.innerHeight / 2;
    this.updateDeleteCursorPosition();
    
    // ハンドルのドラッグイベント
    this.deleteCursor.handle.addEventListener('touchstart', (e) => {
      if (!this.simulator.getDeleteMode()) return;
      
      e.preventDefault();
      e.stopPropagation();
      this.deleteCursor.isDragging = true;
      
      const touch = e.touches[0];
      this.deleteCursor.startX = touch.clientX - this.deleteCursor.x;
      this.deleteCursor.startY = touch.clientY - this.deleteCursor.y;
    });
    
    document.addEventListener('touchmove', (e) => {
      if (!this.deleteCursor.isDragging) return;
      
      e.preventDefault();
      const touch = e.touches[0];
      this.deleteCursor.x = touch.clientX - this.deleteCursor.startX;
      this.deleteCursor.y = touch.clientY - this.deleteCursor.startY;
      
      this.updateDeleteCursorPosition();
      this.checkDeleteCursorSnap();
    });
    
    document.addEventListener('touchend', (e) => {
      if (!this.deleteCursor.isDragging) return;
      
      this.deleteCursor.isDragging = false;
    });
    
    // 削除カーソルのタップで削除実行
    // 削除カーソルのタップで削除実行
    this.deleteCursor.element.addEventListener('click', (e) => {
      if (!this.simulator.getDeleteMode()) return;
      if (this.deleteCursor.isDragging) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // ★修正: snappedTarget ( {type, target} ) を見て処理を分ける
      const snap = this.deleteCursor.snappedTarget;
      
      if (snap) {
        if (snap.type === 'wire') {
          this.simulator.deleteWire(snap.target);
        } else if (snap.type === 'part') {
          this.simulator.deletePart(snap.target);
        }
        
        // 削除後の後始末
        this.deleteCursor.snappedTarget = null;
        this.deleteCursor.element.classList.remove('snapped');
      }
    });
  }
  
  /**
   * 削除カーソルの位置とサイズを更新
   */
  updateDeleteCursorPosition() {
    if (!this.deleteCursor.element) return;
    
    // 1. 現在のズーム倍率を取得
    const scale = this.simulator.viewScale;
    
    // 2. カーソル枠のサイズを計算
    const baseSize = CONST.PARTS.WIDTH + 20; 
    const currentSize = baseSize * scale;
    
    // 3. HTML要素に適用
    const frame = this.deleteCursor.element.querySelector('.delete-cursor-frame');
    if (frame) {
      frame.style.width = `${currentSize}px`;
      frame.style.height = `${currentSize}px`;

      // 中の「×」マークの文字サイズも合わせる
      const xMark = this.deleteCursor.element.querySelector('.delete-cursor-x');
      if (xMark) {
        xMark.style.fontSize = `${36 * scale}px`;
      }
    }
    
    // 4. 位置合わせ（★ここが修正ポイント）
    // ハンドルの高さ（CSSで50px）
    const handleHeight = 50;
    
    // コンテナ全体の高さは「枠」と「ハンドル」の大きい方になる
    const containerHeight = Math.max(currentSize, handleHeight);
    
    // 横位置：枠のサイズ基準で合わせる（左端が揃っているため）
    this.deleteCursor.element.style.left = `${this.deleteCursor.x - currentSize / 2}px`;
    
    // 縦位置：コンテナ全体の高さ基準で合わせる（垂直中央揃えされているため）
    this.deleteCursor.element.style.top = `${this.deleteCursor.y - containerHeight / 2}px`;
  }
  
  /**
   * 削除カーソルのスナップ判定
   */
  checkDeleteCursorSnap() {
    if (!this.simulator) return;

    // キャンバスのオフセット取得（前回の修正分）
    const container = document.getElementById(CONST.DOM_IDS.COMMON.CANVAS_CONTAINER);
    const offset = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
    
    const canvasX = this.deleteCursor.x - offset.left;
    const canvasY = this.deleteCursor.y - offset.top;

    // ワールド座標に変換
    const worldPos = this.simulator.getWorldPosition(canvasX, canvasY);
    
    // ★修正: 共通メソッドを使ってターゲットを取得
    const result = this.simulator.getDeletionTarget(worldPos.x, worldPos.y);
    
    if (result) {
      // ターゲットが見つかったら保存（削除実行時に使う）
      this.deleteCursor.snappedTarget = result;
      this.deleteCursor.element.classList.add('snapped');
      
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
      this.deleteCursor.x = screenPos.x + offset.left;
      this.deleteCursor.y = screenPos.y + offset.top;
      
      this.updateDeleteCursorPosition();
    } else {
      // 何も見つからない時
      this.deleteCursor.snappedTarget = null;
      this.deleteCursor.element.classList.remove('snapped');
    }
  }
  
  /**
   * ワールド座標をスクリーン座標に変換
   */
  worldToScreenPosition(worldX, worldY) {
    return {
      x: worldX * this.simulator.viewScale + this.simulator.viewOffsetX,
      y: worldY * this.simulator.viewScale + this.simulator.viewOffsetY
    };
  }
  
  /**
   * 削除カーソルの表示/非表示を切り替え
   */
  updateDeleteCursorVisibility() {
    if (!deviceDetector.isMobile() || !this.deleteCursor.element) return;
    
    const isDeleteMode = this.simulator.getDeleteMode();
    
    if (isDeleteMode) {
      this.deleteCursor.element.classList.remove('hidden');
      
      // ★修正: 画面中央ではなく、削除ボタンの少し上にリセット
      const deleteBtn = document.getElementById(CONST.DOM_IDS.MOBILE.FAB_DELETE);
      
      if (deleteBtn) {
        const rect = deleteBtn.getBoundingClientRect();
        
        // X座標: ボタンの水平方向の中心
        this.deleteCursor.x = rect.left + rect.width / 2;
        
        // Y座標: ボタンの上端から少し上（例: 120px上）に配置
        // ※指でボタンが隠れないように、少し余裕を持って上に離します
        this.deleteCursor.y = rect.top - 60;
      } else {
        // 万が一ボタンが見つからない場合は、今まで通り画面中央へ
        this.deleteCursor.x = window.innerWidth / 2;
        this.deleteCursor.y = window.innerHeight / 2;
      }
      
      // スナップ状態をリセット
      this.deleteCursor.snappedTarget = null;
      this.deleteCursor.element.classList.remove('snapped');
      this.updateDeleteCursorPosition();

    } else {
      this.deleteCursor.element.classList.add('hidden');
      this.deleteCursor.snappedTarget = null;
    }
  }

  /**
   * モバイル固有のUI操作
   * FABとメニューの開閉など
   */
  setupMobileInteractions() {
    // 追加FAB -> 吹き出しメニュー
    const fabAdd = document.getElementById(CONST.DOM_IDS.MOBILE.FAB_ADD);
    const partsBalloon = document.getElementById('mobile-parts-balloon');
    
    if (fabAdd && partsBalloon) {
      // 追加ボタンをクリックで吹き出しをトグル
      fabAdd.addEventListener('click', (e) => {
        e.stopPropagation(); // イベントの伝播を防ぐ
        
        // ★追加: もし削除モード中なら、ここで解除してしまう
        if (this.simulator.getDeleteMode()) {
          this.handleToggleDeleteMode();
        }

        partsBalloon.classList.toggle('hidden');
        
        // ★バルーンの状態に応じてボタンのテキストを変更
        if (partsBalloon.classList.contains('hidden')) {
          fabAdd.textContent = '＋';
        } else {
          fabAdd.textContent = '×';
        }
      });
      
      // キャンバスをタップしたら吹き出しを閉じる
      const canvasContainer = document.getElementById(CONST.DOM_IDS.COMMON.CANVAS_CONTAINER);
      if (canvasContainer) {
        canvasContainer.addEventListener('click', (e) => {
          if (!partsBalloon.classList.contains('hidden')) {
            partsBalloon.classList.add('hidden');
            fabAdd.textContent = '＋'; // ボタンのテキストを戻す
          }
        });
      }
      
      // 吹き出し外をタップしても閉じる
      document.addEventListener('click', (e) => {
        if (!partsBalloon.classList.contains('hidden') && 
            !partsBalloon.contains(e.target) && 
            e.target !== fabAdd) {
          partsBalloon.classList.add('hidden');
          fabAdd.textContent = '＋'; // ボタンのテキストを戻す
        }
      });
    }

    // ハンバーガーメニュー
    const btnMenu = document.getElementById(CONST.DOM_IDS.MOBILE.MENU_OPEN);
    const menuOverlay = document.getElementById(CONST.DOM_IDS.MOBILE.MENU_OVERLAY);
    const btnMenuClose = document.getElementById(CONST.DOM_IDS.MOBILE.MENU_CLOSE);
    
    if (btnMenu && menuOverlay && btnMenuClose) {
      const toggleMenu = () => menuOverlay.classList.toggle('hidden');
      
      btnMenu.addEventListener('click', toggleMenu);
      btnMenuClose.addEventListener('click', toggleMenu);
      menuOverlay.addEventListener('click', (e) => {
        if (e.target === menuOverlay) toggleMenu();
      });
    }
  }

  /**
   * 部品追加処理
   * @param {string} type - 部品タイプ
   */
  handleAddPart(type) {
    // ★追加: もし削除モードがONなら、強制的にOFFにする
    if (this.simulator.getDeleteMode()) {
      this.handleToggleDeleteMode();
    }
    this.simulator.createPart(type);
    this.closeBottomSheet();
  }

  /**
   * 削除モード切り替え処理
   */
  handleToggleDeleteMode() {
    this.simulator.toggleDeleteMode();
    this.updateDeleteButtonState();
    this.updateDeleteCursorVisibility();
  }

  /**
   * 保存処理
   */
  handleSave() {
    this.storage.saveToFile();
    this.closeMobileMenu();
  }

  /**
   * 読み込み処理
   */
  handleLoad() {
    this.storage.loadFromFile();
    this.closeMobileMenu();
  }

  /**
   * シェア処理
   */
  handleShare() {
    this.storage.shareToUrl();
    this.closeMobileMenu();
  }

  /**
   * パーツ選択メニュー（吹き出し）を閉じる
   */
  closeBottomSheet() {
    const partsBalloon = document.getElementById('mobile-parts-balloon');
    const fabAdd = document.getElementById(CONST.DOM_IDS.MOBILE.FAB_ADD);
    
    if (partsBalloon) {
      partsBalloon.classList.add('hidden');
    }
    
    // バルーンを閉じたらボタンのテキストを戻す
    if (fabAdd) {
      fabAdd.textContent = '＋';
    }
  }

  /**
   * モバイルメニューを閉じる
   */
  closeMobileMenu() {
    const menuOverlay = document.getElementById(CONST.DOM_IDS.MOBILE.MENU_OVERLAY);
    if (menuOverlay) {
      menuOverlay.classList.add('hidden');
    }
  }

  /**
   * 削除モードボタンの見た目を更新
   * PC用とモバイル用の両方を更新
   */
  updateDeleteButtonState() {
    const isDeleteMode = this.simulator.getDeleteMode();
    
    // PC用ボタン
    const pcBtn = document.getElementById(CONST.DOM_IDS.PC.DELETE_MODE);
    if (pcBtn) {
      if (isDeleteMode) {
        pcBtn.classList.add('active');
      } else {
        pcBtn.classList.remove('active');
      }
    }
    
    // モバイル用ボタン
    const mobileBtn = document.getElementById(CONST.DOM_IDS.MOBILE.FAB_DELETE);
    if (mobileBtn) {
      // フォーカスを外してから状態を更新（モバイルでの:focus状態を解除）
      mobileBtn.blur();
      
      if (isDeleteMode) {
        mobileBtn.classList.add('active');
      } else {
        mobileBtn.classList.remove('active');
      }
    }
  }

  /**
   * 毎フレーム呼ばれる描画更新処理
   */
  update() {
    // モバイルかつ削除モードの時だけ処理
    if (deviceDetector.isMobile() && this.simulator.getDeleteMode()) {
      
      // もし何かにスナップ中なら、ターゲットの新しい位置にカーソル座標を追従させる
      // (これをやると、ズームやパンで回路が動いた時にカーソルも一緒に動いてくれます)
      if (this.deleteCursor.snappedTarget) {
        const t = this.deleteCursor.snappedTarget;
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
        
        // ヘッダーなどのオフセットを加算（前回の修正と同じロジック）
        const container = document.getElementById(CONST.DOM_IDS.COMMON.CANVAS_CONTAINER);
        const offset = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
        
        this.deleteCursor.x = screenPos.x + offset.left;
        this.deleteCursor.y = screenPos.y + offset.top;
      }
      
      // サイズと位置をHTMLに反映（ここでズーム倍率に応じたサイズ変更が行われる）
      this.updateDeleteCursorPosition();
    }
  }
}
