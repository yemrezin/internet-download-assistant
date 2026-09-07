/**
 * Content Script Entry Point
 * Wires together PlayerLocator, VideoOverlayPresenter, and DomMediaScanner.
 */
(function () {
  const overlayPresenter = new window.VideoOverlayPresenter();
  const mediaScanner = new window.DomMediaScanner(overlayPresenter);

  // Start observing and scanning DOM
  mediaScanner.startObserving();

  // Listen for manual trigger from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCAN_PAGE_MEDIA') {
      mediaScanner.scanAll();
      sendResponse({ success: true, count: mediaScanner.discoveredUrls.size });
    }
    return true;
  });
})();
