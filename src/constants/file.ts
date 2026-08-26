export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
] as const;

export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov'] as const;

export const ACCEPTED_IMAGE_TYPES = ALLOWED_IMAGE_EXTENSIONS.join(',');

export const ACCEPTED_DOCUMENT_TYPES = ALLOWED_DOCUMENT_EXTENSIONS.join(',');

export const ACCEPTED_VIDEO_TYPES = ALLOWED_VIDEO_EXTENSIONS.join(',');

export const ACCEPTED_ATTACHMENT_TYPES = [
  ...ALLOWED_DOCUMENT_EXTENSIONS,
  ...ALLOWED_VIDEO_EXTENSIONS,
].join(',');

export const ALL_ALLOWED_FILE_EXTENSIONS = [
  ...ALLOWED_IMAGE_EXTENSIONS,
  ...ALLOWED_DOCUMENT_EXTENSIONS,
  ...ALLOWED_VIDEO_EXTENSIONS,
] as const;
