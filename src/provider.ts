import type { MediaFormat, Post, PostMedia, TextFacet } from './types';

type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const string = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const number = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const POST_HOSTS = new Set(['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com']);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export const FALLBACK_AVATAR = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#343b40"/><circle cx="48" cy="36" r="16" fill="#9aa3aa"/><path d="M18 88c0-19 12-31 30-31s30 12 30 31" fill="#9aa3aa"/></svg>')}`;

export function parsePostUrl(input: string): string {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('Paste a complete X or Twitter post URL, such as https://x.com/user/status/123.'); }
  if (!['https:', 'http:'].includes(url.protocol) || !POST_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) {
    throw new Error('Use a post link from x.com or twitter.com.');
  }
  const match = url.pathname.match(/^\/(?:[A-Za-z0-9_]{1,30}\/status|i\/web\/status)\/(\d{1,25})(?:\/(?:photo|video)\/\d+)?\/?$/);
  if (!match) throw new Error('That link is not a post. Copy the URL of an individual X post.');
  return match[1];
}

/** Media is fetched directly from X's media CDN; reject arbitrary provider URLs. */
export function safeMediaUrl(value: unknown): string {
  const input = string(value);
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || !url.hostname.endsWith('.twimg.com')) return '';
    url.protocol = 'https:';
    return url.href;
  } catch { return ''; }
}

function codePointOffset(text: string, offset: number): number {
  let index = 0;
  let count = 0;
  while (index < text.length && count < offset) {
    const point = text.codePointAt(index)!;
    index += point > 0xffff ? 2 : 1;
    count++;
  }
  return index;
}

function facetRange(text: string, value: unknown, note: boolean): [number, number] | undefined {
  const indices = array(value);
  if (indices.length !== 2 || indices.some(i => typeof i !== 'number' || !Number.isFinite(i))) return undefined;
  let start = Math.max(0, Math.floor(number(indices[0])));
  let end = Math.max(start, Math.floor(number(indices[1])));
  if (note) { start = codePointOffset(text, start); end = codePointOffset(text, end); }
  start = Math.min(text.length, start);
  end = Math.min(text.length, end);
  if (start > 0 && /[\uDC00-\uDFFF]/.test(text[start] ?? '')) start--;
  if (end < text.length && /[\uDC00-\uDFFF]/.test(text[end] ?? '')) end++;
  return end > start ? [start, end] : undefined;
}

function safeLink(value: unknown): string | undefined {
  try { const url = new URL(string(value)); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}

function normalizeText(status: Json): Pick<Post, 'text' | 'facets'> {
  const raw = object(status.raw_text);
  const source = string(raw.text, string(status.text));
  const display = array(raw.display_text_range);
  const viewStart = Math.max(0, Math.min(source.length, number(display[0], 0)));
  const viewEnd = Math.max(viewStart, Math.min(source.length, number(display[1], source.length)));
  const quote = object(status.quote);
  const quoteId = string(quote.id);
  const originalFacets: TextFacet[] = [];
  const edits: { start: number; end: number; text: string }[] = [];
  for (const item of array(raw.facets)) {
    const facet = object(item);
    const range = facetRange(source, facet.indices, status.is_note_tweet === true);
    if (!range) continue;
    const [start, end] = range;
    if (start < viewStart || end > viewEnd) continue;
    const kind = string(facet.type);
    // Note posts can retain media facets from the shorter original post. Their
    // stale offsets may point into ordinary prose in the full note text.
    if (kind === 'media' || kind === 'url') {
      const span = source.slice(start, end);
      const original = string(facet.original);
      if (!/^https?:\/\/\S+$/.test(span) || (original.startsWith('http') && span !== original)) continue;
    }
    const url = safeLink(facet.replacement);
    let quoteLink = false;
    if (kind === 'url' && quoteId && url) {
      try { quoteLink = parsePostUrl(url) === quoteId; } catch { /* Ordinary external link. */ }
    }
    if (kind === 'media' || quoteLink) { edits.push({ start, end, text: '' }); continue; }
    if (kind === 'url') {
      const label = string(facet.display, string(facet.replacement, source.slice(start, end)));
      edits.push({ start, end, text: label });
      originalFacets.push({ start, end, type: 'link', url });
    } else if (kind === 'mention' || kind === 'hashtag' || kind === 'bold' || kind === 'italic') {
      originalFacets.push({ start, end, type: kind, ...(url ? { url } : {}) });
    }
  }
  edits.sort((a, b) => a.start - b.start);
  const validEdits: typeof edits = [];
  let cursor = viewStart;
  let text = '';
  for (const edit of edits) {
    if (edit.start < cursor) continue;
    text += source.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
    validEdits.push(edit);
  }
  text += source.slice(cursor, viewEnd);
  const mapOffset = (position: number, end: boolean): number => {
    let difference = -viewStart;
    for (const edit of validEdits) {
      if (position <= edit.start) break;
      if (position < edit.end) return edit.start + difference + (end ? edit.text.length : 0);
      difference += edit.text.length - (edit.end - edit.start);
    }
    return position + difference;
  };
  const trimmedStart = text.length - text.trimStart().length;
  text = text.trim();
  const facets = originalFacets.map(f => ({ ...f, start: mapOffset(f.start, false) - trimmedStart, end: mapOffset(f.end, true) - trimmedStart }))
    .filter(f => f.start >= 0 && f.end > f.start && f.end <= text.length);
  // Some provider responses contain plain text without structured facets.
  if (!array(raw.facets).length) {
    for (const match of text.matchAll(/https?:\/\/[^\s]+|@[\p{L}\p{N}_]+|#[\p{L}\p{N}_]+/gu)) {
      const value = match[0];
      facets.push({ start: match.index, end: match.index + value.length, type: value.startsWith('@') ? 'mention' : value.startsWith('#') ? 'hashtag' : 'link', ...(value.startsWith('http') ? { url: safeLink(value) } : {}) });
    }
  }
  return { text, facets };
}

function normalizeMedia(value: unknown, postId: string, index: number): PostMedia | undefined {
  const media = object(value);
  const rawType = string(media.type);
  const type = rawType === 'photo' ? 'photo' : rawType === 'gif' || rawType === 'animated_gif' ? 'gif' : rawType === 'video' ? 'video' : undefined;
  if (!type) return undefined;
  const url = safeMediaUrl(media.url);
  if (!url) throw new Error('X returned a media address that PostFrame cannot safely load.');
  const thumbnail = safeMediaUrl(media.thumbnail_url) || (type === 'photo' ? url : '');
  if (!thumbnail) throw new Error('The video preview is unavailable. Try this post again later.');
  const formats: MediaFormat[] = array(media.formats ?? media.variants).flatMap(item => {
    const format = object(item);
    const formatUrl = safeMediaUrl(format.url);
    const container = string(format.container, string(format.content_type));
    if (!formatUrl || !(container.includes('mp4') || /\.mp4(?:\?|$)/i.test(formatUrl))) return [];
    const dimensions = formatUrl.match(/\/(\d+)x(\d+)\//);
    return [{ url: formatUrl, bitrate: number(format.bitrate), width: number(format.width, dimensions ? +dimensions[1] : 0) || undefined, height: number(format.height, dimensions ? +dimensions[2] : 0) || undefined, type: 'video/mp4', codec: string(format.codec) || undefined }];
  });
  if (type !== 'photo' && !formats.length && /\.mp4(?:\?|$)/i.test(url)) formats.push({ url, type: 'video/mp4' });
  return { id: string(media.id, `${postId}-${index}`), type, url, thumbnail, width: Math.max(1, number(media.width, 1280)), height: Math.max(1, number(media.height, 720)), duration: typeof media.duration === 'number' ? Math.max(0, media.duration) : undefined, formats };
}

export function normalizePost(value: unknown, depth = 0): Post {
  const status = object(value);
  const author = object(status.author);
  const id = string(status.id);
  if (!/^\d+$/.test(id) || !string(author.screen_name) || typeof status.text !== 'string') throw new Error('The post service returned an unexpected response. Please try again later.');
  const media = object(status.media);
  const list = Array.isArray(media.all) ? media.all : [...array(media.photos), ...array(media.videos)];
  const quote = object(status.quote);
  const timestamp = number(status.created_timestamp, NaN);
  const date = Number.isFinite(timestamp) ? new Date(timestamp * 1000) : new Date(string(status.created_at));
  const poll = object(status.poll);
  const reply = status.replying_to;
  const result: Post = {
    id, url: `https://x.com/${encodeURIComponent(string(author.screen_name))}/status/${id}`,
    author: { name: string(author.name, string(author.screen_name)), handle: string(author.screen_name), avatar: safeMediaUrl(author.avatar_url) || FALLBACK_AVATAR, verified: object(author.verification).verified === true || author.verified === true },
    ...normalizeText(status), createdAt: Number.isNaN(date.getTime()) ? '' : date.toISOString(),
    media: list.slice(0, 16).flatMap((item, index) => { const itemMedia = normalizeMedia(item, id, index); return itemMedia ? [itemMedia] : []; }),
    ...(reply ? { replyingTo: typeof reply === 'string' ? reply : string(object(reply).screen_name, string(object(object(reply).author).screen_name)) } : {}),
  };
  if (depth < 1 && Object.keys(quote).length) {
    if (quote.type === 'tombstone' || !quote.author || !quote.id) result.quoteUnavailable = true;
    else { try { result.quote = normalizePost(quote, depth + 1); } catch { result.quoteUnavailable = true; } }
  }
  if (array(poll.choices).length) result.poll = { options: array(poll.choices).map(choice => ({ label: string(object(choice).label), votes: Math.max(0, number(object(choice).count)) })), totalVotes: Math.max(0, number(poll.total_votes)), endsAt: string(poll.ends_at) || undefined };
  return result;
}

async function timedRequest<T>(url: string, signal: AbortSignal | undefined, read: (response: Response) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('The request timed out.', 'TimeoutError')), 25_000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    const result = await read(response);
    if (controller.signal.aborted) throw controller.signal.reason;
    return result;
  }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

function providerError(code: number): Error {
  if (code === 401 || code === 403) return new Error('This post is private or restricted. PostFrame can only load publicly available posts.');
  if (code === 404) return new Error('This post could not be found. It may have been deleted or made private.');
  if (code === 429) return new Error('The post service is busy. Wait a moment before trying again.');
  if (code === 400) return new Error('The post service could not read this link. Check the post URL and try again.');
  return new Error('The post service is temporarily unavailable. Please try again later.');
}

export async function loadMediaAsset(input: string, signal?: AbortSignal): Promise<string> {
  if (input === FALLBACK_AVATAR) return input;
  const url = safeMediaUrl(input);
  if (!url) throw new Error('This media address is not supported.');
  return timedRequest(url, signal, async response => {
  if (!response.ok) throw new Error('An image could not be loaded from X. Try loading this post again.');
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || '';
  if (!/^image\/(?:jpeg|png|webp|gif|avif)$/.test(type)) throw new Error('X returned an unsupported image format.');
  const declaredBytes = Number(response.headers.get('content-length'));
  if (declaredBytes > MAX_IMAGE_BYTES) throw new Error('An image is too large to export in this browser.');
  const reader = response.body?.getReader();
  let blob: Blob;
  if (reader) {
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_IMAGE_BYTES) { await reader.cancel(); throw new Error('An image is too large to export in this browser.'); }
      chunks.push(new Uint8Array(value));
    }
    blob = new Blob(chunks, { type });
  } else {
    blob = await response.blob();
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('An image is too large to export in this browser.');
  }
  if (!blob.size) throw new Error('X returned an empty image. Try loading the post again.');
  if (typeof FileReader !== 'undefined') return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The image could not be prepared for export.'));
    reader.readAsDataURL(blob);
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${type};base64,${btoa(binary)}`;
  });
}

async function embedAssets(post: Post, signal?: AbortSignal): Promise<void> {
  const cache = new Map<string, Promise<string>>();
  const image = (url: string) => { if (!cache.has(url)) cache.set(url, loadMediaAsset(url, signal)); return cache.get(url)!; };
  const embed = async (item: Post): Promise<void> => {
    await Promise.all([
      image(item.author.avatar).then(data => { item.author.avatar = data; }).catch(error => { if (signal?.aborted) throw error; item.author.avatar = FALLBACK_AVATAR; }),
      ...item.media.map(async media => { media.thumbnail = await image(media.thumbnail); if (media.type === 'photo') media.url = media.thumbnail; }),
      ...(item.quote ? [embed(item.quote)] : []),
    ]);
  };
  await embed(post);
}

export async function loadPost(input: string, signal?: AbortSignal): Promise<Post> {
  const id = parsePostUrl(input);
  try {
    const payload = await timedRequest(`https://api.fxtwitter.com/2/status/${id}`, signal, async response => {
      if (!response.ok) throw providerError(response.status);
      try { return object(await response.json()); } catch { throw new Error('The post service returned an unexpected response. Please try again later.'); }
    });
    if (payload.code !== 200) throw providerError(number(payload.code, 500));
    const post = normalizePost(payload.status);
    await embedAssets(post, signal);
    return post;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')) throw new Error('Could not reach X or the post service. Check your connection and try again.');
    throw error;
  }
}
