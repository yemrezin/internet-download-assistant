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
