'use strict';

// アプリ全体で使う定数（設定値）をここにまとめる
export const CONST = {
  // 色の設定
  COLORS: {
    BACKGROUND: [30, 30, 30],
    TEXT: '#eeeeee',
    HEADER_BG: '#333333',
    WIRE_TEMP: [255, 50, 50],
    ON_STATE: [0, 255, 100],
    OFF_STATE: [255, 50, 50]
  },
  
  // 部品の設定
  PARTS: (() => {
    const WIDTH = 40;  // 基準となる幅
    return {
      WIDTH: WIDTH,
      HEIGHT: WIDTH,
      RADIUS: WIDTH * 0.2,
      STROKE_WIDTH: WIDTH * 0.1,
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
    DELETE_MODE: '🗑️ 削除'
  },
  
  // 削除モードの設定
  DELETE_MODE: {
    HIGHLIGHT_COLOR: [255, 0, 0],      // 削除対象のハイライト色（赤）
    HIGHLIGHT_STROKE_WEIGHT: 4,        // ハイライトの線の太さ
    SNAP_DISTANCE_MULTIPLIER: 1.0,     // スナップ距離の倍率（PARTS.WIDTH × この値）
    BUTTON_ACTIVE_COLOR: [255, 50, 50], // 削除モードON時のボタン色
    BUTTON_INACTIVE_COLOR: [100, 100, 100] // 削除モードOFF時のボタン色
  }
};
