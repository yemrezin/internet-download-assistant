/**
 * HeaderRuleService
 * Single Responsibility: Manages declarativeNetRequest dynamic rules strictly scoped to
 * specific media CDN domains to attach required Referer and Origin headers, preventing hotlink
 * 403 blocks while ensuring zero side effects on normal browsing (YouTube, Google, etc.).
 */
export class HeaderRuleService {
  constructor() {
    this.BASE_RULE_ID = 8800;
  }

  /**
   * Completely clears all existing dynamic declarativeNetRequest rules
   */
  async clearRules() {
    if (!chrome.declarativeNetRequest) return;
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map((r) => r.id);
      // Always include legacy IDs 8801, 8802 to purge rogue wildcard rules
      const allIdsToRemove = Array.from(new Set([...ruleIds, 8801, 8802]));
      if (allIdsToRemove.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: allIdsToRemove
        });
      }
    } catch (err) {
      console.warn('HeaderRuleService: Failed to clear dynamic rules:', err);
    }
  }

  /**
   * Applies Referer and Origin headers strictly to the target media domain
   * @param {string} mediaUrl - The media file or playlist URL being requested
   * @param {string} refererUrl - The originating web page or iframe URL
   */
  async applyRefererRule(mediaUrl, refererUrl) {
    if (!chrome.declarativeNetRequest || !mediaUrl || !refererUrl) return;

    let targetDomain = '';
    try {
      targetDomain = new URL(mediaUrl).hostname.toLowerCase();
    } catch {
      return;
    }

    if (!targetDomain) return;

    // Safety Guard: NEVER modify headers for YouTube, Google, or other core web services
    const protectedDomains = [
      'youtube.com',
      'googlevideo.com',
      'google.com',
      'gstatic.com',
      'ytimg.com',
      'googleapis.com',
      'netflix.com',
      'facebook.com',
      'instagram.com'
    ];

    if (protectedDomains.some((d) => targetDomain === d || targetDomain.endsWith(`.${d}`))) {
      return;
    }

    try {
      let refererOrigin = '';
      try {
        refererOrigin = new URL(refererUrl).origin;
      } catch {
        refererOrigin = refererUrl;
      }

      // Calculate a stable rule ID for this target domain
      let hash = 0;
      for (let i = 0; i < targetDomain.length; i++) {
        hash = (hash * 31 + targetDomain.charCodeAt(i)) % 90;
      }
      const ruleId = this.BASE_RULE_ID + 1 + Math.abs(hash);

      // Extract base domain to cover related subdomains if applicable
      const parts = targetDomain.split('.');
      const baseDomain = parts.length > 2 ? parts.slice(-2).join('.') : targetDomain;
      const requestDomains = Array.from(new Set([targetDomain, baseDomain]));

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [ruleId, 8801, 8802],
        addRules: [
          {
            id: ruleId,
            priority: 1,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [
                { header: 'Referer', operation: 'set', value: refererUrl },
                { header: 'Origin', operation: 'set', value: refererOrigin }
              ]
              // CRITICAL: NEVER modify responseHeaders or inject Access-Control-Allow-Origin: *
              // Doing so breaks credentialed/authenticated fetch requests across the browser (e.g. YouTube).
            },
            condition: {
              requestDomains: requestDomains,
              resourceTypes: ['xmlhttprequest', 'media', 'other']
            }
          }
        ]
      });
    } catch (error) {
      console.warn('HeaderRuleService: Failed to apply scoped dynamic header rule:', error);
    }
  }
}
