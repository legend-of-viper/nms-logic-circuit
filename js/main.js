'use strict';

import { CircuitManager } from './services/CircuitManager.js';
import { StorageService } from './services/StorageService.js';
import { UIController } from './ui/UIController.js';
import { CONST } from './config/constants.js';
import { deviceDetector } from './utils/DeviceDetector.js';

// グローバル変数
let simulator;
let storage;
let uiController;

window.setup = function() {
  // モバイルとPCで異なるキャンバスサイズを設定
  let canvasWidth, canvasHeight;
  
  if (deviceDetector.isMobile()) {
    // モバイル: 画面幅いっぱい、高さはヘッダー(44px)を引く
    canvasWidth = windowWidth;
    canvasHeight = windowHeight - 44;
  } else {
    // PC: 従来通り余白を確保
    canvasWidth = windowWidth - 20;
    canvasHeight = windowHeight - 80;
  }
  
  const canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent('canvas-container');
  
  const bgRGB = CONST.COLORS.BACKGROUND;
  select('body').style('background-color', `rgb(${bgRGB[0]}, ${bgRGB[1]}, ${bgRGB[2]})`);
  select('#canvas-container').style('background-color', `rgb(${bgRGB[0]}, ${bgRGB[1]}, ${bgRGB[2]})`);
  
  simulator = new CircuitManager();
  storage = new StorageService(simulator);
  
  uiController = new UIController(simulator, storage);
  uiController.initialize();
  
  storage.loadFromUrlHash();
};

window.draw = function() {
  simulator.update();

  // ★追加: UIの更新処理（削除カーソルの追従・リサイズなど）
  if (uiController) {
    uiController.update();
  }
};

window.mousePressed = function(e) {
  // UIボタン（追加ボタンや削除ボタン）をタップした時は、
  // ここで止めずに通常のクリック処理をさせたいので何もしない
  if (e && e.target.nodeName !== 'CANVAS') return;

  simulator.handleMousePressed();
  
  // ★重要: これで「ゴーストクリック（二重判定）」を防ぐ
  return false; 
};

window.mouseDragged = function(e) {
  // キャンバス外のドラッグは無視
  if (e && e.target.nodeName !== 'CANVAS') return;

  simulator.handleMouseDragged();
  
  // スマホで回路をドラッグした時に、画面全体がスクロールしてしまうのを防ぐ
  return false; 
};

window.mouseReleased = function(e) {
  // キャンバス外での離脱は無視
  if (e && e.target.nodeName !== 'CANVAS') return;

  simulator.handleMouseReleased();
  
  // 処理終了の合図
  return false; 
};

window.windowResized = function() {
  // リサイズ時はキャンバスサイズのみ調整（モード切り替えは行わない）
  let canvasWidth, canvasHeight;
  
  if (deviceDetector.isMobile()) {
    // モバイル: 画面幅いっぱい、高さはヘッダー(44px)を引く
    canvasWidth = windowWidth;
    canvasHeight = windowHeight - 44;
  } else {
    // PC: 従来通り余白を確保
    canvasWidth = windowWidth - 20;
    canvasHeight = windowHeight - 80;
  }
  
  resizeCanvas(canvasWidth, canvasHeight);
};
