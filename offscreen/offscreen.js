/**
 * Offscreen Stream Download Controller
 * Single Responsibility: Executes long-running HLS stream downloads and blob assembly
 * in an isolated, persistent offscreen background document that survives popup closing and tab navigation.
 */

class OffscreenDownloadController {
  constructor() {
    this.activeEngines = new Map();
  }

  initialize() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.target !== "offscreen") return;

      switch (message.type) {
        case "EXECUTE_STREAM_DOWNLOAD":
          this.handleDownload(message.taskId, message.item);
          sendResponse({ success: true, taskId: message.taskId });
          break;

        case "CANCEL_STREAM_DOWNLOAD":
          this.handleCancel(message.taskId);
          sendResponse({ success: true });
          break;

        case "PING_OFFSCREEN":
          sendResponse({ success: true, activeTasks: Array.from(this.activeEngines.keys()) });
          break;
      }
      return true;
    });
  }

  async handleDownload(taskId, item) {
    if (!taskId || !item || !item.url) return;
    if (this.activeEngines.has(taskId)) return;

    const engine = new window.StreamDownloadEngine(6);
    this.activeEngines.set(taskId, engine);

    const onProgress = ({ percent, status, completedCount, totalSegments, totalBytes }) => {
      chrome.runtime
        .sendMessage({
          type: "DOWNLOAD_TASK_PROGRESS",
          taskId,
          percent,
          status,
          completedCount: completedCount || 0,
          totalSegments: totalSegments || 0,
          totalBytes: totalBytes || 0,
          title: item.title
        })
        .catch(() => {});
    };

    try {
      if (item.isSubtitle) {
        await engine.downloadSubtitle(item, onProgress);
      } else {
        await engine.downloadHlsStream(item, onProgress);
      }

      this.activeEngines.delete(taskId);

      chrome.runtime
        .sendMessage({
          type: "DOWNLOAD_TASK_COMPLETE",
          taskId,
          title: item.title
        })
        .catch(() => {});
    } catch (err) {
      console.error(`OffscreenDownloadController: Task ${taskId} failed:`, err);
      this.activeEngines.delete(taskId);

      chrome.runtime
        .sendMessage({
          type: "DOWNLOAD_TASK_ERROR",
          taskId,
          error: err.message,
          title: item.title
        })
        .catch(() => {});
    }
  }

  handleCancel(taskId) {
    if (this.activeEngines.has(taskId)) {
      this.activeEngines.delete(taskId);
      chrome.runtime
        .sendMessage({
          type: "DOWNLOAD_TASK_CANCELLED",
          taskId
        })
        .catch(() => {});
    }
  }
}

const controller = new OffscreenDownloadController();
controller.initialize();

