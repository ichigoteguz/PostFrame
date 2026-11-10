import { describe, expect, it } from 'vitest';
import { assertFrame, assertSourceSize, selectVideoFormat } from './video';
import { LIMITS, type PostMedia } from './types';

const media: PostMedia = { id: '1', type: 'video', url: '', thumbnail: '', width: 1080, height: 1920, formats: [
  { url: 'https://video.twimg.com/x/vid/avc1/1080x1920/high.mp4', bitrate: 8_000_000 },
  { url: 'https://video.twimg.com/x/vid/avc1/720x1280/medium.mp4', bitrate: 3_000_000 },
  { url: 'https://video.twimg.com/x/vid/avc1/360x640/low.mp4', bitrate: 500_000 },
  { url: 'https://video.twimg.com/x/master.m3u8', type: 'application/x-mpegURL' },
] };

describe('source rendition selection', () => {
  it('selects portrait 720p rather than the original 1080p metadata dimensions', () => expect(selectVideoFormat(media, 720).url).toContain('/720x1280/'));
  it('supports the larger explicit quality preset', () => expect(selectVideoFormat(media, 1080).url).toContain('/1080x1920/'));
  it('uses the smallest source if all variants exceed the preset', () => expect(selectVideoFormat({ ...media, formats: [media.formats[0]] }, 720).url).toContain('/1080x1920/'));
  it('does not mistake a playlist for a downloadable MP4', () => expect(() => selectVideoFormat({ ...media, formats: [media.formats[3]] }, 720)).toThrow('direct MP4'));
  it('prefers H.264 over higher-ranked HEVC and unknown MP4 renditions', () => {
    const formats = [
      { url: 'https://video.twimg.com/720x1280/hevc.mp4', bitrate: 9_000_000, codec: 'hevc' },
      { url: 'https://video.twimg.com/720x1280/unknown.mp4', bitrate: 8_000_000 },
      { url: 'https://video.twimg.com/480x852/h264.mp4', bitrate: 950_000, codec: 'h264' },
    ];
    expect(selectVideoFormat({ ...media, formats }, 720).url).toContain('/h264.mp4');
  });
  it('recognizes avc1 codec strings and legacy avc1 URL paths', () => {
    const hevc = { url: 'https://video.twimg.com/720x1280/hevc.mp4', bitrate: 9_000_000, codec: 'hevc' };
    const avc = { url: 'https://video.twimg.com/480x852/avc.mp4', codec: 'avc1.640028' };
    expect(selectVideoFormat({ ...media, formats: [hevc, avc] }, 720)).toBe(avc);
    const legacy = { url: 'https://video.twimg.com/avc1/480x852/legacy.mp4' };
    expect(selectVideoFormat({ ...media, formats: [hevc, legacy] }, 720)).toBe(legacy);
  });
  it('uses an unknown-codec fallback when no H.264 rendition is provided', () => {
    const unknown = { url: 'https://video.twimg.com/480x852/unknown.mp4' };
    const hevc = { url: 'https://video.twimg.com/720x1280/hevc.mp4', codec: 'hevc' };
    expect(selectVideoFormat({ ...media, formats: [hevc, unknown] }, 720)).toBe(unknown);
    expect(selectVideoFormat({ ...media, formats: [hevc] }, 720)).toBe(hevc);
  });
});

describe('browser memory and geometry guardrails', () => {
  const frame = { blob: new Blob(), width: 1280, height: 1000, aperture: { x: 40, y: 200, width: 1200, height: 675, radius: 16 } };
  it('accepts a valid complete post geometry', () => expect(() => assertFrame(frame)).not.toThrow());
  it('rejects odd dimensions, missing slots, and out-of-bounds slots', () => {
    expect(() => assertFrame({ ...frame, width: 1279 })).toThrow('even');
    expect(() => assertFrame({ ...frame, aperture: undefined })).toThrow('measured');
    expect(() => assertFrame({ ...frame, aperture: { ...frame.aperture, x: 500 } })).toThrow('measured');
  });
  it('rejects excessive full-frame pixels even when each side is in range', () => expect(() => assertFrame({ ...frame, width: 3000, height: 3000 })).toThrow('too large'));
  it('rejects empty and oversized source files', () => {
    expect(() => assertSourceSize(0)).toThrow('empty');
    expect(() => assertSourceSize(LIMITS.sourceBytes + 1)).toThrow('100 MiB');
    expect(() => assertSourceSize(LIMITS.sourceBytes)).not.toThrow();
  });
});
