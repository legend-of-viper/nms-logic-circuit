'use strict';

import { CircuitSimulator } from './services/CircuitSimulator.js';
import { UIController } from './ui/UIController.js';
import { APP_CONFIG } from './config/constants.js';

// グローバル変数（p5.jsとの連携のため必要）
let simulator;
let uiController;

/**
 * p5.js setup関数
 * アプリケーションの初期化
 */
window.setup = function() {
  // キャンバスの作成
  const canvas = createCanvas(windowWidth - 20, windowHeight - 80);
  canvas.parent('canvas-container');
  
  // 背景色の設定
  const bgRGB = APP_CONFIG.COLORS.BACKGROUND;
  select('body').style('background-color', `rgb(${bgRGB[0]}, ${bgRGB[1]}, ${bgRGB[2]})`);
  select('#canvas-container').style('background-color', `rgb(${bgRGB[0]}, ${bgRGB[1]}, ${bgRGB[2]})`);
  
  // シミュレーターとUIコントローラーの初期化
  simulator = new CircuitSimulator();
  uiController = new UIController(simulator);
  uiController.initialize();
};

/**
 * p5.js draw関数
 * 毎フレーム呼ばれる描画処理
 */
window.draw = function() {
  simulator.update();
};

/**
 * p5.js mousePressed関数
 * マウスボタンを押した時
 */
window.mousePressed = function() {
  simulator.handleMousePressed();
};

/**
 * p5.js mouseDragged関数
 * マウスをドラッグしている時
 */
window.mouseDragged = function() {
  simulator.handleMouseDragged();
};

/**
 * p5.js mouseReleased関数
 * マウスボタンを離した時
 */
window.mouseReleased = function() {
  simulator.handleMouseReleased();
};

/**
 * p5.js windowResized関数
 * ウィンドウサイズが変更された時
 */
window.windowResized = function() {
  resizeCanvas(windowWidth - 20, windowHeight - 80);
};
