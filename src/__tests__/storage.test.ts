import { describe, expect, it } from 'vitest';
import { FONT_SIZE, clampFontSize } from '../lib/storage';

describe('clampFontSize', () => {
  it('keeps sizes within the allowed range', () => {
    expect(clampFontSize(16)).toBe(16);
    expect(clampFontSize(2)).toBe(FONT_SIZE.min);
    expect(clampFontSize(99)).toBe(FONT_SIZE.max);
    expect(clampFontSize(15.6)).toBe(16);
  });
});
