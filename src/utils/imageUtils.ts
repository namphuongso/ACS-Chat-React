/**
 * Threshold in bytes for an image to be considered "large" (10 MB).
 * Images with file size >= 10MB will be sent as individual standalone messages.
 */
export const LARGE_IMAGE_SIZE_THRESHOLD = 10 * 1024 * 1024; // 10MB

/**
 * Helper to determine if an image is considered a "large image" (by file size)
 * that should be sent in its own separate message.
 *
 * @param fileOrSize File object or size in bytes
 * @param threshold Optional custom threshold in bytes (default: 10MB)
 * @returns boolean true if file size >= threshold
 */
export const isLargeImage = (
  fileOrSize?: File | { size?: number } | number | null,
  threshold: number = LARGE_IMAGE_SIZE_THRESHOLD
): boolean => {
  if (!fileOrSize) return false;
  const size = typeof fileOrSize === 'number' ? fileOrSize : fileOrSize.size;
  if (typeof size !== 'number' || isNaN(size) || size <= 0) return false;
  return size >= threshold;
};

/**
 * Format bytes to readable string (e.g. 100.36 MB, 12.50 MB, 500 KB)
 *
 * @param bytes Size in bytes
 * @returns Formatted size string
 */
export const formatFileSize = (bytes?: number | string | null): string => {
  if (bytes === undefined || bytes === null || bytes === '') return '';
  const num = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
  if (isNaN(num) || num <= 0) return '0 B';

  const k = 1024;
  if (num < k) return `${num} B`;
  if (num < k * k) return `${(num / k).toFixed(2)} KB`;
  if (num < k * k * k) return `${(num / (k * k)).toFixed(2)} MB`;
  return `${(num / (k * k * k)).toFixed(2)} GB`;
};

/**
 * Infer or retrieve the image MIME type based on file name or provided explicit MIME type.
 *
 * @param fileName File name or URL
 * @param explicitMime Explicit MIME type if already known
 * @param defaultMime Default MIME type if not determinable (default: 'image/jpeg')
 * @returns MIME type string
 */
export const getImageMimeType = (
  fileName?: string,
  explicitMime?: string,
  defaultMime: string = 'image/jpeg'
): string => {
  if (explicitMime && explicitMime.toLowerCase().startsWith('image/')) {
    return explicitMime;
  }
  if (fileName) {
    const clean = fileName.split('?')[0].split('#')[0].toLowerCase();
    if (clean.endsWith('.png')) return 'image/png';
    if (clean.endsWith('.webp')) return 'image/webp';
    if (clean.endsWith('.gif')) return 'image/gif';
    if (clean.endsWith('.svg')) return 'image/svg+xml';
    if (clean.endsWith('.bmp')) return 'image/bmp';
    if (clean.endsWith('.ico')) return 'image/x-icon';
    if (clean.endsWith('.tiff') || clean.endsWith('.tif')) return 'image/tiff';
    if (clean.endsWith('.avif')) return 'image/avif';
    if (clean.endsWith('.heic')) return 'image/heic';
    if (clean.endsWith('.heif')) return 'image/heif';
    if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  }
  return explicitMime || defaultMime;
};


