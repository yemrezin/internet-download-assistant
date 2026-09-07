import { MediaClassifier } from './MediaClassifier.js';

/**
 * DownloadService
 * Single Responsibility: Manages download execution, stream delegation, and error handling.
 */
export class DownloadService {
  /**
   * @param {import('./HeaderRuleService.js').HeaderRuleService} headerRuleService
   */
  constructor(headerRuleService) {
    this.headerRuleService = headerRuleService;
  }

  /**
   * Executes or routes a download request for a media item
   * @param {Object} options
   * @param {string} options.url
   * @param {string} options.title
   * @param {string} options.format
   * @param {string} options.pageUrl
   * @returns {Promise<{success: boolean, downloadId?: number, openedDownloader?: boolean, error?: string}>}
   */
  async executeDownload({ url, title, format, pageUrl }) {
    if (!url) {
      return { success: false, error: 'İndirme adresi boş olamaz.' };
    }

    const isHls = MediaClassifier.isHlsStream(format, url);

    // Route HLS / M3U8 streams to the dedicated segment downloader
    if (isHls) {
      const hlsUrl = chrome.runtime.getURL(
        `hls-downloader/downloader.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title || 'video')}&referer=${encodeURIComponent(pageUrl || '')}`
      );
      await chrome.tabs.create({ url: hlsUrl });
      return { success: true, openedDownloader: true };
    }

    // Safely inject Referer/Origin headers at the network layer via declarativeNetRequest
    if (pageUrl && this.headerRuleService) {
      await this.headerRuleService.applyRefererRule(url, pageUrl);
    }

    const fallbackExt = (format || 'mp4').toLowerCase();
    const cleanFilename = MediaClassifier.sanitizeFilename(title, fallbackExt);

    // IMPORTANT: Do NOT pass 'Referer' or 'Origin' in downloadOptions.headers!
    // Chromium forbids them and throws "Unsafe request header name".
    // HeaderRuleService already injects them safely via DeclarativeNetRequest.
    const downloadOptions = {
      url: url,
      filename: cleanFilename,
      saveAs: false,
      conflictAction: 'uniquify'
    };

    return new Promise((resolve) => {
      chrome.downloads.download(downloadOptions, (downloadId) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          console.warn('DownloadService: Download failed:', errorMsg);
          resolve({ success: false, error: errorMsg });
        } else {
          resolve({ success: true, downloadId });
        }
      });
    });
  }
}
