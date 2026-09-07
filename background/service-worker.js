import { StorageService } from './services/StorageService.js';
import { HeaderRuleService } from './services/HeaderRuleService.js';
import { DownloadService } from './services/DownloadService.js';
import { MediaSnifferService } from './services/MediaSnifferService.js';

/**
 * ServiceWorker Controller
 * Composition root orchestrating services, tab lifecycle, and inter-process messaging.
 */
class ServiceWorkerController {
  constructor() {
    this.storageService = new StorageService();
    this.headerRuleService = new HeaderRuleService();
    this.downloadService = new DownloadService(this.headerRuleService);
    this.mediaSnifferService = new MediaSnifferService(this.storageService);
  }

  initialize() {
    // Start passive network sniffing
    this.mediaSnifferService.startListening();

    // Register tab event listeners
    this.registerTabListeners();

    // Register message passing handler
    this.registerMessageHandlers();
  }

  registerTabListeners() {
    // Reset tab media on navigation start
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
      if (changeInfo.status === 'loading' && changeInfo.url) {
        await this.storageService.clearTabMedia(tabId);
      }
    });

    // Cleanup when tab is closed
    chrome.tabs.onRemoved.addListener(async (tabId) => {
      await this.storageService.clearTabMedia(tabId);
    });

    // Refresh action badge on tab switch
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      const mediaList = await this.storageService.getTabMedia(activeInfo.tabId);
      await this.storageService.updateBadge(activeInfo.tabId, mediaList.length);
    });
  }

  registerMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      (async () => {
        try {
          const tabId = sender.tab ? sender.tab.id : message.tabId;

          switch (message.type) {
            case 'REGISTER_DOM_MEDIA': {
              if (tabId && message.media) {
                await this.mediaSnifferService.registerMedia(tabId, {
                  ...message.media,
                  source: 'dom'
                });
                sendResponse({ success: true });
              }
              break;
            }

            case 'GET_TAB_MEDIA': {
              const targetTabId = message.tabId || tabId;
              const media = await this.storageService.getTabMedia(targetTabId);
              sendResponse({ success: true, media });
              break;
            }

            case 'DOWNLOAD_MEDIA': {
              const pageUrl = message.pageUrl || (sender.tab ? sender.tab.url : '');
              const result = await this.downloadService.executeDownload({
                url: message.url,
                title: message.title,
                format: message.format,
                pageUrl
              });
              sendResponse(result);
              break;
            }

            case 'CLEAR_TAB_MEDIA': {
              if (tabId) {
                await this.storageService.clearTabMedia(tabId);
                sendResponse({ success: true });
              }
              break;
            }

            default:
              sendResponse({ success: false, error: 'Bilinmeyen işlem türü.' });
          }
        } catch (error) {
          console.error('ServiceWorkerController: Request error:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();

      return true; // Keep asynchronous channel open
    });
  }
}

const controller = new ServiceWorkerController();
controller.initialize();
