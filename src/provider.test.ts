import { afterEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_AVATAR, loadMediaAsset, loadPost, normalizePost, parsePostUrl, safeMediaUrl } from './provider';

const rawPost = (overrides: Record<string, unknown> = {}) => ({ id: '1903302115721629989', text: 'Hello world', author: { name: 'Example', screen_name: 'example', avatar_url: null, verification: { verified: true } }, created_timestamp: 1742617560, ...overrides });
const photo = (id: string) => ({ id, type: 'photo', url: `https://pbs.twimg.com/media/${id}.jpg`, width: 1000, height: 800 });
afterEach(() => vi.unstubAllGlobals());

describe('post URL handling', () => {
  it.each(['https://x.com/user/status/1903302115721629989?s=20', 'https://twitter.com/user/status/1903302115721629989/video/1', 'https://mobile.twitter.com/user/status/1903302115721629989', 'https://x.com/i/web/status/1903302115721629989', 'https://x.com/i/status/1903302115721629989'])('extracts a string ID from %s', url => expect(parsePostUrl(url)).toBe('1903302115721629989'));
  it.each(['https://x.com.evil.example/user/status/123', 'https://evil.example/x.com/user/status/123', 'javascript:alert(1)', 'https://user:pass@x.com/user/status/123', 'https://x.com:8080/user/status/123', 'https://x.com/user', 'https://x.com/user/status/123/anything', '123'])('rejects %s', input => expect(() => parsePostUrl(input)).toThrow());
  it('allows only X CDN media URLs', () => { expect(safeMediaUrl('http://pbs.twimg.com/media/one.jpg')).toBe('https://pbs.twimg.com/media/one.jpg'); expect(safeMediaUrl('https://twimg.com.evil.example/a.jpg')).toBe(''); expect(safeMediaUrl('https://example.com/a.jpg')).toBe(''); expect(safeMediaUrl('data:image/svg+xml,hello')).toBe(''); });
});

describe('provider normalization', () => {
  it('preserves IDs and orders media.all without duplicating photos/videos', () => {
    const media = [photo('1'), { id: '2', type: 'video', url: 'https://video.twimg.com/a/720x1280/b.mp4', thumbnail_url: 'https://pbs.twimg.com/2.jpg', width: 1080, height: 1920, duration: 12.306, formats: [{ url: 'https://video.twimg.com/a/720x1280/b.mp4', bitrate: 2176000, container: 'mp4', codec: 'h264' }, { url: 'https://video.twimg.com/b.m3u8', container: 'm3u8' }] }, photo('3'), photo('4')];
    const post = normalizePost(rawPost({ media: { all: media, photos: [media[0], media[2], media[3]], videos: [media[1]] } }));
    expect(post.id).toBe('1903302115721629989'); expect(post.media.map(m => m.id)).toEqual(['1', '2', '3', '4']); expect(post.media[1].formats).toHaveLength(1); expect(post.media[1].formats[0]).toMatchObject({ width: 720, height: 1280, codec: 'h264' }); expect(post.media[1].duration).toBe(12.306);
  });
  it('handles four photo posts', () => expect(normalizePost(rawPost({ media: { all: ['1', '2', '3', '4'].map(photo) } })).media).toHaveLength(4));
  it('turns a tombstone into an unavailable quote without failing the main post', () => expect(normalizePost(rawPost({ quote: { type: 'tombstone', reason: 'private', message: 'Unavailable' } })).quoteUnavailable).toBe(true));
  it('includes a quote and MP4-backed animated GIF', () => {
    const result = normalizePost(rawPost({ quote: rawPost({ id: '20', text: 'Quoted' }), media: { all: [{ id: '1', type: 'gif', url: 'https://video.twimg.com/a.mp4', thumbnail_url: 'https://pbs.twimg.com/a.jpg', width: 400, height: 400 }] } }));
    expect(result.quote?.text).toBe('Quoted'); expect(result.media[0].type).toBe('gif'); expect(result.media[0].formats).toHaveLength(1);
  });
  it('converts note-tweet code-point offsets before URL replacement and rich text mapping', () => {
    const text = '🌿 Read https://t.co/abc now';
    const result = normalizePost(rawPost({ is_note_tweet: true, text, raw_text: { text, display_text_range: [0, text.length], facets: [{ type: 'bold', indices: [2, 6] }, { type: 'url', indices: [7, 23], display: 'example.com', replacement: 'https://example.com' }] } }));
    expect(result.text).toBe('🌿 Read example.com now');
    expect(result.text.slice(result.facets[0].start, result.facets[0].end)).toBe('Read');
    expect(result.text.slice(result.facets[1].start, result.facets[1].end)).toBe('example.com');
  });
  it('keeps overlapping emphasis when a link expands', () => {
    const text = 'Read https://t.co/x';
    const result = normalizePost(rawPost({ text, raw_text: { text, display_text_range: [0, text.length], facets: [{ type: 'bold', indices: [0, text.length] }, { type: 'url', indices: [5, text.length], display: 'a-longer-example.com', replacement: 'https://example.com' }] } }));
    expect(result.facets[0].end).toBe(result.text.length); expect(result.text.slice(result.facets[1].start)).toBe('a-longer-example.com');
  });
  it('suppresses attached media and quoted-post URL text', () => {
    const text = 'Hello https://t.co/q https://t.co/m';
    const result = normalizePost(rawPost({ text, quote: rawPost({ id: '20' }), raw_text: { text, display_text_range: [0, text.length], facets: [{ type: 'url', indices: [6, 20], replacement: 'https://x.com/jack/status/20', display: 'x.com/jack/status/20' }, { type: 'media', indices: [21, text.length] }] } }));
    expect(result.text).toBe('Hello');
  });
  it('normalizes polls and missing optional avatar', () => {
    const result = normalizePost(rawPost({ poll: { choices: [{ label: 'Yes', count: 5 }, { label: 'No', count: 2 }], total_votes: 7, ends_at: '2026-11-09T00:00:00Z' } }));
    expect(result.poll?.totalVotes).toBe(7); expect(result.poll?.options[0]).toEqual({ label: 'Yes', votes: 5 }); expect(result.author.avatar).toBe(FALLBACK_AVATAR);
  });
  it('rejects malformed primary posts and arbitrary provider media', () => { expect(() => normalizePost({ id: 123 })).toThrow(/unexpected response/); expect(() => normalizePost(rawPost({ media: { all: [{ ...photo('1'), url: 'https://evil.example/a.jpg' }] } }))).toThrow(/safely/); });
});

describe('network behavior', () => {
  it.each([401, 403, 404, 429, 500])('handles HTTP-200 JSON error %s', async code => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), { status: 200 }))); await expect(loadPost('https://x.com/user/status/20')).rejects.toThrow(code === 404 ? /could not be found/ : code === 429 ? /busy/ : code < 404 ? /private or restricted/ : /temporarily unavailable/); });
  it('handles HTTP errors before parsing JSON', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 }))); await expect(loadPost('https://x.com/user/status/20')).rejects.toThrow(/temporarily unavailable/); });
  it('handles changed and malformed JSON responses', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 }))); await expect(loadPost('https://x.com/user/status/20')).rejects.toThrow(/unexpected response/); });
  it('loads a text post and uses a local avatar fallback', async () => { const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 200, status: rawPost() }))); vi.stubGlobal('fetch', fetch); const post = await loadPost('https://x.com/user/status/20'); expect(post.text).toBe('Hello world'); expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0][0]).toBe('https://api.fxtwitter.com/2/status/20'); });
  it('embeds images and does not send credentials', async () => { const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })); vi.stubGlobal('fetch', fetch); await expect(loadMediaAsset('https://pbs.twimg.com/a.png')).resolves.toBe('data:image/png;base64,AQID'); expect(fetch.mock.calls[0][1].credentials).toBe('omit'); });
  it('rejects non-image responses and oversized images', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { headers: { 'content-type': 'text/html' } }))); await expect(loadMediaAsset('https://pbs.twimg.com/a.png')).rejects.toThrow(/unsupported image/); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { headers: { 'content-type': 'image/png', 'content-length': String(13 * 1024 * 1024) } }))); await expect(loadMediaAsset('https://pbs.twimg.com/a.png')).rejects.toThrow(/too large/); });
  it('does not replace cancellation with a connection error', async () => { const controller = new AbortController(); controller.abort(); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'))); await expect(loadPost('https://x.com/user/status/20', controller.signal)).rejects.toHaveProperty('name', 'AbortError'); });
  it('keeps cancellation connected while the response body is loading', async () => {
    let finishBody!: (value: unknown) => void;
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(resolve => { finishBody = resolve; }) });
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    const loading = loadPost('https://x.com/user/status/20', controller.signal);
    await vi.waitFor(() => expect(finishBody).toBeTypeOf('function'));
    controller.abort();
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    finishBody({ code: 200, status: rawPost() });
    await expect(loading).rejects.toHaveProperty('name', 'AbortError');
  });
});
