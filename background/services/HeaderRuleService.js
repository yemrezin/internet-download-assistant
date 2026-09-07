/**
 * HeaderRuleService
 * Single Responsibility: Manages declarativeNetRequest dynamic rules to safely attach
 * Referer and Origin headers at the network level, preventing hotlink 403 blocks and
 * eliminating "Unsafe request header name" API errors.
 */
export class HeaderRuleService {
  constructor() {
    this.RULE_ID_UNIVERSAL = 8801;
  }

  /**
   * Applies Referer, Origin, and CORS headers for media requests across all CDN domains
   * @param {string} mediaUrl - The media file or playlist URL being requested
   * @param {string} refererUrl - The originating web page or iframe URL
   */
  async applyRefererRule(mediaUrl, refererUrl) {
    if (!chrome.declarativeNetRequest || !refererUrl) return;

    try {
      let refererOrigin = '';
      try {
        refererOrigin = new URL(refererUrl).origin;
      } catch {
        refererOrigin = refererUrl;
      }

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [this.RULE_ID_UNIVERSAL, 8802],
        addRules: [
          {
            id: this.RULE_ID_UNIVERSAL,
            priority: 100,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [
                { header: 'Referer', operation: 'set', value: refererUrl },
                { header: 'Origin', operation: 'set', value: refererOrigin }
              ],
              responseHeaders: [
                { header: 'Access-Control-Allow-Origin', operation: 'set', value: '*' },
                { header: 'Access-Control-Allow-Methods', operation: 'set', value: 'GET, HEAD, OPTIONS' },
                { header: 'Access-Control-Allow-Headers', operation: 'set', value: '*' }
              ]
            },
            condition: {
              urlFilter: '*'
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
        removeRuleIds: [this.RULE_ID_UNIVERSAL, 8802]
      });
    } catch {
      // Ignored
    }
  }
}
