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
    this.downloadService = new DownloadService(this.headerRuleService, this.storageService);
    this.mediaSnifferService = new MediaSnifferService(this.storageService);
    this.activeDownloadTasks = new Map();
  }

  async ensureOffscreenDocument() {
    if (chrome.offscreen && (await chrome.offscreen.hasDocument?.())) return;
    try {
      if (chrome.offscreen && chrome.offscreen.createDocument) {
        await chrome.offscreen.createDocument({
          url: 'offscreen/offscreen.html',
          reasons: ['BLOBS', 'WORKERS'],
          justification: 'Background HLS stream downloading and video assembly'
        });
      }
    } catch (err) {
      if (!err.message?.includes('Only a single offscreen document may be created')) {
        console.warn('ServiceWorkerController: Failed creating offscreen document:', err);
      }
    }
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
    // Reset tab media on navigation start (active downloads are decoupled and persist)
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
      if (this.activeDownloadTasks.size > 0) {
        const lastTask = Array.from(this.activeDownloadTasks.values()).pop();
        chrome.action.setBadgeText({ text: `${lastTask.percent || 0}%` });
        chrome.action.setBadgeBackgroundColor({ color: '#0284c7' });
      } else {
        const mediaList = await this.storageService.getTabMedia(activeInfo.tabId);
        await this.storageService.updateBadge(activeInfo.tabId, mediaList.length);
      }
    });
  }

  registerMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      (async () => {
        try {
          const tabId = sender.tab ? sender.tab.id : message.tabId;

          switch (message.type) {
            case 'START_STREAM_DOWNLOAD': {
              await this.ensureOffscreenDocument();
              const item = message.item;
              const taskId = item.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

              this.activeDownloadTasks.set(taskId, {
                id: taskId,
                item: item,
                title: item.title,
                percent: 0,
                status: 'Başlatılıyor...',
                timestamp: Date.now()
              });

              chrome.action.setBadgeText({ text: '0%' });
              chrome.action.setBadgeBackgroundColor({ color: '#0284c7' });

              chrome.runtime
                .sendMessage({
                  target: 'offscreen',
                  type: 'EXECUTE_STREAM_DOWNLOAD',
                  taskId,
                  item
                })
                .catch((err) => console.warn('Failed delegating to offscreen:', err));

              sendResponse({ success: true, taskId });
              break;
            }

            case 'CANCEL_STREAM_DOWNLOAD': {
              const taskId = message.taskId;
              this.activeDownloadTasks.delete(taskId);

              chrome.runtime
                .sendMessage({
                  target: 'offscreen',
                  type: 'CANCEL_STREAM_DOWNLOAD',
                  taskId
                })
                .catch(() => {});

              if (this.activeDownloadTasks.size === 0) {
                chrome.action.setBadgeText({ text: '' });
              }

              sendResponse({ success: true, taskId });
              break;
            }

            case 'DOWNLOAD_TASK_CANCELLED': {
              this.activeDownloadTasks.delete(message.taskId);
              if (this.activeDownloadTasks.size === 0) {
                chrome.action.setBadgeText({ text: '' });
              }
              break;
            }

            case 'DOWNLOAD_TASK_PROGRESS': {
              const task = this.activeDownloadTasks.get(message.taskId) || { id: message.taskId, item: {} };
              task.percent = message.percent || 0;
              task.status = message.status || '';
              task.completedCount = message.completedCount || 0;
              task.totalSegments = message.totalSegments || 0;
              task.totalBytes = message.totalBytes || 0;
              this.activeDownloadTasks.set(message.taskId, task);

              chrome.action.setBadgeText({ text: `${task.percent}%` });
              chrome.action.setBadgeBackgroundColor({ color: '#0284c7' });
              break;
            }

            case 'DOWNLOAD_TASK_COMPLETE': {
              const task = this.activeDownloadTasks.get(message.taskId);
              if (task) {
                task.percent = 100;
                task.status = '✓ İndirildi!';
                task.completed = true;
              }
              chrome.action.setBadgeText({ text: '✓' });
              chrome.action.setBadgeBackgroundColor({ color: '#10b981' });

              setTimeout(async () => {
                this.activeDownloadTasks.delete(message.taskId);
                if (this.activeDownloadTasks.size === 0) {
                  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
                  if (activeTab && activeTab.id) {
                    const media = await this.storageService.getTabMedia(activeTab.id);
                    await this.storageService.updateBadge(activeTab.id, media.length);
                  } else {
                    chrome.action.setBadgeText({ text: '' });
                  }
                }
              }, 5000);
              break;
            }

            case 'DOWNLOAD_TASK_ERROR': {
              const task = this.activeDownloadTasks.get(message.taskId);
              if (task) {
                task.status = `Hata: ${message.error || 'Bilinmiyor'}`;
                task.error = true;
              }
              chrome.action.setBadgeText({ text: '!' });
              chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
              setTimeout(async () => {
                this.activeDownloadTasks.delete(message.taskId);
                chrome.action.setBadgeText({ text: '' });
              }, 6000);
              break;
            }

            case 'GET_ACTIVE_DOWNLOADS': {
              sendResponse({
                success: true,
                tasks: Array.from(this.activeDownloadTasks.values())
              });
              break;
            }

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

            case 'RESOLVE_ACTIVE_MEDIA_FOR_TAB': {
              const targetTabId = message.tabId || tabId;
              const media = await this.downloadService.resolveActiveTabMedia(targetTabId);
              sendResponse({ success: !!media, media });
              break;
            }

            case 'APPLY_HEADER_RULE': {
              if (message.mediaUrl && message.referer) {
                await this.headerRuleService.applyRefererRule(message.mediaUrl, message.referer);
                sendResponse({ success: true });
              } else {
                sendResponse({ success: false, error: 'Eksik parametreler.' });
              }
              break;
            }

            case 'DOWNLOAD_MEDIA': {
              const pageUrl = message.pageUrl || (sender.tab ? sender.tab.url : '');
              const result = await this.downloadService.executeDownload({
                url: message.url,
                title: message.title,
                format: message.format,
                pageUrl,
                referer: message.referer,
                tabId
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
