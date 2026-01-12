'use strict';

/**
 * デバイス検出ユーティリティクラス
 * スマホOSかPCかを判定する
 */
export class DeviceDetector {
  constructor() {
    // スマホ・タブレットのOSかを判定
    this.isMobileDevice = this.detectMobileOS();
  }

  /**
   * モバイルOS（スマホ・タブレット）の判定
   * @returns {boolean} スマホ・タブレットのOSの場合true
   */
  detectMobileOS() {
    // iPhone, iPad, Android などの文字列が含まれているかチェック
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }

  /**
   * スマホモードにするべきか
   * @returns {boolean} スマホ・タブレットの場合true
   */
  isMobile() {
    return this.isMobileDevice;
  }

  /**
   * PCモードにするべきか
   * @returns {boolean} PCの場合true
   */
  isPC() {
    return !this.isMobileDevice;
  }

  /**
   * デバイス情報をコンソールに出力（デバッグ用）
   */
  logDeviceInfo() {
    console.log('=== Device Information ===');
    console.log(`Mobile Device: ${this.isMobile()}`);
    console.log(`PC Device: ${this.isPC()}`);
    console.log(`UserAgent: ${navigator.userAgent}`);
    console.log('========================');
  }
}

// シングルトンインスタンスをエクスポート
export const deviceDetector = new DeviceDetector();
