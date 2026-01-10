'use strict';

import { CONST } from '../config/constants.js';

/**
 * UIコントローラー
 * ボタンやその他のUI要素の初期化とイベント管理を担当
 */
export class UIController {
  constructor(simulator) {
    this.simulator = simulator;
  }

  /**
   * UIの初期化
   * ボタンラベルの設定とイベントリスナーの登録
   */
  initialize() {
    this.setupLabels();
    this.setupEventListeners();
  }

  /**
   * ボタンラベルを定数から設定
   */
  setupLabels() {
    document.getElementById('btn-power').textContent = CONST.UI_LABELS.POWER;
    document.getElementById('btn-auto-switch').textContent = CONST.UI_LABELS.AUTO_SWITCH;
    document.getElementById('btn-inverter').textContent = CONST.UI_LABELS.INVERTER;
    document.getElementById('btn-button').textContent = CONST.UI_LABELS.BUTTON;
    document.getElementById('btn-wall-switch').textContent = CONST.UI_LABELS.WALL_SWITCH;
    document.getElementById('btn-color-light').textContent = CONST.UI_LABELS.COLOR_LIGHT;
    document.getElementById('btn-delete-mode').textContent = CONST.UI_LABELS.DELETE_MODE;
    document.getElementById('btn-save').textContent = CONST.UI_LABELS.SAVE;
    document.getElementById('btn-load').textContent = CONST.UI_LABELS.LOAD;
  }

  /**
   * イベントリスナーの登録
   */
  setupEventListeners() {
    // 部品追加ボタン
    document.getElementById('btn-power').addEventListener('click', () => {
      this.simulator.createPart(CONST.PART_TYPE.POWER);
    });
    
    document.getElementById('btn-auto-switch').addEventListener('click', () => {
      this.simulator.createPart(CONST.PART_TYPE.AUTO_SWITCH);
    });
    
    document.getElementById('btn-inverter').addEventListener('click', () => {
      this.simulator.createPart(CONST.PART_TYPE.INVERTER);
    });
    
    document.getElementById('btn-button').addEventListener('click', () => {
      this.simulator.createPart(CONST.PART_TYPE.BUTTON);
    });
    
    document.getElementById('btn-wall-switch').addEventListener('click', () => {
      this.simulator.createPart(CONST.PART_TYPE.WALL_SWITCH);
    });
    
    document.getElementById('btn-color-light').addEventListener('click', () => {
      this.simulator.createPart(CONST.PART_TYPE.COLOR_LIGHT);
    });
    
    // 削除モードボタン
    document.getElementById('btn-delete-mode').addEventListener('click', () => {
      this.simulator.toggleDeleteMode();
      this.updateDeleteButtonState();
    });
    
    // 90度スナップチェックボックス
    document.getElementById('rotation-snap-checkbox').addEventListener('change', (event) => {
      this.simulator.setRotationSnap(event.target.checked);
    });
    
    // ファイル操作ボタン
    document.getElementById('btn-save').addEventListener('click', () => {
      this.simulator.save();
    });
    
    document.getElementById('btn-load').addEventListener('click', () => {
      this.simulator.load();
    });
  }

  /**
   * 削除モードボタンの見た目を更新
   */
  updateDeleteButtonState() {
    const btn = document.getElementById('btn-delete-mode');
    if (this.simulator.getDeleteMode()) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
}
