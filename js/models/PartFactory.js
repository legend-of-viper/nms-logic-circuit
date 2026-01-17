'use strict';

import { Power } from './Power.js';
import { WallSwitch } from './WallSwitch.js';
import { Button } from './Button.js';
import { AutoSwitch } from './AutoSwitch.js';
import { Inverter } from './Inverter.js';
import { ColorLight } from './ColorLight.js';
import { WireJoint } from './WireJoint.js';
import { CONST } from '../config/constants.js';

// 部品タイプとクラスの対応表
const PART_REGISTRY = {
  [CONST.PART_TYPE.POWER]: Power,
  [CONST.PART_TYPE.WALL_SWITCH]: WallSwitch,
  [CONST.PART_TYPE.BUTTON]: Button,
  [CONST.PART_TYPE.AUTO_SWITCH]: AutoSwitch,
  [CONST.PART_TYPE.INVERTER]: Inverter,
  [CONST.PART_TYPE.COLOR_LIGHT]: ColorLight,
  [CONST.PART_TYPE.JOINT]: WireJoint
};

/**
 * 部品生成ファクトリ
 * タイプ名を指定してインスタンスを生成する
 */
export class PartFactory {
  /**
   * 部品を作成する
   * @param {string} type - 部品タイプ ('POWER', 'BUTTON' etc.)
   * @param {number} id - 一意なID
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @returns {CircuitPart|null} 生成された部品（存在しないタイプの場合はnull）
   */
  static create(type, id, x, y) {
    const PartClass = PART_REGISTRY[type];
    
    if (!PartClass) {
      console.warn(`PartFactory: 未知の部品タイプ '${type}' が指定されました。`);
      return null;
    }

    return new PartClass(id, x, y);
  }
}
