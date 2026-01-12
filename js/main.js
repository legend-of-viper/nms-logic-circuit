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
  select('body').style('background-color', `rgb(${bgRGB[0]}, ${bgRGB[1]+50}, ${bgRGB[2]})`);
  select('#canvas-container').style('background-color', `rgb(${bgRGB[0]}, ${bgRGB[1]}, ${bgRGB[2]+50})`);
  
  simulator = new CircuitManager();
  storage = new StorageService(simulator);
  
  uiController = new UIController(simulator, storage);
  uiController.initialize();
  
  storage.loadFromUrlHash();
};

window.draw = function() {
  simulator.update();
};

window.mousePressed = function() { simulator.handleMousePressed(); };
window.mouseDragged = function() { simulator.handleMouseDragged(); };
window.mouseReleased = function() { simulator.handleMouseReleased(); };

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
