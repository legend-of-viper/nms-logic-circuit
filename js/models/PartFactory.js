'use strict';

import { Power } from './Power.js';
import { WallSwitch } from './WallSwitch.js';
import { Button } from './Button.js';
import { AutoSwitch } from './AutoSwitch.js';
import { Inverter } from './Inverter.js';
import { ColorLight } from './ColorLight.js';

// 部品タイプとクラスの対応表
const PART_REGISTRY = {
  'POWER': Power,
  'WALL_SWITCH': WallSwitch,
  'BUTTON': Button,
  'AUTO_SWITCH': AutoSwitch,
  'INVERTER': Inverter,
  'COLOR_LIGHT': ColorLight
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