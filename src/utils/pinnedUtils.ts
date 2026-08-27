import type { PinnedMessage, ChatMessage } from '../types/message.types';
import { getDocumentFileType, resolveMessageFileMetadata } from './fileUtils';
import { extractUrls } from './linkUtils';
import { logger } from './logger';

export type PinnedCategory =
  | 'video'
  | 'large_image'
  | 'image'
  | 'album'
  | 'excel'
  | 'ppt'
  | 'doc'
  | 'pdf'
  | 'file'
  | 'link'
  | 'text';

export interface PinnedClassification {
  category: PinnedCategory;
  fileName: string;
  url: string;
  thumbUrl: string;
  content: string;
}

const VIDEO_EXTENSION_RE = /\.(mp4|mov|webm|m4v|avi|mkv|3gp|flv|wmv)$/i;
const IMAGE_EXTENSION_RE = /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff|avif|heic)$/i;
const EXCEL_EXTENSION_RE = /\.(xlsx?|csv)$/i;
const PPT_EXTENSION_RE = /\.(pptx?|ppsx?)$/i;
const DOC_EXTENSION_RE = /\.(docx?)$/i;
const PDF_EXTENSION_RE = /\.pdf$/i;
const GENERIC_FILE_EXTENSION_RE = /\.(zip|rar|7z|tar|gz|txt|json|md|xml|yaml|yml)$/i;

/** Map of conversation message arrays (as stored in the message store). */
export type MessagesByConversationMap = Record<string, { messages?: ChatMessage[] }>;

/**
 * Builds an index of messages by id (and clientMessageId) so that classifying
 * pinned messages runs in O(1) per message instead of O(n x m) scans.
 */
export function indexMessagesByConversation(
  messagesByConversationMap?: MessagesByConversationMap
): Map<string, ChatMessage> {
  const index = new Map<string, ChatMessage>();
  if (!messagesByConversationMap) return index;

  for (const conv of Object.values(messagesByConversationMap)) {
    const messages = conv?.messages;
    if (!messages) continue;
    for (const m of messages) {
      if (m.id) index.set(m.id, m);
      if (m.clientMessageId) index.set(m.clientMessageId, m);
    }
  }
  return index;
}

/** Input context extracted from the message store (if the message can be found). */
interface StoreContext {
  fileName: string;
  url: string;
  thumbUrl: string;
  type: string;
  attachmentType: string;
  content: string;
}

/**
 * Resolves metadata for a pinned message from the message store.
 * When a pre-built index is provided, lookups are O(1); otherwise the index
 * is built on demand.
 */
function resolveStoreContext(
  msg: PinnedMessage,
  messagesByConversationMap?: MessagesByConversationMap,
  index?: Map<string, ChatMessage>
): StoreContext {
  const empty: StoreContext = {
    fileName: '',
    url: '',
    thumbUrl: '',
    type: '',
    attachmentType: '',
    content: '',
  };
  if (!msg.messageId || !messagesByConversationMap) return empty;

  try {
    const found = (index ?? indexMessagesByConversation(messagesByConversationMap)).get(
      msg.messageId
    );
    if (!found) return empty;

    const fileMeta = resolveMessageFileMetadata({
      meta: found.metadata,
      attachments: found.attachments,
      content: found.content,
      type: found.type,
    });

    return {
      fileName: fileMeta.fileName,
      url: fileMeta.url,
      thumbUrl: fileMeta.thumbUrl,
      attachmentType: fileMeta.mimeType,
      type:
        fileMeta.resolvedType !== 'text'
          ? fileMeta.resolvedType
          : (found.metadata?.type as string) ||
            (fileMeta.firstFile ? 'image' : '') ||
            found.type ||
            '',
      content: found.content || '',
    };
  } catch (error) {
    logger.warn(
      `[pinnedUtils] Failed to resolve metadata for pinned message ${msg.messageId}`,
      error
    );
    return empty;
  }
}

/** All resolved inputs that classification helpers need. */
interface ClassificationInput {
  content: string;
  attachmentUrl: string;
  fileName: string;
  effectiveType: string;
  effectiveAttachmentType: string;
  effectiveUrl: string;
  effectiveThumbUrl: string;
}

/** Normalizes raw message fields + store context into shared classification inputs. */
function buildClassificationInput(
  msg: PinnedMessage,
  store: StoreContext
): ClassificationInput {
  const content = msg.content || '';
  const attachmentUrl = msg.attachmentUrl || '';
  const thumbUrl = msg.thumbUrl || '';

  const effectiveContent = content || store.content || store.fileName;
  const effectiveType = (
    msg.type && msg.type.toLowerCase() !== 'text' && msg.type.toLowerCase() !== ''
      ? msg.type
      : store.type || msg.type || 'text'
  ).toLowerCase();
  const effectiveAttachmentType = (msg.attachmentType || store.attachmentType || '').toLowerCase();

  // Extract a plausible file name
  let fileName = content || store.fileName;
  if (
    !fileName ||
    fileName.startsWith('http://') ||
    fileName.startsWith('https://') ||
    fileName.startsWith('blob:') ||
    fileName.includes('\n')
  ) {
    if (store.fileName) {
      fileName = store.fileName;
    } else if (attachmentUrl || store.url) {
      const targetUrl = attachmentUrl || store.url;
      const urlParts = targetUrl.split('?')[0].split('/');
      const last = urlParts.pop();
      if (last) {
        try {
          fileName = decodeURIComponent(last);
        } catch {
          fileName = last;
        }
      }
    }
  }
  if (!fileName) {
    fileName = 'file';
  }

  const effectiveUrl =
    attachmentUrl ||
    store.url ||
    (effectiveContent.startsWith('http') || effectiveContent.startsWith('blob:')
      ? effectiveContent
      : '');

  const effectiveThumbUrl = thumbUrl || store.thumbUrl || effectiveUrl;

  return {
    content: effectiveContent,
    attachmentUrl,
    fileName,
    effectiveType,
    effectiveAttachmentType,
    effectiveUrl,
    effectiveThumbUrl,
  };
}

function classifyVideo(input: ClassificationInput): PinnedClassification | null {
  const {
    content,
    attachmentUrl,
    fileName,
    effectiveType,
    effectiveAttachmentType,
    effectiveUrl,
    effectiveThumbUrl,
  } = input;
  const isVideo =
    effectiveType === 'video' ||
    effectiveAttachmentType.startsWith('video/') ||
    VIDEO_EXTENSION_RE.test(fileName) ||
    VIDEO_EXTENSION_RE.test(attachmentUrl) ||
    VIDEO_EXTENSION_RE.test(effectiveUrl) ||
    VIDEO_EXTENSION_RE.test(content);

  return isVideo
    ? { category: 'video', fileName, url: effectiveUrl, thumbUrl: effectiveThumbUrl, content }
    : null;
}

function classifyImage(input: ClassificationInput): PinnedClassification | null {
  const { attachmentUrl, fileName, effectiveType, effectiveAttachmentType, effectiveUrl } = input;

  const isImageFileExtension =
    IMAGE_EXTENSION_RE.test(fileName) ||
    IMAGE_EXTENSION_RE.test(attachmentUrl) ||
    IMAGE_EXTENSION_RE.test(effectiveUrl);

  const isLargeImage =
    effectiveType === 'large_image' ||
    effectiveType === 'largeimage' ||
    (effectiveType === 'file' &&
      (isImageFileExtension || effectiveAttachmentType.startsWith('image/')));

  if (isLargeImage) {
    return { ...baseClassification(input), category: 'large_image' };
  }

  const isAlbum = effectiveType === 'album' || effectiveAttachmentType === 'album';
  if (isAlbum) {
    return { ...baseClassification(input), category: 'album' };
  }

  const isNormalImage =
    (effectiveType === 'image' ||
      effectiveType === 'photo' ||
      effectiveAttachmentType.startsWith('image/') ||
      effectiveAttachmentType === 'image' ||
      effectiveAttachmentType === 'photo' ||
      isImageFileExtension) &&
    !isLargeImage;

  return isNormalImage ? { ...baseClassification(input), category: 'image' } : null;
}

function classifyDocument(input: ClassificationInput): PinnedClassification | null {
  const { fileName, effectiveAttachmentType, effectiveUrl } = input;

  const docType = getDocumentFileType(fileName, effectiveAttachmentType);

  if (
    docType === 'excel' ||
    EXCEL_EXTENSION_RE.test(fileName) ||
    (EXCEL_EXTENSION_RE.test(effectiveUrl) && !effectiveUrl.includes('/package/'))
  ) {
    return { ...baseClassification(input), category: 'excel' };
  }

  if (
    docType === 'ppt' ||
    PPT_EXTENSION_RE.test(fileName) ||
    PPT_EXTENSION_RE.test(effectiveUrl)
  ) {
    return { ...baseClassification(input), category: 'ppt' };
  }

  if (docType === 'word' || DOC_EXTENSION_RE.test(fileName) || DOC_EXTENSION_RE.test(effectiveUrl)) {
    return { ...baseClassification(input), category: 'doc' };
  }

  if (docType === 'pdf' || PDF_EXTENSION_RE.test(fileName) || PDF_EXTENSION_RE.test(effectiveUrl)) {
    return { ...baseClassification(input), category: 'pdf' };
  }

  return null;
}

function classifyLink(input: ClassificationInput): PinnedClassification | null {
  const { content, effectiveType, effectiveUrl, effectiveThumbUrl } = input;

  const urls = extractUrls(content);
  const isLink =
    effectiveType === 'link' ||
    urls.length > 0 ||
    content.startsWith('http://') ||
    content.startsWith('https://');

  if (!isLink) return null;

  const linkUrl = urls[0] || (content.startsWith('http') ? content : '') || effectiveUrl;
  return {
    category: 'link',
    fileName: linkUrl,
    url: linkUrl,
    thumbUrl: effectiveThumbUrl,
    content,
  };
}

function classifyFile(input: ClassificationInput): PinnedClassification | null {
  const { attachmentUrl, fileName, effectiveType, effectiveAttachmentType } = input;

  const isExplicitFile =
    effectiveType === 'file' ||
    Boolean(effectiveAttachmentType && effectiveAttachmentType !== 'text') ||
    Boolean(attachmentUrl) ||
    GENERIC_FILE_EXTENSION_RE.test(fileName);

  return isExplicitFile ? { ...baseClassification(input), category: 'file' } : null;
}

function classifyText(input: ClassificationInput): PinnedClassification {
  return { category: 'text', fileName: '', url: '', thumbUrl: '', content: input.content };
}

/** Builds a PinnedClassification from shared inputs (excluding category). */
function baseClassification(input: ClassificationInput): Omit<PinnedClassification, 'category'> {
  return {
    fileName: input.fileName,
    url: input.effectiveUrl,
    thumbUrl: input.effectiveThumbUrl,
    content: input.content,
  };
}

/**
 * Classifies a pinned message and extracts pertinent metadata such as
 * resolved file name, URL, thumbnail URL, and rich content representation.
 *
 * @param msg The pinned message to classify.
 * @param messagesByConversationMap Optional message store map used to enrich
 * metadata. When calling classifyPinnedMessage repeatedly for the same map
 * (e.g. inside a useMemo loop), pass a pre-built index from
 * `indexMessagesByConversation` to avoid re-scanning every message.
 * @param index Optional pre-built message index (from indexMessagesByConversation).
 */
export function classifyPinnedMessage(
  msg: PinnedMessage,
  messagesByConversationMap?: MessagesByConversationMap,
  index?: Map<string, ChatMessage>
): PinnedClassification {
  const store = resolveStoreContext(msg, messagesByConversationMap, index);
  const input = buildClassificationInput(msg, store);

  return (
    classifyVideo(input) ||
    classifyImage(input) ||
    classifyDocument(input) ||
    classifyLink(input) ||
    classifyFile(input) ||
    classifyText(input)
  );
}
