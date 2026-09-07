/**
 * HeaderRuleService
 * Single Responsibility: Manages declarativeNetRequest dynamic rules to safely attach
 * Referer and Origin headers at the network level, preventing hotlink 403 blocks and
 * eliminating "Unsafe request header name" API errors.
 */
export class HeaderRuleService {
  constructor() {
    this.RULE_ID = 8801;
  }

  /**
   * Applies Referer and Origin request headers for a target media domain
   * @param {string} mediaUrl - The media file URL being requested
   * @param {string} pageUrl - The originating web page URL
   */
  async applyRefererRule(mediaUrl, pageUrl) {
    if (!chrome.declarativeNetRequest || !mediaUrl || !pageUrl) return;

    try {
      const mediaDomain = new URL(mediaUrl).hostname;
      const pageOrigin = new URL(pageUrl).origin;

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [this.RULE_ID],
        addRules: [
          {
            id: this.RULE_ID,
            priority: 2,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [
                { header: 'Referer', operation: 'set', value: pageUrl },
                { header: 'Origin', operation: 'set', value: pageOrigin }
              ]
            },
            condition: {
              urlFilter: mediaDomain,
              resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'media', 'other']
            }
          }
        ]
      });
    } catch (error) {
      console.warn('HeaderRuleService: Failed to apply dynamic header rule:', error);
    }
  }

  /**
   * Clears existing dynamic rules
   */
  async clearRules() {
    if (!chrome.declarativeNetRequest) return;
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [this.RULE_ID]
      });
    } catch {
      // Ignored
    }
  }
}
