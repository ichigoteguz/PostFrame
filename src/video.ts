import { ALL_FORMATS, BlobSource, EncodedPacketSink, Input } from 'mediabunny';
import { LIMITS, type FrameSnapshot, type MediaFormat, type PostMedia } from './types';

export interface VideoInfo { width: number; height: number; duration: number; hasAudio: boolean; videoCodec: string | null; audioCodec: string | null }
export interface ExportVideoOptions { signal?: AbortSignal; onProgress?: (fraction: number) => void }
export interface VideoWorkerRequest { type: 'start'; source: Blob; frame: FrameSnapshot }
export type VideoWorkerResponse = { type: 'progress'; progress: number } | { type: 'result'; blob: Blob } | { type: 'error'; message: string };

export function assertSourceSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) throw new Error('The video file is empty. Try loading the post again.');
  if (size > LIMITS.sourceBytes) throw new Error('This video is larger than the 100 MiB browser limit. Try a lower quality source.');
}

export function assertFrame(frame: FrameSnapshot): void {
  const { width, height, aperture } = frame;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width % 2 || height % 2) throw new Error('Video export needs positive, even pixel dimensions.');
  if (width > LIMITS.videoSide || height > LIMITS.videoSide || width * height > LIMITS.videoPixels) throw new Error('This framed video is too large for browser export. Choose 720p or a smaller background.');
  if (!aperture || !Object.values(aperture).every(Number.isFinite) || aperture.width <= 0 || aperture.height <= 0 || aperture.radius < 0 || aperture.x < 0 || aperture.y < 0 || aperture.x + aperture.width > width + 1 || aperture.y + aperture.height > height + 1) throw new Error('The selected video area could not be measured. Try the export again.');
}

function formatDimensions(format: MediaFormat): { width: number; height: number } {
  const match = format.url.match(/\/(\d{2,5})x(\d{2,5})\//);
  return { width: format.width || Number(match?.[1]) || 0, height: format.height || Number(match?.[2]) || 0 };
}

/** Prefer a direct MP4 rendition within the selected media preset, preserving portrait orientation. */
export function selectVideoFormat(media: PostMedia, quality: 720 | 1080): MediaFormat {
  const candidates = media.formats.filter(f => /\.mp4(?:\?|$)/i.test(f.url) || /mp4/i.test(f.type || ''));
  if (!candidates.length && /\.mp4(?:\?|$)/i.test(media.url)) candidates.push({ url: media.url, width: media.width, height: media.height });
  if (!candidates.length) throw new Error('This attachment has no direct MP4 video. Live broadcasts and external players are not supported yet.');
  const isH264 = (format: MediaFormat) => format.codec
    ? /^(?:h\.?264|avc|avc1|avc3)(?:[.\s/-]|$)/i.test(format.codec)
    : /\/(?:avc1|h264)\//i.test(format.url);
  const h264 = candidates.filter(isH264);
  const unknown = candidates.filter(format => !format.codec);
  // Prefer the broadly supported decoder before comparing resolution or bitrate.
  // Legacy responses omit codec, so retain those as a fallback. Other codecs are
  // still usable when they are the only source; the worker checks actual support.
  const compatible = h264.length ? h264 : unknown.length ? unknown : candidates;
  const ranked = compatible.map(f => ({ format: f, ...formatDimensions(f) })).sort((a, b) => ((b.width * b.height) - (a.width * a.height)) || ((b.format.bitrate || 0) - (a.format.bitrate || 0)));
  const maxLongSide = Math.round(quality * 16 / 9);
  const fits = ranked.filter(f => f.width && f.height && Math.min(f.width, f.height) <= quality && Math.max(f.width, f.height) <= maxLongSide);
  if (fits.length) return fits[0].format;
  const known = ranked.filter(f => f.width && f.height);
  // When every rendition exceeds the preset, download the smallest and scale down during composition.
  if (known.length) return known[known.length - 1].format;
  return ranked.sort((a, b) => (b.format.bitrate || 0) - (a.format.bitrate || 0))[0].format;
}

export async function fetchVideo(media: PostMedia, quality: 720 | 1080, signal?: AbortSignal): Promise<Blob> {
  if (media.duration && media.duration > LIMITS.videoSeconds + 0.1) throw new Error('Browser video export currently supports clips up to 2 minutes.');
  const format = selectVideoFormat(media, quality);
  const url = new URL(format.url, location.href);
  if (url.protocol !== 'https:' || !/(^|\.)twimg\.com$/.test(url.hostname)) throw new Error('The post provider returned an unsupported video source.');
  let response: Response;
  // X's media CDN rejects some non-X referrers even when its CORS policy permits the origin.
  try { response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' }); }
  catch (error) {
    if (signal?.aborted) throw new DOMException('Export canceled.', 'AbortError');
    throw new Error('The video could not be downloaded from X. Its media server may be unavailable or blocking browser access.');
  }
  if (!response.ok) throw new Error(`X could not serve this video (${response.status}). Try reloading the post.`);
  const contentLength = Number(response.headers.get('content-length'));
  if (contentLength > LIMITS.sourceBytes) { await response.body?.cancel(); assertSourceSize(contentLength); }
  if (!response.body) { const blob = await response.blob(); assertSourceSize(blob.size); return blob; }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMITS.sourceBytes) { await reader.cancel(); assertSourceSize(size); }
      chunks.push(value as Uint8Array<ArrayBuffer>);
    }
  } finally { reader.releaseLock(); }
  assertSourceSize(size);
  return new Blob(chunks, { type: 'video/mp4' });
}

export async function inspectVideo(source: Blob): Promise<VideoInfo> {
  assertSourceSize(source.size);
  const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new Error('The attachment does not contain a playable video track.');
    const duration = await video.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('The video duration could not be read.');
    if (duration > LIMITS.videoSeconds + 0.1) throw new Error('Browser video export currently supports clips up to 2 minutes.');
    const audio = await input.getPrimaryAudioTrack();
    return { width: video.displayWidth, height: video.displayHeight, duration, hasAudio: Boolean(audio), videoCodec: video.codec, audioCodec: audio?.codec || null };
  } finally { input.dispose(); }
}

/** QA helper: compare every encoded AAC packet without decoding/re-encoding audio. */
export async function verifyAudioPassthrough(source: Blob, result: Blob): Promise<{ identical: boolean; packets: number }> {
  const sourceInput = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  const resultInput = new Input({ source: new BlobSource(result), formats: ALL_FORMATS });
  try {
    const sourceTrack = await sourceInput.getPrimaryAudioTrack();
    const resultTrack = await resultInput.getPrimaryAudioTrack();
    if (!sourceTrack || !resultTrack) return { identical: sourceTrack === resultTrack, packets: 0 };
    if (sourceTrack.codec !== 'aac' || resultTrack.codec !== 'aac') return { identical: false, packets: 0 };
    const a = new EncodedPacketSink(sourceTrack).packets();
    const b = new EncodedPacketSink(resultTrack).packets();
    let packets = 0;
    while (true) {
      const [left, right] = await Promise.all([a.next(), b.next()]);
      if (left.done || right.done) return { identical: left.done === right.done, packets };
      if (left.value.data.length !== right.value.data.length || !left.value.data.every((value, index) => value === right.value.data[index])) return { identical: false, packets };
      packets++;
    }
  } finally { sourceInput.dispose(); resultInput.dispose(); }
}

export function exportVideo(source: Blob, frame: FrameSnapshot, options: ExportVideoOptions = {}): Promise<Blob> {
  assertSourceSize(source.size);
  assertFrame(frame);
  if (options.signal?.aborted) return Promise.reject(new DOMException('Export canceled.', 'AbortError'));
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined' || typeof OffscreenCanvas === 'undefined') return Promise.reject(new Error('Video export requires desktop Chrome or Edge with WebCodecs support. Image downloads still work in this browser.'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./video.worker.ts', import.meta.url), { type: 'module' });
    let settled = false;
    const clean = () => { options.signal?.removeEventListener('abort', abort); worker.terminate(); };
    const fail = (error: Error) => { if (settled) return; settled = true; clean(); reject(error); };
    const abort = () => fail(new DOMException('Export canceled.', 'AbortError'));
    options.signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => fail(new Error('The video worker stopped unexpectedly. Try 720p or close other memory-heavy tabs.'));
    worker.onmessage = (event: MessageEvent<VideoWorkerResponse>) => {
      const message = event.data;
      if (message.type === 'progress') options.onProgress?.(message.progress);
      else if (message.type === 'error') fail(new Error(message.message));
      else if (!settled) { settled = true; clean(); options.onProgress?.(1); resolve(message.blob); }
    };
    worker.postMessage({ type: 'start', source, frame } satisfies VideoWorkerRequest);
    if (options.signal?.aborted) abort();
  });
}
