import { MediaClassifier } from './MediaClassifier.js';

/**
 * DownloadService
 * Single Responsibility: Manages download execution, stream delegation, and error handling.
 */
export class DownloadService {
  /**
   * @param {import('./HeaderRuleService.js').HeaderRuleService} headerRuleService
   * @param {import('./StorageService.js').StorageService} [storageService]
   */
  constructor(headerRuleService, storageService) {
    this.headerRuleService = headerRuleService;
    this.storageService = storageService;
  }

  /**
   * Resolves the best non-blob media item for a given tab
   * @param {number} tabId
   * @returns {Promise<Object|null>}
   */
  async resolveActiveTabMedia(tabId) {
    if (!tabId || !this.storageService) return null;
    const tabMedia = await this.storageService.getTabMedia(tabId);
    if (!tabMedia || tabMedia.length === 0) return null;

    // Prefer video streams (M3U8 / MP4), skip subtitles and blob URLs
    const bestStream = tabMedia.find((m) => !MediaClassifier.isBlobUrl(m.url) && !m.isSubtitle);
    return bestStream || tabMedia[0];
  }

  /**
   * Executes or routes a download request for a media item
   * @param {Object} options
   * @param {string} options.url
   * @param {string} options.title
   * @param {string} options.format
   * @param {string} options.pageUrl
   * @param {string} [options.referer]
   * @param {number} [options.tabId]
   * @returns {Promise<{success: boolean, downloadId?: number, openedDownloader?: boolean, error?: string}>}
   */
  async executeDownload({ url, title, format, pageUrl, referer, tabId }) {
    let effectiveUrl = url;
    let effectiveTitle = title || 'video';
    let effectiveFormat = format;
    let effectiveReferer = referer || pageUrl || '';

    // If an in-memory MSE Blob URL was passed, resolve the actual network stream captured for this tab
    if (MediaClassifier.isBlobUrl(effectiveUrl) || !effectiveUrl) {
      if (tabId) {
        const resolved = await this.resolveActiveTabMedia(tabId);
        if (resolved) {
          effectiveUrl = resolved.url;
          effectiveTitle = resolved.title || effectiveTitle;
          effectiveFormat = resolved.format || effectiveFormat;
          effectiveReferer = resolved.referer || resolved.pageUrl || effectiveReferer;
        }
      }
    }

    if (!effectiveUrl || MediaClassifier.isBlobUrl(effectiveUrl)) {
      return {
        success: false,
        error: 'Video akış bağlantısı henüz yakalanamadı. Lütfen videoyu 1-2 saniye oynatın.'
      };
    }

    const isHls = MediaClassifier.isHlsStream(effectiveFormat, effectiveUrl);

    // Apply DNR header rules BEFORE routing to ensure playlists, segments, or direct downloads have valid Referer
    if (this.headerRuleService && effectiveReferer) {
      await this.headerRuleService.applyRefererRule(effectiveUrl, effectiveReferer);
    }

    // Route HLS / M3U8 streams to dedicated segment downloader
    if (isHls) {
      const hlsUrl = chrome.runtime.getURL(
        `hls-downloader/downloader.html?url=${encodeURIComponent(effectiveUrl)}&title=${encodeURIComponent(effectiveTitle)}&referer=${encodeURIComponent(effectiveReferer)}`
      );
      await chrome.tabs.create({ url: hlsUrl });
      return { success: true, openedDownloader: true };
    }

    const fallbackExt = (effectiveFormat || 'mp4').toLowerCase();
    const cleanFilename = MediaClassifier.sanitizeFilename(effectiveTitle, fallbackExt);

    // Standard download via chrome.downloads
    const downloadOptions = {
      url: effectiveUrl,
      filename: cleanFilename,
      saveAs: false,
      conflictAction: 'uniquify'
    };

    return new Promise((resolve) => {
      chrome.downloads.download(downloadOptions, async (downloadId) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          console.warn('DownloadService: chrome.downloads failed, attempting fallback fetch download:', errorMsg);

          // Fallback: Fetch via background fetcher to bypass hotlinking or CORS blocks, then save Blob URL
          try {
            const resp = await fetch(effectiveUrl);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const localBlobUrl = URL.createObjectURL(blob);

            chrome.downloads.download(
              {
                url: localBlobUrl,
                filename: cleanFilename,
                saveAs: false
              },
              (fallbackDownloadId) => {
                if (chrome.runtime.lastError) {
                  resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                  resolve({ success: true, downloadId: fallbackDownloadId });
                }
              }
            );
          } catch (fetchError) {
            resolve({ success: false, error: `İndirme hatası: ${fetchError.message}` });
          }
        } else {
          resolve({ success: true, downloadId });
        }
      });
    });
  }
}
