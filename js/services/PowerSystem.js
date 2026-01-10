'use strict';

import { CONST } from '../config/constants.js';

const UPDATE_INTERVAL = 1000;

/**
 * 電力システム
 * 再帰呼び出しによって電気を伝播させる
 */
export class PowerSystem {
  constructor(parts, wires) {
    this.parts = parts;
    this.wires = wires;
    // this.processedSockets = new Set();
    this.lastTick = -1;
  }

  /**
   * 1フレーム分の回路計算
   */
  update() {// ----------------------------------------------------
    // 1. リアルタイム更新（Physics/Time Update）★追加
    // ----------------------------------------------------
    // 各パーツの update() メソッドを呼び出して、リアルタイムな状態更新を行う
    this.parts.forEach(part => part.update());

    // ----------------------------------------------------
    // 2. 論理状態の更新（Logic Update）
    // ----------------------------------------------------
    // グローバルなティックを計算
    const currentTick = Math.floor(millis() / UPDATE_INTERVAL);
    
    // ティックが進んだ瞬間だけ、全パーツのロジックを更新！
    if (currentTick > this.lastTick) {
      // 全パーツの onTick() を無条件に呼ぶ
      this.parts.forEach(part => part.onTick());
      this.lastTick = currentTick;
    }

    // ----------------------------------------------------
    // 3. 電気の伝播（Physics Update）
    // ----------------------------------------------------
    // こっちは毎フレーム実行して、瞬時の電気の流れを描画に反映させる
    this.parts.forEach(part => part.resetPowerState());
    // this.processedSockets.clear();

    // 電源を探してスタート
    const powerSources = this.parts.filter(part => part.type === CONST.PART_TYPE.POWER);
    powerSources.forEach(source => {
      const outputSocket = source.getSocket('right');
      if (outputSocket) this.flowPower(outputSocket);
    });
  }

  /**
   * 電気を流すメソッド（再帰）
   * @param {Socket} socket - 今、電気が到達したソケット
   */
  flowPower(socket) {
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
        this.flowPower(otherEnd); // 再帰呼び出し
      }
    });

    // --------------------------------------------
    // B. パーツの反対側へ流す（Socket -> Part -> Socket）
    // --------------------------------------------
    // 今いるソケットが「入力」なら、「出力」へ電気を通せるかチェック
    const part = socket.parent;
    
    // パーツごとのルール判定（通していい状態か？）
    if (this.canPassThrough(part, socket)) {
      // 反対側のソケットを取得して流す
      const outputSockets = this.getOutputSockets(part, socket);
      outputSockets.forEach(outSocket => {
        this.flowPower(outSocket); // 再帰呼び出し
      });
    }
  }

  /**
   * 電気がパーツを通り抜けられるか判定
   */
  canPassThrough(part, inputSocket) {
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
