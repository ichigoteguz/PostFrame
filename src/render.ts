import { toCanvas } from 'html-to-image';
import { LIMITS } from './types';
import type { Aperture, ExportSettings, FrameSnapshot } from './types';

export interface CaptureOptions { videoSize?: { width: number; height: number }; videoMode?: boolean }
export function getFrameDimensions(element: HTMLElement, settings: ExportSettings, options: CaptureOptions = {}) {
  const logicalWidth = element.offsetWidth;
  const logicalHeight = element.offsetHeight;
  if (!logicalWidth || !logicalHeight) throw new Error('The post preview is not ready yet.');
  const apertureNode = element.querySelector<HTMLElement>('[data-video-aperture="true"]');
  let ratio: number = settings.scale;
  if (options.videoMode) {
    if (!apertureNode || !options.videoSize) throw new Error('Select a video before exporting an MP4.');
    const long = settings.videoQuality * 16 / 9;
    const sourceScale = Math.min(1, long / Math.max(options.videoSize.width, options.videoSize.height), settings.videoQuality / Math.min(options.videoSize.width, options.videoSize.height));
    ratio = (options.videoSize.width * sourceScale) / apertureNode.offsetWidth;
  }
  const even = (n: number) => Math.max(2, Math.ceil(n / 2) * 2);
  const width = options.videoMode ? even(logicalWidth * ratio) : Math.ceil(logicalWidth * ratio);
  const height = options.videoMode ? even(logicalHeight * ratio) : Math.ceil(logicalHeight * ratio);
  const sideLimit = options.videoMode ? LIMITS.videoSide : LIMITS.imageSide;
  const pixelLimit = options.videoMode ? LIMITS.videoPixels : LIMITS.imagePixels;
  if (width > sideLimit || height > sideLimit || width * height > pixelLimit) throw new Error(`This layout would be ${width.toLocaleString()} × ${height.toLocaleString()} px, above the ${options.videoMode ? 'video' : 'image'} export limit. Choose a lower ${options.videoMode ? 'quality' : 'resolution'}, less padding, or Auto aspect ratio.`);
  let aperture: Aperture | undefined;
  if (apertureNode) {
    const frameRect = element.getBoundingClientRect();
    const slotRect = apertureNode.getBoundingClientRect();
    aperture = { x: (slotRect.x - frameRect.x) * ratio, y: (slotRect.y - frameRect.y) * ratio, width: slotRect.width * ratio, height: slotRect.height * ratio, radius: parseFloat(getComputedStyle(apertureNode).borderTopLeftRadius) * ratio };
  }
  return { width, height, ratio, aperture };
}
export async function captureFrame(element: HTMLElement, settings: ExportSettings, options: CaptureOptions = {}): Promise<FrameSnapshot> {
  await document.fonts.ready;
  await Promise.all([...element.querySelectorAll('img')].map(img => img.decode().catch(() => { throw new Error('A post image could not be loaded. Load the post again and retry.'); })));
  const { width, height, ratio, aperture } = getFrameDimensions(element, settings, options);
  const captured = await toCanvas(element, { pixelRatio: ratio, width: element.offsetWidth, height: element.offsetHeight, skipAutoScale: true, cacheBust: false, filter: node => !(node instanceof HTMLElement && (node.classList.contains('media-play') || node.classList.contains('media-duration'))) });
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the export canvas.');
  if (options.videoMode || settings.format === 'jpg') { ctx.fillStyle = settings.theme === 'light' ? '#ffffff' : settings.theme === 'dim' ? '#15202b' : '#0b0d0f'; ctx.fillRect(0, 0, width, height); }
  ctx.drawImage(captured, 0, 0);
  const type = options.videoMode || settings.format === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('The browser could not save this image. Try a lower resolution.')), type, 0.95));
  if (blob.type !== type) throw new Error(`This browser does not support ${settings.format.toUpperCase()} image export.`);
  captured.width = 0; captured.height = 0; canvas.width = 0; canvas.height = 0;
  return { blob, width, height, aperture };
}
