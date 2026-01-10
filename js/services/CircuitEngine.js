'use strict';

import { Power } from '../models/Power.js';

const UPDATE_INTERVAL = 1000;

/**
 * 回路演算エンジン
 * 再帰呼び出しによって電気を伝播させる
 */
export class CircuitEngine {
  constructor(parts, wires) {
    this.parts = parts;
    this.wires = wires;
    this.poweredSockets = new Set();
    this.lastBeat = -1;
  }

  /**
   * 1フレーム分の回路計算
   */
calculate() {
    // ----------------------------------------------------
    // 1. 論理状態の更新（Logic Update）
    // ----------------------------------------------------
    // グローバルなビートを計算
    const currentBeat = Math.floor(millis() / UPDATE_INTERVAL);
    
    // ビートが進んだ瞬間だけ、全パーツのロジックを更新！
    if (currentBeat > this.lastBeat) {
      this.parts.forEach(part => {
        // もしパーツが updateLogic メソッドを持っていたら呼ぶ
        if (typeof part.updateLogic === 'function') {
          part.updateLogic();
        }
      });
      this.lastBeat = currentBeat;
    }

    // ----------------------------------------------------
    // 2. 電気の伝播（Physics Update）
    // ----------------------------------------------------
    // こっちは毎フレーム実行して、瞬時の電気の流れを描画に反映させる
    this.parts.forEach(p => p.resetPowerState());
    this.poweredSockets.clear();

    const powerSources = this.parts.filter(p => p instanceof Power);
    powerSources.forEach(source => {
      const outputSocket = source.getSocket('right');
      if (outputSocket) this.propagate(outputSocket);
    });

    // 最後に描画用などの汎用updateがあれば呼ぶ（今回は不要かも）
    // this.parts.forEach(p => p.update());
  }

  /**
   * 電気を流すメソッド（再帰）
   * @param {Socket} socket - 今、電気が到達したソケット
   */
  propagate(socket) {
    // 【無限ループ回避の要】
    // すでに電気が来ているなら、これ以上計算しない（ここで止まる）
    if (socket.isPowered) {
      return;
    }

    // 通電させる！
    socket.isPowered = true;

    // --------------------------------------------
    // A. ワイヤーの先へ流す（Socket -> Wire -> Socket）
    // --------------------------------------------
    socket.connectedWires.forEach(wire => {
      const otherEnd = wire.getOtherEnd(socket);
      if (otherEnd) {
        this.propagate(otherEnd); // 再帰呼び出し
      }
    });

    // --------------------------------------------
    // B. パーツの反対側へ流す（Socket -> Part -> Socket）
    // --------------------------------------------
    // 今いるソケットが「入力」なら、「出力」へ電気を通せるかチェック
    const part = socket.parent;
    
    // パーツごとのルール判定（通していい状態か？）
    if (this.canConduct(part, socket)) {
      // 反対側のソケットを取得して流す
      const outputSockets = this.getOutputSockets(part, socket);
      outputSockets.forEach(outSocket => {
        this.propagate(outSocket); // 再帰呼び出し
      });
    }
  }

  /**
   * そのパーツは今、電気を通せる状態か？
   */
  canConduct(part, inputSocket) {
    // 制御用ソケット（control）に入った電気は、そこで行き止まり
    if (inputSocket.name === 'control') {
      return false;
    }

    // それ以外は、パーツごとの isOn プロパティを見る
    // (スイッチがOFFなら false が返ってきて、電気は止まる)
    if ('isOn' in part) {
      return part.isOn;
    }

    // プロパティが無いパーツ（ただの接続点など）は通す
    return true;
  }

  /**
   * 入力ソケットに対して、出口となるソケットはどれか？
   */
  getOutputSockets(part, inputSocket) {
    // 基本は「左から入ったら右へ」「右から入ったら左へ」
    if (inputSocket.name === 'left') {
      return [part.getSocket('right')].filter(s => s);
    }
    if (inputSocket.name === 'right') {
      return [part.getSocket('left')].filter(s => s);
    }
    return [];
  }
}