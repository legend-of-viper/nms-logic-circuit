'use strict';

import { CONST } from '../config/constants.js';

/**
 * ストレージサービス
 * ファイル保存、読込、URL共有などの入出力(I/O)を担当
 */
export class StorageService {
  /**
   * @param {CircuitManager} circuitManager - 連携する回路マネージャー
   */
  constructor(circuitManager) {
    this.circuitManager = circuitManager;
  }

  /**
   * ファイルに保存
   */
  saveToFile() {
    try {
      // マネージャーからデータをもらうだけ
      const saveData = this.circuitManager.serializeCircuitData();
      const jsonString = JSON.stringify(saveData, null, 2);
      
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // 日付入りファイル名の生成
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:\.]/g, '-').slice(0, -5);
      const defaultFileName = `circuit_${timestamp}`;
      
      let fileName = prompt(CONST.MESSAGES.PROMPT_SAVE_FILENAME, defaultFileName);
      
      if (fileName === null) {
        console.log("保存がキャンセルされました");
        return false;
      }
      
      if (fileName.trim() === '') {
        fileName = defaultFileName;
      }
      
      fileName = fileName.replace(/\.json$/i, '');
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log("回路データを保存しました");
      return true;
    } catch (error) {
      console.error("保存中にエラーが発生しました:", error);
      alert(CONST.MESSAGES.ALERT_SAVE_FAILED + ': ' + error.message);
      return false;
    }
  }

  /**
   * ファイルから読込
   */
  loadFromFile() {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
          try {
            const saveData = JSON.parse(e.target.result);
            
            // 読み込んだデータをマネージャーに渡して復元してもらう
            this.circuitManager.restoreFromData(saveData);
            
            console.log(`回路データを読み込みました: パーツ${this.circuitManager.parts.length}個, ワイヤー${this.circuitManager.wires.length}本`);
            alert(CONST.MESSAGES.ALERT_LOAD_SUCCESS);
          } catch (error) {
            console.error("ファイルの読み込み中にエラーが発生しました:", error);
            alert(CONST.MESSAGES.ALERT_LOAD_FAILED + ': ' + error.message);
          }
        };
        
        reader.readAsText(file);
      };
      
      input.click();
    } catch (error) {
      console.error("読み込み処理中にエラーが発生しました:", error);
      alert(CONST.MESSAGES.ALERT_LOAD_FAILED + ': ' + error.message);
    }
  }

  /**
   * URLでシェア
   */
  shareToUrl() {
    try {
      // 軽量版データを取得
      const saveData = this.circuitManager.serializeCircuitData(true);
      const jsonString = JSON.stringify(saveData);
      
      // lz-stringで圧縮
      const compressed = LZString.compressToEncodedURIComponent(jsonString);
      
      // ハッシュを使用したURL生成
      const baseUrl = window.location.origin + window.location.pathname;
      const shareUrl = `${baseUrl}#${compressed}`;
      
      // アドレスバーのURLも更新（ページリロードなし）
      window.history.pushState(null, null, shareUrl);
      
      // クリップボードにコピー
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert(CONST.MESSAGES.ALERT_SHARE_SUCCESS);
        console.log('シェアURL:', shareUrl);
      }).catch(err => {
        // クリップボードへのコピーに失敗した場合はプロンプトで表示
        prompt('以下のURLをコピーしてください:', shareUrl);
      });
      
      return true;
    } catch (error) {
      console.error('シェアURL生成中にエラーが発生しました:', error);
      alert(CONST.MESSAGES.ALERT_SHARE_FAILED + ': ' + error.message);
      return false;
    }
  }

  /**
   * URLハッシュから復元
   */
  loadFromUrlHash() {
    try {
      const hash = window.location.hash.substring(1);
      
      if (!hash) {
        return false; // ハッシュがない場合は何もしない
      }
      
      // lz-stringで解凍
      const decompressed = LZString.decompressFromEncodedURIComponent(hash);
      
      if (!decompressed) {
        console.warn('データの解凍に失敗、もしくは無効なデータです');
        return false;
      }
      
      // JSONをパース
      const saveData = JSON.parse(decompressed);
      
      // マネージャーに渡して復元してもらう
      this.circuitManager.restoreFromData(saveData);
      
      console.log(`URLから回路を復元しました: パーツ${this.circuitManager.parts.length}個, ワイヤー${this.circuitManager.wires.length}本`);
      // 復元成功時はアラートを出さず、静かに開始（モダンなUX）
      
      return true;
    } catch (error) {
      console.error('URLからの復元中にエラーが発生しました:', error);
      alert(CONST.MESSAGES.ALERT_URL_RESTORE_FAILED + ': ' + error.message);
      return false;
    }
  }
}
