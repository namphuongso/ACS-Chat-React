import { describe, it, expect } from 'vitest';
import {
  normalizeFormattingHtml,
  normalizeFormattingElement,
  safeNormalizeFormattingElement,
} from '../htmlUtils';

describe('htmlUtils - normalizeFormattingHtml', () => {
  it('should normalize strike wrapping font tags with different sizes', () => {
    const input = '<strike>qq<font size="5" style="">ee</font><font size="7" style="">rr</font></strike>';
    const output = normalizeFormattingHtml(input);
    expect(output).toBe(
      '<strike>qq</strike><font size="5" style=""><strike>ee</strike></font><font size="7" style=""><strike>rr</strike></font>'
    );
  });

  it('should normalize strike wrapping text and font tag with text after', () => {
    const input = '<strike>qq<font size="5">ee</font>rr</strike>';
    const output = normalizeFormattingHtml(input);
    expect(output).toBe(
      '<strike>qq</strike><font size="5"><strike>ee</strike></font><strike>rr</strike>'
    );
  });

  it('should normalize strike wrapping only a font tag', () => {
    const input = '<strike><font size="5">ee</font></strike>';
    const output = normalizeFormattingHtml(input);
    expect(output).toBe('<font size="5"><strike>ee</strike></font>');
  });

  it('should normalize s and del tags', () => {
    const inputS = '<s>qq<font size="5">ee</font></s>';
    expect(normalizeFormattingHtml(inputS)).toBe('<s>qq</s><font size="5"><s>ee</s></font>');

    const inputDel = '<del>qq<font size="5">ee</font></del>';
    expect(normalizeFormattingHtml(inputDel)).toBe('<del>qq</del><font size="5"><del>ee</del></font>');
  });

  it('should normalize underline wrapping font tags', () => {
    const input = '<u>qq<font size="5">ee</font></u>';
    expect(normalizeFormattingHtml(input)).toBe('<u>qq</u><font size="5"><u>ee</u></font>');
  });

  it('should normalize strike wrapping span with font-size style', () => {
    const input = '<strike>qq<span style="font-size: 24px;">ee</span></strike>';
    const output = normalizeFormattingHtml(input);
    expect(output).toBe('<strike>qq</strike><span style="font-size: 24px;"><strike>ee</strike></span>');
  });

  it('should handle nested formatting tags like b and i', () => {
    const input = '<strike><b>qq</b><font size="5"><i>ee</i></font></strike>';
    const output = normalizeFormattingHtml(input);
    expect(output).toBe('<strike><b>qq</b></strike><font size="5"><strike><i>ee</i></strike></font>');
  });

  it('should leave already normalized or normal HTML intact', () => {
    const normal = '<b>Hello world</b> <i>italic</i>';
    expect(normalizeFormattingHtml(normal)).toBe(normal);

    const strikeOnly = '<strike>plain strike text</strike>';
    expect(normalizeFormattingHtml(strikeOnly)).toBe(strikeOnly);

    const alreadyNormalized = '<font size="5"><strike>already correct</strike></font>';
    expect(normalizeFormattingHtml(alreadyNormalized)).toBe(alreadyNormalized);
  });

  it('should handle empty or non-string input safely', () => {
    expect(normalizeFormattingHtml('')).toBe('');
    expect(normalizeFormattingHtml(null as unknown as string)).toBe(null);
    expect(normalizeFormattingHtml(undefined as unknown as string)).toBe(undefined);
  });

  it('should normalize DOM elements using normalizeFormattingElement and safeNormalizeFormattingElement', () => {
    const div = document.createElement('div');
    div.innerHTML = '<strike>qq<font size="5">ee</font></strike>';
    const modified = normalizeFormattingElement(div);
    expect(modified).toBe(true);
    expect(div.innerHTML).toBe('<strike>qq</strike><font size="5"><strike>ee</strike></font>');

    const div2 = document.createElement('div');
    div2.innerHTML = '<strike>qq<font size="7">rr</font></strike>';
    const safeModified = safeNormalizeFormattingElement(div2);
    expect(safeModified).toBe(true);
    expect(div2.innerHTML).toBe('<strike>qq</strike><font size="7"><strike>rr</strike></font>');
  });
});
