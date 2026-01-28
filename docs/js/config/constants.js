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
      ROTATION_HANDLE_RADIUS: 12,
      ROTATION_HANDLE_HIT_RADIUS: 15,
      JOINT_RADIUS: 8,
      JOINT_HANDLE_RADIUS: 12,
      JOINT_HIT_RADIUS: 15,
      DETACH_HANDLE_RADIUS: 12,
      DETACH_HANDLE_HIT_RADIUS: 15
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
    MULTI_SELECT: 'Multi Select Mode', // ★追加
    ROTATION_SNAP: 'Rotation Snap',
    MOVE_SNAP: 'Grid Snap',
    GRID_VISIBLE: 'Show Grid'
  },

  // グリッドの設定
  GRID: {
    SIZE: 44,              // グリッドの間隔（パーツの幅の半分）
    COLOR: [50, 50, 50],   // 線の色（背景より少し明るく）
    STROKE_WEIGHT: 1,      // 線の太さ
    SNAP_COARSE: 22,       // スナップON時の単位 (44の半分)
    SNAP_FINE: 2.75,       // スナップOFF時の単位
    DRAW_OFFSET: -2        // 描画オフセット（PARTS.STROKE_WEIGHT の半分）
  },
  
  // 削除モードの設定
  DELETE_MODE: {
    HIGHLIGHT_COLOR: [255, 0, 0],
    HIGHLIGHT_ALPHA: 100,                   // ハイライトの透明度
    HIGHLIGHT_SCALE: 1.5,                   // パーツサイズに対する倍率
    HIGHLIGHT_CORNER_RADIUS: 12,            // ハイライト表示の角丸
    HIGHLIGHT_STROKE_WEIGHT: 4,             // 現在は未使用だが将来用
    SNAP_DISTANCE_MULTIPLIER: 1.6,
    WIRE_HIT_DISTANCE: 15,
    BUTTON_ACTIVE_COLOR: [255, 50, 50],
    BUTTON_INACTIVE_COLOR: [100, 100, 100]
  },

  // 複数選択モードの設定
  MULTI_SELECT_MODE: {
    // 色
    COLOR_STROKE: [0, 255, 255],       // 選択枠・カーソルの枠線色（シアン）
    COLOR_BG: [0, 255, 255, 30],       // 選択枠・カーソルの背景色（半透明シアン）
    COLOR_TEXT: [0, 255, 255],         // テキスト表示の色（シアン）
    
    // テキスト表示
    TEXT_SIZE: 18,
    TEXT_STROKE_WEIGHT: 3,
    
    // 選択枠（パーツに表示される枠線）
    SELECTION_BORDER_SCALE: 1.3,       // パーツサイズに対する倍率
    SELECTION_BORDER_CORNER_RADIUS: 12,
    SELECTION_STROKE_WEIGHT: 2,
    
    // カーソル（パーツが無い場所でのカーソル表示）
    CURSOR_WIDTH: 40*1.3,                  // PARTS.WIDTHと同じ
    CURSOR_HEIGHT: 40*1.3,                 // PARTS.HEIGHTと同じ
    CURSOR_CORNER_RADIUS: 12,
    CURSOR_STROKE_WEIGHT: 2,
    CURSOR_DASH_PATTERN: [4, 4],        // 点線パターン

    SNAP_DISTANCE_MULTIPLIER: 1.0,
  },

  // アニメーション設定
  ANIMATION: {
    ROTATION_SPEED: 0.2,              // 1フレームで近づく割合 (0.0～1.0)
    ROTATION_SNAP_THRESHOLD: 0.001,   // 目標値と見なす誤差の範囲（ラジアン）
    MOVE_SPEED: 0.3,                  // ★追加: 移動アニメーションの速度 (0.0～1.0)
    MOVE_SNAP_THRESHOLD: 0.5          // ★追加: 移動目標値とみなす誤差（ピクセル）
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
      MULTI_SELECT: 'btn-multi-select', // ★追加
      SAVE: 'btn-save',
      LOAD: 'btn-load',
      SHARE: 'btn-share',
      ROTATION_SNAP: 'rotation-snap-checkbox',
      MOVE_SNAP: 'move-snap-checkbox',
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
      MOVE_SNAP: 'mobile-move-snap-checkbox',
      GRID_VISIBLE: 'mobile-grid-visible-checkbox'
    },
    // 共通要素
    COMMON: {
      CANVAS_CONTAINER: 'canvas-container'
    }
  },
  // ローカルストレージのキー定義
  STORAGE_KEYS: {
    ROTATION_SNAP: 'nms_circuit_rotation_snap', // 回転スナップ設定
    MOVE_SNAP: 'nms_circuit_move_snap',         // 移動スナップ設定
    GRID_VISIBLE: 'nms_circuit_grid_visible'    // グリッド表示設定
  }
};

// 2. 言語別メッセージ定義（ここだけ切り替える）
const MESSAGES_DATA = {
  // 日本語
  ja: {
    TEXT_DELETE_MODE: '⚠️ DELETE MODE',
    TEXT_MULTI_SELECT: 'MULTI SELECT MODE',
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
    TEXT_MULTI_SELECT: 'MULTI SELECT MODE',
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
