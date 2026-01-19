'use strict';

import { CONST } from '../config/constants.js';
import { PartFactory } from '../models/PartFactory.js';
import { deviceDetector } from '../utils/DeviceDetector.js';
import { DeleteCursorOverlay } from './DeleteCursorOverlay.js';

/**
 * UIコントローラー
 * ボタンやその他のUI要素の初期化とイベント管理を担当
 */
export class UIController {
  constructor(simulator, storage) {
    this.simulator = simulator;
    this.storage = storage;
    
    // スマホ専用削除カーソルのオーバーレイ
    this.deleteCursorOverlay = null;
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
    
    // 削除カーソルオーバーレイの初期化（デバイスに関係なく初期化）
    this.deleteCursorOverlay = new DeleteCursorOverlay(this.simulator);
    this.deleteCursorOverlay.initialize();

    // ★追加: PC用操作のセットアップ
    if (deviceDetector.isPC()) {
      this.setupPCViewControls();
    }
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

    document.getElementById('btn-reset').textContent = 'Reset';
    document.getElementById('btn-save').textContent = CONST.UI_LABELS.SAVE;
    document.getElementById('btn-load').textContent = CONST.UI_LABELS.LOAD;
    document.getElementById('btn-share').textContent = CONST.UI_LABELS.SHARE;

    // スマホ用設定スイッチのラベルも更新
    const mobileSnapLabel = document.querySelector('#mobile-rotation-snap-checkbox + .slider + .label-text');
    if (mobileSnapLabel) mobileSnapLabel.textContent = CONST.UI_LABELS.ROTATION_SNAP;

    const mobileGridLabel = document.querySelector('#mobile-grid-visible-checkbox + .slider + .label-text');
    if (mobileGridLabel) mobileGridLabel.textContent = CONST.UI_LABELS.GRID_VISIBLE;

    // PC用グリッドラベル
    const pcGridLabel = document.getElementById('label-grid-visible');
    if (pcGridLabel) pcGridLabel.textContent = CONST.UI_LABELS.GRID_VISIBLE;
    
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
    // 部品追加ボタン（data属性を使った一括登録）
    document.querySelectorAll('.btn-add-part').forEach(btn => {
      btn.addEventListener('click', () => {
        const partType = btn.dataset.partType;
        if (partType) {
          // ★修正: スマホの場合は座標を渡さず、画面中央配置のロジック（handleAddPart内の分岐）に任せる
          if (deviceDetector.isMobile()) {
            this.handleAddPart(CONST.PART_TYPE[partType]);
            return;
          }

          // --- 以下、PC用（ボタン直下に生成）の処理 ---
          
          // ボタンの位置情報を取得
          const btnRect = btn.getBoundingClientRect();
          
          // キャンバスの位置を取得して補正する
          const canvas = document.querySelector(`#${CONST.DOM_IDS.COMMON.CANVAS_CONTAINER} canvas`);
          let canvasRect = { left: 0, top: 0 };
          if (canvas) {
            canvasRect = canvas.getBoundingClientRect();
          }

          // ボタンの水平中心（キャンバス基準の座標に変換）
          const screenX = (btnRect.left + btnRect.width / 2) - canvasRect.left;
          
          // ボタンの下側 + 余白（キャンバス基準の座標に変換）
          const screenY = (btnRect.bottom + 80) - canvasRect.top;
          
          this.handleAddPart(CONST.PART_TYPE[partType], screenX, screenY);
        }
      });
    });
    
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
    
    // リセットボタン（PC用とモバイル用）
    this.bindAction(
      ['btn-reset', 'btn-mobile-reset'],
      () => this.handleReset()
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

    // グリッド表示チェックボックス（PC用とモバイル用で同期）
    const pcGridCheck = document.getElementById(CONST.DOM_IDS.PC.GRID_VISIBLE);
    const mobileGridCheck = document.getElementById(CONST.DOM_IDS.MOBILE.GRID_VISIBLE);

    if (pcGridCheck) {
      pcGridCheck.addEventListener('change', (event) => {
        this.simulator.setGridVisible(event.target.checked);
        if (mobileGridCheck) mobileGridCheck.checked = event.target.checked;
      });
    }

    if (mobileGridCheck) {
      mobileGridCheck.addEventListener('change', (event) => {
        this.simulator.setGridVisible(event.target.checked);
        if (pcGridCheck) pcGridCheck.checked = event.target.checked;
      });
    }
    
    // モバイル固有のUI操作
    this.setupMobileInteractions();
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
   * @param {number} [screenX] - 生成位置のスクリーンX座標（指定がなければ自動）
   * @param {number} [screenY] - 生成位置のスクリーンY座標（指定がなければ自動）
   */
  handleAddPart(type, screenX, screenY) {
    // もし削除モードがONなら、強制的にOFFにする
    if (this.simulator.getDeleteMode()) {
      this.handleToggleDeleteMode();
    }
    
    let x, y;
    
    // スクリーン座標が指定されている場合（PCヘッダーボタンなど）
    if (screenX !== undefined && screenY !== undefined) {
      // スクリーン座標をワールド座標に変換
      const worldPos = this.simulator.getWorldPosition(screenX, screenY);
      x = worldPos.x;
      y = worldPos.y;
      
      // 連続で押した時に完全に重なると分かりにくいので、少しだけランダムにずらす
      x += (Math.random() - 0.5) * 20;
      y += (Math.random() - 0.5) * 20;
      
    } else if (deviceDetector.isMobile()) {
      // スマホUIの場合は画面中央の固定位置に配置
      // 画面中央の座標（スクリーン座標）
      const cx = width / 2;
      const cy = height / 2;
      
      // スクリーン座標をワールド座標に変換
      const worldPos = this.simulator.getWorldPosition(cx, cy);
      x = worldPos.x;
      y = worldPos.y;
      
      console.log(`スマホモード: パーツを画面中央(${cx}, ${cy})に配置 → ワールド座標(${x.toFixed(1)}, ${y.toFixed(1)})`);
    } else {
      // PC版で座標指定がない場合のフォールバック（画面中央へ）
      const worldPos = this.simulator.getWorldPosition(width / 2, height / 2);
      x = worldPos.x + (Math.random() - 0.5) * 50;
      y = worldPos.y + (Math.random() - 0.5) * 50;
    }
    
    this.simulator.createPart(type, x, y);
  }

  /**
   * 削除モード切り替え処理
   */
  handleToggleDeleteMode() {
    this.simulator.toggleDeleteMode();
    this.updateDeleteButtonState();
    
    // モバイルの場合は削除カーソルの表示/非表示を切り替え
    if (this.deleteCursorOverlay) {
      this.deleteCursorOverlay.updateVisibility();
    }
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
   * リセット処理（全パーツとワイヤーを削除）
   */
  handleReset() {
    // 確認ダイアログを表示
    const confirmed = confirm(CONST.MESSAGES.CONFIRM_RESET);
    
    if (confirmed) {
      // CircuitManagerのresetAllメソッドを呼び出し
      this.simulator.resetAll();
      console.log('回路をリセットしました');
    }
    
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
    // 削除カーソルオーバーレイの更新（PC/スマホの判断は内部で行われる）
    if (this.deleteCursorOverlay) {
      this.deleteCursorOverlay.update();
    }
  }

  /**
   * ★追加: PC用のズーム・パン操作設定
   */
  setupPCViewControls() {
    const inputMgr = this.simulator.getInputManager();
    const slider = document.getElementById('zoom-slider');
    const valueLabel = document.getElementById('zoom-value');
    const container = document.getElementById(CONST.DOM_IDS.COMMON.CANVAS_CONTAINER);

    // 1. スライダーによるズーム
    if (slider && valueLabel) {
      slider.addEventListener('input', (e) => {
        const newScale = parseFloat(e.target.value);
        
        // ★修正: スライダー操作時は「画面中央」を基準にズーム
        // p5.jsのグローバル変数 width, height を使用
        inputMgr.setZoom(newScale, width / 2, height / 2);
        
        // 表示更新
        valueLabel.textContent = `${Math.round(newScale * 100)}%`;
      });
    }

    // 2. マウスホイールによるズーム（パンはドラッグで行うため、ホイールはズーム専用）
    if (container) {
      container.addEventListener('wheel', (e) => {
        e.preventDefault(); // ブラウザ標準のスクロールを無効化

        const ZOOM_SPEED = 0.001;
        const currentScale = inputMgr.viewScale;
        const delta = -e.deltaY * ZOOM_SPEED * currentScale; // 現在のスケールに比例させる
        let newScale = currentScale + delta;
        
        // スライダーと同期
        if (slider) {
          newScale = Math.max(0.2, Math.min(2.0, newScale));
          slider.value = newScale;
          valueLabel.textContent = `${Math.round(newScale * 100)}%`;
        }
        
        // ★修正: ホイール操作時は「マウス位置」を基準にズーム
        inputMgr.setZoom(newScale, mouseX, mouseY);
      }, { passive: false });
    }
  }
}
