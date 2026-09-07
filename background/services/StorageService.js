/**
 * StorageService
 * Single Responsibility: Manages persistence, session caching, and badge counter synchronization.
 */
export class StorageService {
  constructor() {
    this.storage = chrome.storage.session || chrome.storage.local;
  }

  /**
   * Retrieves detected media items for a specific tab
   * @param {number} tabId
   * @returns {Promise<Array>}
   */
  async getTabMedia(tabId) {
    if (!tabId || tabId < 0) return [];
    const key = `tab_${tabId}`;
    const data = await this.storage.get(key);
    return data[key] || [];
  }

  /**
   * Saves detected media items for a specific tab and updates the badge
   * @param {number} tabId
   * @param {Array} mediaList
   */
  async saveTabMedia(tabId, mediaList) {
    if (!tabId || tabId < 0) return;
    const key = `tab_${tabId}`;
    await this.storage.set({ [key]: mediaList });
    await this.updateBadge(tabId, mediaList.length);
  }

  /**
   * Clears media items for a closed or navigated tab
   * @param {number} tabId
   */
  async clearTabMedia(tabId) {
    if (!tabId || tabId < 0) return;
    const key = `tab_${tabId}`;
    await this.storage.remove(key);
    await this.updateBadge(tabId, 0);
  }

  /**
   * Updates the action badge counter for a specific tab
   * @param {number} tabId
   * @param {number} count
   */
  async updateBadge(tabId, count) {
    try {
      if (count > 0) {
        await chrome.action.setBadgeText({ text: String(count), tabId });
        await chrome.action.setBadgeBackgroundColor({ color: '#0284c7', tabId });
      } else {
        await chrome.action.setBadgeText({ text: '', tabId });
      }
    } catch {
      // Tab may have been closed or detached
    }
  }

  /**
   * Retrieves extension settings
   * @returns {Promise<Object>}
   */
  async getSettings() {
    return await chrome.storage.local.get({
      enableFloatingButton: true,
      minFileSize: '153600',
      namingPattern: 'title'
    });
  }
}
