import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from './types';
import { getFrameDimensions } from './render';
import { allMedia, firstMotion, getSelectedMedia } from './PostCard';
import { DEMO_POST } from './demo';

function element(width: number, height: number, slot?: { x: number; y: number; width: number; height: number }) {
  return {
    offsetWidth: width, offsetHeight: height,
    getBoundingClientRect: () => ({ x: -20000, y: 0 }),
    querySelector: () => slot ? { offsetWidth: slot.width, getBoundingClientRect: () => ({ ...slot, x: slot.x - 20000 }) } : null,
  } as unknown as HTMLElement;
}
afterEach(() => vi.unstubAllGlobals());
describe('shared frame geometry', () => {
  it('uses the explicit image scale rather than device pixel density', () => {
    expect(getFrameDimensions(element(600, 750), { ...DEFAULT_SETTINGS, scale: 3 })).toMatchObject({ width: 1800, height: 2250, ratio: 3 });
  });
  it('sizes the complete MP4 around its source without upscaling lower-resolution video', () => {
    vi.stubGlobal('getComputedStyle', () => ({ borderTopLeftRadius: '13px' }));
    const result = getFrameDimensions(element(600, 700, { x: 32, y: 200, width: 534, height: 300 }), DEFAULT_SETTINGS, { videoMode: true, videoSize: { width: 640, height: 360 } });
    expect(result.width).toBe(720);
    expect(result.height).toBe(840);
    expect(result.aperture?.width).toBeCloseTo(640);
    expect(result.aperture?.x).toBeCloseTo(32 * 640 / 534);
    expect(result.width % 2).toBe(0);
    expect(result.height % 2).toBe(0);
  });
  it('rejects oversized images before allocation', () => {
    expect(() => getFrameDimensions(element(600, 4000), { ...DEFAULT_SETTINGS, scale: 4 })).toThrow(/above the image export limit/);
  });
  it('requires an aperture for video export', () => {
    expect(() => getFrameDimensions(element(600, 750), DEFAULT_SETTINGS, { videoMode: true, videoSize: { width: 1280, height: 720 } })).toThrow(/Select a video/);
  });
});
describe('attachment selection', () => {
  const quote = { ...DEMO_POST, id: 'quote', media: [{ ...DEMO_POST.media[0], id: 'quoted-video', type: 'video' as const }] };
  const post = { ...DEMO_POST, quote };
  it('finds motion attachments in a quoted post without losing their owner', () => {
    expect(firstMotion(post)).toEqual({ postId: 'quote', mediaId: 'quoted-video' });
    expect(allMedia(post)).toHaveLength(2);
    expect(getSelectedMedia(post, firstMotion(post))?.type).toBe('video');
  });
  it('matches media and containing post together', () => {
    expect(getSelectedMedia(post, { postId: 'wrong', mediaId: 'quoted-video' })).toBeUndefined();
  });
});
