'use strict';

// 1. 言語に関係ない共通設定（色、サイズ、部品タイプなど）
const COMMON_CONST = {
  // 部品タイプの定義
  PART_TYPE: {
    POWER: 'POWER',
    AUTO_SWITCH: 'AUTO_SWITCH',
    INVERTER: 'INVERTER',
    BUTTON: 'BUTTON',
    WALL_SWITCH: 'WALL_SWITCH',
    COLOR_LIGHT: 'COLOR_LIGHT',
    JOINT: 'JOINT'
  },

  // 色の設定
  COLORS: {
    BACKGROUND: [30, 30, 30],
    TEXT: '#eeeeee',
    HEADER_BG: '#333333',
    WIRE_ON: [0, 128, 255],
    WIRE_TEMP: [255, 50, 50],
    ON_STATE: [0, 128, 255],
    OFF_STATE: [255, 50, 50]
  },
  
  // 部品の設定
  PARTS: (() => {
    const WIDTH = 40;
    return {
      WIDTH: WIDTH,
      HEIGHT: WIDTH,
      RADIUS: WIDTH * 0.2,
      STROKE_WEIGHT: WIDTH * 0.1,
      SOCKET_HEIGHT: WIDTH * 0.15,
      SOCKET_WIDTH: WIDTH * 0.4,
      SOCKET_HIT_RADIUS: WIDTH * 0.3,
      DRAG_OFFSET: WIDTH * 0.25, 
      CONNECTOR_HEIGHT: WIDTH * 0.6,
      CONNECTOR_RADIUS: WIDTH * 0.1,
      ROTATION_HANDLE_DISTANCE: WIDTH * 1.2,
      ROTATION_HANDLE_RADIUS: WIDTH * 0.3,
      ROTATION_HANDLE_HIT_RADIUS: WIDTH * 0.4,
      JOINT_RADIUS: 8,
      JOINT_HIT_RADIUS: 15
    };
  })(),
  
  // ワイヤーの設定
  WIRE: {
    STROKE_WEIGHT: 3,
    TEMP_ALPHA: 150
  },
  
  // ボタンの設定
  BUTTON: {
    ON_DURATION: 1000
  },
  
  // UI要素のラベル（ここは今回は日本語のまま固定）
  UI_LABELS: {
    POWER: 'Power',
    AUTO_SWITCH: 'Auto Switch',
    INVERTER: 'Inverter',
    BUTTON: 'Button',
    WALL_SWITCH: 'Wall Switch',
    COLOR_LIGHT: 'Color Light',
    SAVE: 'Save',
    LOAD: 'Load',
    SHARE: 'Share',
    DELETE_MODE: 'Delete Mode',
    ROTATION_SNAP: 'Rotation Snap',
    GRID_VISIBLE: 'Show Grid'
  },

  // グリッドの設定
  GRID: {
    SIZE: 44,              // グリッドの間隔（パーツの幅の半分）
    COLOR: [50, 50, 50],   // 線の色（背景より少し明るく）
    STROKE_WEIGHT: 1       // 線の太さ
  },
  
  // 削除モードの設定
  DELETE_MODE: {
    HIGHLIGHT_COLOR: [255, 0, 0],
    HIGHLIGHT_STROKE_WEIGHT: 4,
    SNAP_DISTANCE_MULTIPLIER: 1.0,
    BUTTON_ACTIVE_COLOR: [255, 50, 50],
    BUTTON_INACTIVE_COLOR: [100, 100, 100]
  },

  // DOM要素のID定数
  DOM_IDS: {
    // PC用ボタン
    PC: {
      POWER: 'btn-power',
      AUTO_SWITCH: 'btn-auto-switch',
      INVERTER: 'btn-inverter',
      BUTTON: 'btn-button',
      WALL_SWITCH: 'btn-wall-switch',
      COLOR_LIGHT: 'btn-color-light',
      DELETE_MODE: 'btn-delete-mode',
      SAVE: 'btn-save',
      LOAD: 'btn-load',
      SHARE: 'btn-share',
      ROTATION_SNAP: 'rotation-snap-checkbox',
      GRID_VISIBLE: 'grid-visible-checkbox'
    },
    // モバイル用ボタン
    MOBILE: {
      FAB_ADD: 'btn-mobile-add',
      FAB_DELETE: 'btn-mobile-delete',
      MENU_OPEN: 'btn-mobile-menu',
      MENU_CLOSE: 'btn-menu-close',
      MENU_OVERLAY: 'mobile-menu-overlay',
      BOTTOM_SHEET: 'mobile-bottom-sheet',
      POWER: 'btn-mobile-power',
      AUTO_SWITCH: 'btn-mobile-auto-switch',
      INVERTER: 'btn-mobile-inverter',
      BUTTON: 'btn-mobile-button',
      WALL_SWITCH: 'btn-mobile-wall-switch',
      COLOR_LIGHT: 'btn-mobile-color-light',
      SAVE: 'btn-mobile-save',
      LOAD: 'btn-mobile-load',
      SHARE: 'btn-mobile-share',
      ROTATION_SNAP: 'mobile-rotation-snap-checkbox',
      GRID_VISIBLE: 'mobile-grid-visible-checkbox'
    },
    // 共通要素
    COMMON: {
      CANVAS_CONTAINER: 'canvas-container'
    }
  }
};

// 2. 言語別メッセージ定義（ここだけ切り替える）
const MESSAGES_DATA = {
  // 日本語
  ja: {
    TEXT_DELETE_MODE: '⚠️ DELETE MODE',
    PROMPT_SAVE_FILENAME: '保存するファイル名を入力してください（拡張子なし）:',
    PROMPT_SHARE_SUCCESS: 'URLをクリップボードにコピーしました！',
    PROMPT_COPY_URL: '以下のURLをコピーしてください:',
    ALERT_LOAD_SUCCESS: '読み込みが完了しました',
    ALERT_SAVE_FAILED: '保存に失敗しました',
    ALERT_LOAD_FAILED: '読み込みに失敗しました',
    ALERT_SHARE_FAILED: 'シェアURLの生成に失敗しました',
    ALERT_URL_RESTORE_SUCCESS: 'URLから回路を復元しました',
    ALERT_URL_RESTORE_FAILED: 'URLからの復元に失敗しました',
    ERROR_INVALID_FILE_FORMAT: '無効なファイル形式です',
    CONFIRM_RESET: '全てのパーツとワイヤーを削除してリセットします。よろしいですか？'
  },
  
  // 英語（デフォルト）
  en: {
    TEXT_DELETE_MODE: '⚠️ DELETE MODE',
    PROMPT_SAVE_FILENAME: 'Enter file name to save (no extension):',
    PROMPT_SHARE_SUCCESS: 'URL copied to clipboard!',
    PROMPT_COPY_URL: 'Please copy the following URL:',
    ALERT_LOAD_SUCCESS: 'Load complete.',
    ALERT_SAVE_FAILED: 'Save failed',
    ALERT_LOAD_FAILED: 'Load failed',
    ALERT_SHARE_FAILED: 'Failed to generate share URL',
    ALERT_URL_RESTORE_SUCCESS: 'Restored circuit from URL',
    ALERT_URL_RESTORE_FAILED: 'Failed to restore from URL',
    ERROR_INVALID_FILE_FORMAT: 'Invalid file format',
    CONFIRM_RESET: 'Are you sure you want to delete all parts and wires?'
  }
};

// 3. 自動判定ロジック
// ブラウザの言語が 'ja' で始まれば 'ja'、それ以外は 'en'
const userLang = (navigator.language || navigator.userLanguage || 'en').startsWith('ja') ? 'ja' : 'en';

// 4. マージしてエクスポート
// これで CONST.MESSAGES が自動的に切り替わります
export const CONST = {
  ...COMMON_CONST,
  MESSAGES: MESSAGES_DATA[userLang]
};
