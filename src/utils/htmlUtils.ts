/**
 * Normalizes rich text HTML so that text decorations (strike, s, del, u)
 * are placed inside font-size-changing elements (font[size], span with font-size)
 * rather than wrapping them.
 *
 * This fixes browser rendering bugs where strikethrough/underline lines are misaligned
 * (floating above/below text) when child elements have different font sizes than the parent decoration.
 */

import DOMPurify from 'dompurify';

const DECOR_TAGS = ['STRIKE', 'S', 'DEL', 'U'];

/**
 * Checks if an element has a font size modification
 */
function hasFontSize(node: Element): boolean {
  if (node.tagName === 'FONT' && node.hasAttribute('size')) {
    return true;
  }
  if (node instanceof HTMLElement && node.style && node.style.fontSize) {
    return true;
  }
  return false;
}

/**
 * Normalizes a single DOM container in-place.
 */
export function normalizeFormattingElement(container: HTMLElement): boolean {
  if (typeof document === 'undefined') return false;

  const decorElements = Array.from(container.querySelectorAll(DECOR_TAGS.join(',')));
  let modified = false;

  for (const decorEl of decorElements) {
    // If decorEl has been removed or detached during earlier transformations, skip
    if (!decorEl.parentNode || !container.contains(decorEl)) continue;

    // Check if decorEl contains any font-size children
    const sizeChildren = decorEl.querySelectorAll('font[size], [style*="font-size"]');
    if (sizeChildren.length === 0) continue;

    const tagName = decorEl.tagName.toLowerCase();
    const parent = decorEl.parentNode;
    if (!parent) continue;

    const frag = document.createDocumentFragment();
    const childNodes = Array.from(decorEl.childNodes);

    for (const child of childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent && child.textContent.length > 0) {
          const newDecor = document.createElement(tagName);
          // Copy attributes if any
          for (let i = 0; i < decorEl.attributes.length; i++) {
            const attr = decorEl.attributes[i];
            newDecor.setAttribute(attr.name, attr.value);
          }
          newDecor.appendChild(child);
          frag.appendChild(newDecor);
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const childEl = child as HTMLElement;

        if (hasFontSize(childEl)) {
          // Check if child already contains this decoration tag
          const existingDecor = childEl.querySelector(tagName);
          if (existingDecor) {
            frag.appendChild(childEl);
          } else {
            const newFont = childEl.cloneNode(false) as HTMLElement;
            const innerDecor = document.createElement(tagName);
            for (let i = 0; i < decorEl.attributes.length; i++) {
              const attr = decorEl.attributes[i];
              innerDecor.setAttribute(attr.name, attr.value);
            }
            while (childEl.firstChild) {
              innerDecor.appendChild(childEl.firstChild);
            }
            newFont.appendChild(innerDecor);
            frag.appendChild(newFont);
          }
        } else {
          // Other container like <b> or <i> or <span> without font-size
          if (childEl.querySelector('font[size], [style*="font-size"]')) {
            const newDecor = document.createElement(tagName);
            for (let i = 0; i < decorEl.attributes.length; i++) {
              const attr = decorEl.attributes[i];
              newDecor.setAttribute(attr.name, attr.value);
            }
            newDecor.appendChild(childEl);
            normalizeFormattingElement(newDecor);
            while (newDecor.firstChild) {
              frag.appendChild(newDecor.firstChild);
            }
          } else {
            const newDecor = document.createElement(tagName);
            for (let i = 0; i < decorEl.attributes.length; i++) {
              const attr = decorEl.attributes[i];
              newDecor.setAttribute(attr.name, attr.value);
            }
            newDecor.appendChild(childEl);
            frag.appendChild(newDecor);
          }
        }
      }
    }

    parent.replaceChild(frag, decorEl);
    modified = true;
  }

  return modified;
}

/**
 * Normalizes HTML string to fix strikethrough/underline alignment with font-size changes.
 */
export function normalizeFormattingHtml(html: string | null): string | null {
  if (!html) return html;
  if (typeof html !== 'string') return null;

  // Fast check: only parse if it contains potential decor tags and font tags / styles
  if (
    !/(?:<strike|<s\b|<del|<u\b)/i.test(html) ||
    !/(?:<font|<span\b[^>]*font-size|style=["'][^"']*font-size)/i.test(html)
  ) {
    return html;
  }

  if (typeof document === 'undefined') return html;

  const div = document.createElement('div');
  div.innerHTML = html;
  normalizeFormattingElement(div);
  return div.innerHTML;
}

/**
 * Sanitizes untrusted HTML (e.g. message content received from the backend
 * WebSocket) before it is rendered via dangerouslySetInnerHTML.
 * Strips scripts, event handlers, and other dangerous constructs.
 * Falls back to the original string when DOMPurify cannot run (no DOM).
 */
export function sanitizeHtml(html: string | null | undefined): string | null {
  if (!html) return html ?? null;
  if (typeof html !== 'string') return null;
  try {
    // DOMPurify >= 3.3 drops `target` by default; keep it so that message
    // links (linkified URLs and rich-text anchors) can open in a new tab.
    return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
  } catch {
    return '';
  }
}

/**
 * Gets character offsets of current selection relative to the given element.
 */
export function getSelectionCharacterOffsetsWithin(
  element: Node
): { start: number; end: number } | null {
  if (typeof window === 'undefined') return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);

  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) {
    return null;
  }

  const preStartRange = range.cloneRange();
  preStartRange.selectNodeContents(element);
  preStartRange.setEnd(range.startContainer, range.startOffset);
  const start = preStartRange.toString().length;

  const preEndRange = range.cloneRange();
  preEndRange.selectNodeContents(element);
  preEndRange.setEnd(range.endContainer, range.endOffset);
  const end = preEndRange.toString().length;

  return { start, end };
}

/**
 * Restores selection character offsets within the given element.
 */
export function setSelectionCharacterOffsetsWithin(
  element: Node,
  offsets: { start: number; end: number } | null
): void {
  if (!offsets || typeof window === 'undefined' || typeof document === 'undefined') return;
  const range = document.createRange();
  let currentOffset = 0;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;

  function traverse(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent ? node.textContent.length : 0;
      if (!startNode && currentOffset + len >= offsets!.start) {
        startNode = node;
        startOffset = offsets!.start - currentOffset;
      }
      if (!endNode && currentOffset + len >= offsets!.end) {
        endNode = node;
        endOffset = offsets!.end - currentOffset;
      }
      currentOffset += len;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
      }
    }
  }

  traverse(element);

  if (startNode && endNode) {
    try {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch {
      // Ignore range errors gracefully
    }
  }
}

/**
 * Normalizes an in-place contentEditable element while preserving selection/cursor.
 */
export function safeNormalizeFormattingElement(editor: HTMLElement): boolean {
  const offsets = getSelectionCharacterOffsetsWithin(editor);
  const modified = normalizeFormattingElement(editor);
  if (modified && offsets) {
    setSelectionCharacterOffsetsWithin(editor, offsets);
  }
  return modified;
}
