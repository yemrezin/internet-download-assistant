/**
 * MediaClassifier
 * Single Responsibility: Parses MIME types and URLs to classify media formats and sanitize filenames.
 */
export class MediaClassifier {
  /**
   * Identifies media format from URL and MIME type
   * @param {string} url
   * @param {string} mimeType
   * @returns {string}
   */
  static detectFormat(url = '', mimeType = '') {
    const mime = mimeType.toLowerCase();
    const cleanUrl = url.split('?')[0].toLowerCase();

    // Subtitle detection
    if (mime.includes('vtt') || cleanUrl.endsWith('.vtt')) return 'VTT';
    if (mime.includes('subrip') || cleanUrl.endsWith('.srt')) return 'SRT';
    if (mime.includes('ttml') || cleanUrl.endsWith('.ttml') || cleanUrl.endsWith('.dfxp')) return 'TTML';
    if (url.includes('/timedtext')) return 'VTT';

    // HLS / M3U8 detection (including disguised playlists like /hls/ or master.txt)
    if (
      mime.includes('mpegurl') ||
      mime.includes('application/x-mpegurl') ||
      mime.includes('application/vnd.apple.mpegurl') ||
      cleanUrl.endsWith('.m3u8') ||
      url.includes('.m3u8') ||
      url.includes('/hls/') ||
      url.includes('/master.') ||
      url.includes('/playlist.') ||
      url.includes('master.txt') ||
      url.includes('sublist_') ||
      url.includes('playlist.txt')
    ) {
      return 'M3U8';
    }

    // DASH detection
    if (mime.includes('dash+xml') || cleanUrl.endsWith('.mpd') || url.includes('/dash/')) return 'MPD';

    // Video formats
    if (mime.includes('mp4') || cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.m4v')) return 'MP4';
    if (mime.includes('webm') || cleanUrl.endsWith('.webm')) return 'WEBM';
    if (mime.includes('x-matroska') || cleanUrl.endsWith('.mkv')) return 'MKV';
    if (mime.includes('quicktime') || cleanUrl.endsWith('.mov')) return 'MOV';
    if (mime.includes('x-flv') || cleanUrl.endsWith('.flv')) return 'FLV';
    if (mime.includes('mp2t') || cleanUrl.endsWith('.ts')) return 'TS';

    // Audio formats
    if (mime.includes('audio/mpeg') || cleanUrl.endsWith('.mp3')) return 'MP3';
    if (mime.includes('audio/aac') || cleanUrl.endsWith('.aac')) return 'AAC';
    if (mime.includes('audio/mp4') || cleanUrl.endsWith('.m4a')) return 'M4A';
    if (mime.includes('audio/ogg') || cleanUrl.endsWith('.ogg')) return 'OGG';
    if (mime.includes('audio/wav') || cleanUrl.endsWith('.wav')) return 'WAV';
    if (mime.startsWith('audio/')) return 'SES';

    return 'MP4';
  }

  /**
   * Checks if an item represents a subtitle file
   * @param {string} format
   * @param {string} mimeType
   * @returns {boolean}
   */
  static isSubtitle(format = '', mimeType = '') {
    const f = format.toUpperCase();
    return f === 'VTT' || f === 'SRT' || f === 'TTML' || mimeType.includes('vtt') || mimeType.includes('subrip');
  }

  /**
   * Checks if an item represents an HLS / M3U8 stream
   * @param {string} format
   * @param {string} url
   * @returns {boolean}
   */
  static isHlsStream(format = '', url = '') {
    const f = (format || '').toUpperCase();
    const u = (url || '').toLowerCase();
    return (
      f === 'M3U8' ||
      u.includes('.m3u8') ||
      u.includes('/hls/') ||
      u.includes('/master.') ||
      u.includes('/playlist.') ||
      u.includes('master.txt') ||
      u.includes('sublist_') ||
      u.includes('playlist.txt')
    );
  }

  /**
   * Checks if a URL is an in-memory MSE Blob object URL
   * @param {string} url
   * @returns {boolean}
   */
  static isBlobUrl(url = '') {
    return typeof url === 'string' && url.startsWith('blob:');
  }

  /**
   * Checks if a URL represents a single HLS/DASH segment chunk (not a playable playlist or full video)
   * @param {string} url
   * @param {string} mimeType
   * @returns {boolean}
   */
  static isSegmentChunk(url = '', mimeType = '') {
    const u = (url || '').toLowerCase();
    const mime = (mimeType || '').toLowerCase();

    // Any image MIME type is either a thumbnail or disguised TS segment (e.g. image2_0.jpg)
    if (mime.startsWith('image/')) {
      return true;
    }

    // Common segment chunk naming patterns
    if (
      /image\w*_\d+\.(jpg|ts|png|m4s|jpeg|bin)/i.test(u) ||
      /segment[-_]?\d+\.(ts|m4s|mp4|aac)/i.test(u) ||
      /chunk[-_]?\d+\.(ts|m4s|m4a|m4v)/i.test(u) ||
      /frag[-_]?\d+\.(ts|m4s)/i.test(u) ||
      /seg[-_]?\d+\.(ts|m4s)/i.test(u) ||
      /imageaud\w*_\d+/i.test(u) ||
      /_\d+\.ts$/i.test(u) ||
      /-\d+\.ts$/i.test(u) ||
      /\/\d+\.ts(\?|$)/i.test(u) ||
      /range=\d+-\d+/i.test(u) ||
      /bytes=\d+-\d+/i.test(u)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Checks if a URL represents a master playlist that aggregates all resolution variants
   * @param {string} url
   * @returns {boolean}
   */
  static isMasterPlaylist(url = '') {
    const u = (url || '').toLowerCase();
    return (
      u.includes('master.txt') ||
      u.includes('master.m3u8') ||
      u.includes('/master.') ||
      u.includes('playlist.m3u8') ||
      u.includes('index.m3u8')
    );
  }

  /**
   * Checks if a URL is a secondary sublist (e.g. sublist_2.txt, sublist_aud1.txt)
   * @param {string} url
   * @returns {boolean}
   */
  static isSublist(url = '') {
    const u = (url || '').toLowerCase();
    return (
      u.includes('sublist_') ||
      u.includes('variant_') ||
      (u.includes('sublist') && u.endsWith('.txt')) ||
      (u.includes('quality_') && u.includes('.m3u8'))
    );
  }

  /**
   * Estimates total HLS video size based on bandwidth and duration
   * @param {number} bandwidthBps - Bandwidth in bits per second
   * @param {number} durationSeconds - Duration in seconds
   * @param {string} quality - Quality label (e.g. 1080p, 720p)
   * @returns {string}
   */
  static estimateHlsSize(bandwidthBps = 0, durationSeconds = 0, quality = '') {
    // If exact duration and bandwidth are available, calculate exact estimation
    if (bandwidthBps > 0 && durationSeconds > 0) {
      const totalBytes = Math.round((bandwidthBps / 8) * durationSeconds);
      return `~${MediaClassifier.formatBytes(totalBytes)}`;
    }

    // If duration is available (e.g. 1h 45m = 6300s):
    if (durationSeconds > 0) {
      let bps = 2800000; // ~2.8 Mbps for 1080p Full HD
      if (quality.includes('720')) bps = 1600000;
      else if (quality.includes('480')) bps = 900000;
      else if (quality.includes('4K') || quality.includes('2160')) bps = 8000000;
      const totalBytes = Math.round((bps / 8) * durationSeconds);
      return `~${MediaClassifier.formatBytes(totalBytes)}`;
    }

    // Realistic fallback for movie/stream
    if (quality.includes('720')) return '~1.1 - 1.4 GB';
    if (quality.includes('480')) return '~600 - 800 MB';
    if (quality.includes('4K')) return '~5.5 - 8.0 GB';
    return '~1.8 - 2.4 GB (Full HD)';
  }

  /**
   * Formats raw byte count to readable string (e.g. 14.5 MB)
   * @param {number} bytes
   * @returns {string}
   */
  static formatBytes(bytes) {
    if (!bytes || isNaN(bytes) || bytes <= 0) return 'Bilinmiyor';
    const k = 1024;
    const sizes = ['Bayt', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Sanitizes string to produce a safe filesystem filename
   * @param {string} rawTitle
   * @param {string} fallbackExtension
   * @returns {string}
   */
  static sanitizeFilename(rawTitle = '', fallbackExtension = 'mp4') {
    if (!rawTitle || typeof rawTitle !== 'string') {
      return `media_${Date.now()}.${fallbackExtension}`;
    }

    let clean = rawTitle.replace(/[/\\?%*:|"<>]/g, '_').trim();
    clean = clean.replace(/\s+/g, ' ');

    if (clean.length > 90) {
      clean = clean.substring(0, 90);
    }

    if (!clean.includes('.')) {
      clean = `${clean}.${fallbackExtension}`;
    }

    return clean;
  }
}
