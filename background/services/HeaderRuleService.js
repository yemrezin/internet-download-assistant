/**
 * HeaderRuleService
 * Single Responsibility: Manages declarativeNetRequest dynamic rules to safely attach
 * Referer and Origin headers at the network level, preventing hotlink 403 blocks and
 * eliminating "Unsafe request header name" API errors.
 */
export class HeaderRuleService {
  constructor() {
    this.RULE_ID_TARGET = 8801;
    this.RULE_ID_EXTENSION = 8802;
  }

  /**
   * Applies Referer, Origin, and CORS headers for media requests
   * @param {string} mediaUrl - The media file or playlist URL being requested
   * @param {string} refererUrl - The originating web page or iframe URL
   */
  async applyRefererRule(mediaUrl, refererUrl) {
    if (!chrome.declarativeNetRequest || !refererUrl) return;

    try {
      let mediaDomain = '';
      try {
        if (mediaUrl && !mediaUrl.startsWith('blob:') && !mediaUrl.startsWith('data:')) {
          mediaDomain = new URL(mediaUrl).hostname;
        }
      } catch {
        mediaDomain = '';
      }

      let refererOrigin = '';
      try {
        refererOrigin = new URL(refererUrl).origin;
      } catch {
        refererOrigin = refererUrl;
      }

      const rulesToAdd = [];

      // Rule 1: Target media domain rule (applies to browser downloads and network requests)
      if (mediaDomain) {
        rulesToAdd.push({
          id: this.RULE_ID_TARGET,
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
            urlFilter: `||${mediaDomain}`
          }
        });
      }

      // Rule 2: Universal rule for requests initiated by our extension (e.g. downloader.html or background)
      if (chrome.runtime && chrome.runtime.id) {
        rulesToAdd.push({
          id: this.RULE_ID_EXTENSION,
          priority: 90,
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
            initiatorDomains: [chrome.runtime.id]
          }
        });
      }

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [this.RULE_ID_TARGET, this.RULE_ID_EXTENSION],
        addRules: rulesToAdd
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
        removeRuleIds: [this.RULE_ID_TARGET, this.RULE_ID_EXTENSION]
      });
    } catch {
      // Ignored
    }
  }
}
