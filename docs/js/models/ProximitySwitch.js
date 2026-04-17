'use strict';

import { CircuitPart } from './CircuitPart.js';
import { Socket } from './Socket.js';
import { CONST } from '../config/constants.js';

/**
 * 近接スイッチクラス（Proximity Switch）
 * マウスカーソルが近づくとONになるセンサー
 * ヒステリシス機能付き（ON半径とOFF半径が異なる）
 */
export class ProximitySwitch extends CircuitPart {
  constructor(id, x, y) {
    super(id, x, y);
    
    this.type = CONST.PART_TYPE.PROXIMITY_SWITCH;
    this.isOn = false;

    // ソケットを左右に配置
    this.sockets = [
      new Socket(this, 'left', -this.width / 2, 0, 'left'),
      new Socket(this, 'right', this.width / 2, 0, 'right')
    ];

    // センサー範囲の設定
    // ON半径: グリッド4つ分
    this.activationRadius = CONST.GRID.SIZE * 4;
    // OFF半径: グリッド5つ分（ヒステリシス）
    this.deactivationRadius = CONST.GRID.SIZE * 5;
    
    // worldMouseを保持するプロパティ
    this.lastWorldMouse = null;
  }

  /**
   * リアルタイムセンサー判定
   * PowerSystem.update()から毎フレーム呼ばれる
   */
  update() {
    // worldMouseの座標を取得（draw時に更新される）
    if (this.lastWorldMouse) {
      this.checkSensor(this.lastWorldMouse);
    }
  }

  /**
   * センサー範囲内かどうかの判定（ヒステリシス付き）
   */
  checkSensor(worldPos) {
    if (!worldPos) return;
    
    // パーツの実際の中心座標を取得（回転考慮）
    const center = this.getCenter();
    
    // パーツの中心からマウスカーソルまでの距離を計算
    const dx = worldPos.x - center.x;
    const dy = worldPos.y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // ヒステリシス機能
    if (this.isOn) {
      // ON状態の時は、deactivationRadius より外に出たらOFFにする
      if (distance > this.deactivationRadius) {
        this.isOn = false;
      }
    } else {
      // OFF状態の時は、activationRadius より内に入ったらONにする
      if (distance <= this.activationRadius) {
        this.isOn = true;
      }
    }
  }

  /**
   * 描画処理
   */
  drawShape(color, worldMouse) {
    // worldMouseを保存（update()で使用）
    this.lastWorldMouse = worldMouse;
    
    // 1. 外側の枠線
    super.drawShape(color);

    // 2. センサービーム（検知時のみ表示）- Canvas APIで放射状グラデーション
    if (this.isOn) {
      const beamWidth = this.width * 2.0; // ビームの横幅（広めに）
      const beamHeight = this.height * 0.8; // ビームの縦の長さ
      
      push();
      
      // Canvas APIのコンテキストを取得
      const ctx = drawingContext;
      
      // 上向きビーム用の線形グラデーション（中心から上へ）
      const gradientUp = ctx.createLinearGradient(
        0, 0,              // 開始点：レンズ中心
        0, -beamHeight     // 終了点：ビームの先端
      );
      gradientUp.addColorStop(0, `rgba(${CONST.COLORS.ON_STATE[0]}, ${CONST.COLORS.ON_STATE[1]}, ${CONST.COLORS.ON_STATE[2]}, 0.7)`);
      gradientUp.addColorStop(1, `rgba(${CONST.COLORS.ON_STATE[0]}, ${CONST.COLORS.ON_STATE[1]}, ${CONST.COLORS.ON_STATE[2]}, 0)`);
      
      // 上向き三角形を描画
      ctx.fillStyle = gradientUp;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-beamWidth / 2, -beamHeight);
      ctx.lineTo(beamWidth / 2, -beamHeight);
      ctx.closePath();
      ctx.fill();
      
      // 左右のエッジだけを光らせる（上向き）- グラデーション付き
      const edgeGradientUp = ctx.createLinearGradient(0, 0, 0, -beamHeight);
      edgeGradientUp.addColorStop(0, `rgba(${CONST.COLORS.ON_STATE[0]}, ${CONST.COLORS.ON_STATE[1]}, ${CONST.COLORS.ON_STATE[2]}, 0.6)`);
      edgeGradientUp.addColorStop(1, `rgba(${CONST.COLORS.ON_STATE[0]}, ${CONST.COLORS.ON_STATE[1]}, ${CONST.COLORS.ON_STATE[2]}, 0)`);
      ctx.strokeStyle = edgeGradientUp;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-beamWidth / 2, -beamHeight);  // 左辺
      ctx.moveTo(0, 0);
      ctx.lineTo(beamWidth / 2, -beamHeight);   // 右辺
      ctx.stroke();
      
      // 下向きビーム用の線形グラデーション（中心から下へ）
      const gradientDown = ctx.createLinearGradient(
        0, 0,              // 開始点：レンズ中心
        0, beamHeight      // 終了点：ビームの先端
      );
      gradientDown.addColorStop(0, `rgba(${CONST.COLORS.ON_STATE[0]}, ${CONST.COLORS.ON_STATE[1]}, ${CONST.COLORS.ON_STATE[2]}, 0.7)`);
      gradientDown.addColorStop(1, `rgba(${CONST.COLORS.ON_STATE[0]}, ${CONST.COLORS.ON_STATE[1]}, ${CONST.COLORS.ON_STATE[2]}, 0)`);
      
      // 下向き三角形を描画
      ctx.fillStyle = gradientDown;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-beamWidth / 2, beamHeight);
      ctx.lineTo(beamWidth / 2, beamHeight);
      ctx.closePath();
      ctx.fill();
      
      // 左右のエッジだけを光らせる（下向き）- グラデーション付き
      const edgeGradientDown = ctx.createLinearGradient(0, 0, 0, beamHeight);
      edgeGradientDown.addColorStop(0, `rgba(${CONST.COLORS.ON_STATE[0]}, ${CONST.COLORS.ON_STATE[1]}, ${CONST.COLORS.ON_STATE[2]}, 0.6)`);
      edgeGradientDown.addColorStop(1, `rgba(${CONST.COLORS.ON_STATE[0]}, ${CONST.COLORS.ON_STATE[1]}, ${CONST.COLORS.ON_STATE[2]}, 0)`);
      ctx.strokeStyle = edgeGradientDown;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-beamWidth / 2, beamHeight);  // 左辺
      ctx.moveTo(0, 0);
      ctx.lineTo(beamWidth / 2, beamHeight);   // 右辺
      ctx.stroke();
      
      pop();
    }

    // 3. ドラッグ中にセンサー範囲を表示
    if (this.isDragging) {
      push();
      const ctx = drawingContext;
      
      // 点線スタイルを設定
      ctx.setLineDash([5, 5]); // [線の長さ, 隙間の長さ]
      
      noFill();
      stroke(CONST.COLORS.TEXT);
      strokeWeight(1);
      circle(0, 0, this.activationRadius * 2); // 直径 = 半径 * 2
      
      // 点線スタイルをリセット
      ctx.setLineDash([]);
      pop();
    }

    // 4. 内部の円（センサーレンズのイメージ）- 二重円で立体感を出す
    const circleRadius = this.width * 0.35 * (2/3) * 0.7; // レンズ全体をさらに小さく
    const circleColor = this.isOn ? CONST.COLORS.ON_STATE : CONST.COLORS.OFF_STATE;
    
    // 外側の円（暗めの色で影のような効果）- 太く強調
    push();
    noFill();
    // 色を暗くする（各要素を0.6倍）
    const darkColor = circleColor.map(c => c * 0.6);
    stroke(...darkColor);
    strokeWeight(4.0); // 太くして強調
    circle(0, 0, circleRadius * 2 * 1.3); // 外側は30%大きく
    pop();
    
    // 内側の円（通常の明るさ）
    push();
    noFill();
    stroke(...circleColor);
    strokeWeight(2.5);
    circle(0, 0, circleRadius * 2);
    pop();
  }

  // --- その他のUI用オーバーライド ---
  
  interact() {
    // 手動操作なし（センサー動作のみ）
  }
}
