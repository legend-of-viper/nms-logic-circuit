'use strict';

// アプリ全体で使う定数（設定値）をここにまとめる
export const CONST = {
  // 部品タイプの定義
  PART_TYPE: {
    POWER: 'POWER',
    AUTO_SWITCH: 'AUTO_SWITCH',
    INVERTER: 'INVERTER',
    BUTTON: 'BUTTON',
    WALL_SWITCH: 'WALL_SWITCH',
    COLOR_LIGHT: 'COLOR_LIGHT'
  },

  // 色の設定
  COLORS: {
    BACKGROUND: [30, 30, 30],
    TEXT: '#eeeeee',
    HEADER_BG: '#333333',
    WIRE_ON: [0, 128, 255],
    WIRE_TEMP: [255, 50, 50],
    // ON_STATE: [0, 255, 100],
    ON_STATE: [0, 128, 255],
    OFF_STATE: [255, 50, 50]
  },
  
  // 部品の設定
  PARTS: (() => {
    const WIDTH = 40;  // 基準となる幅
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
      // 回転ハンドルの設定
      ROTATION_HANDLE_DISTANCE: WIDTH * 1.2,  // 部品中心からハンドルまでの距離
      ROTATION_HANDLE_RADIUS: WIDTH * 0.3,    // ハンドルの半径
      ROTATION_HANDLE_HIT_RADIUS: WIDTH * 0.4 // ハンドルのヒット判定半径
    };
  })(),
  
  // ワイヤーの設定
  WIRE: {
    STROKE_WEIGHT: 3,
    TEMP_ALPHA: 150
  },
  
  // ボタンの設定
  BUTTON: {
    ON_DURATION: 1000 // ミリ秒
  },
  
  // UI要素のラベル
  UI_LABELS: {
    POWER: '電源',
    AUTO_SWITCH: 'オートスイッチ',
    INVERTER: '電力変換器',
    BUTTON: 'ボタン',
    WALL_SWITCH: '壁スイッチ',
    COLOR_LIGHT: 'カラーライト',
    SAVE: '保存',
    LOAD: '読込',
    SHARE: '🔗 シェア',
    DELETE_MODE: '🗑️ 削除'
  },
  
  // 削除モードの設定
  DELETE_MODE: {
    HIGHLIGHT_COLOR: [255, 0, 0],      // 削除対象のハイライト色（赤）
    HIGHLIGHT_STROKE_WEIGHT: 4,        // ハイライトの線の太さ
    SNAP_DISTANCE_MULTIPLIER: 1.0,     // スナップ距離の倍率（PARTS.WIDTH × この値）
    BUTTON_ACTIVE_COLOR: [255, 50, 50], // 削除モードON時のボタン色
    BUTTON_INACTIVE_COLOR: [100, 100, 100] // 削除モードOFF時のボタン色
  },
  
  // 画面メッセージ（保存・読込・シェア関連）
  MESSAGES: {
    PROMPT_SAVE_FILENAME: '保存するファイル名を入力してください（拡張子なし）:',
    ALERT_LOAD_SUCCESS: '読み込みが完了しました',
    ALERT_SAVE_FAILED: '保存に失敗しました',
    ALERT_LOAD_FAILED: '読み込みに失敗しました',
    ALERT_SHARE_SUCCESS: 'URLをクリップボードにコピーしました！このURLを共有してください。',
    ALERT_SHARE_FAILED: 'シェアURLの生成に失敗しました',
    ALERT_URL_RESTORE_SUCCESS: 'URLから回路を復元しました',
    ALERT_URL_RESTORE_FAILED: 'URLからの復元に失敗しました',
    ERROR_INVALID_FILE_FORMAT: '無効なファイル形式です'
  }
};
