import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, Quality, canEncodeVideo } from 'mediabunny';
import { LIMITS } from './types';
import type { VideoWorkerRequest, VideoWorkerResponse } from './video';

const scope = self as unknown as { postMessage: (message: VideoWorkerResponse) => void; addEventListener: (type: 'message', listener: (event: MessageEvent<VideoWorkerRequest>) => void) => void };

scope.addEventListener('message', event => {
  if (event.data.type === 'start') void convert(event.data);
});

async function convert({ source, frame }: VideoWorkerRequest) {
  const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  let bitmap: ImageBitmap | undefined;
  let output: Output | undefined;
  try {
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    if (!video || !(await video.canDecode())) throw new Error('Your browser cannot decode this source video. Try another attachment or a current desktop Chrome/Edge browser.');
    const duration = await video.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0 || duration > LIMITS.videoSeconds + 0.1) throw new Error('Browser video export supports clips up to 2 minutes.');
    const { width, height, aperture } = frame;
    if (!aperture || source.size > LIMITS.sourceBytes || width * height > LIMITS.videoPixels || width > LIMITS.videoSide || height > LIMITS.videoSide) throw new Error('This export exceeds the browser video limits. Choose a smaller size.');
    const quality = new Quality({ bitrate: Math.min(12_000_000, Math.max(3_000_000, width * height * 3)) });
    if (!(await canEncodeVideo('avc', { width, height, frameRate: 30, quality }))) throw new Error(`Your browser cannot encode H.264 at ${width} × ${height}. Try 720p, a smaller background, or desktop Chrome/Edge.`);
    bitmap = await createImageBitmap(frame.blob);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('The browser could not allocate the video canvas. Try a smaller export.');
    const target = new BufferTarget();
    output = new Output({ format: new Mp4OutputFormat({ fastStart: 'reserve' }), target });
    const conversion = await Conversion.init({
      input, output, tracks: 'primary', showWarnings: false,
      video: {
        codec: 'avc', quality, frameRate: 30, allowTransformationMetadata: false,
        processedWidth: width, processedHeight: height,
        process(sample) {
          // Snapshot contains the complete post and a blank media slot. Only the video rectangle changes.
          ctx.drawImage(bitmap!, 0, 0, width, height);
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(aperture.x, aperture.y, aperture.width, aperture.height, Math.min(aperture.radius, aperture.width / 2, aperture.height / 2));
          ctx.clip();
          ctx.fillStyle = '#000';
          ctx.fillRect(aperture.x, aperture.y, aperture.width, aperture.height);
          const scale = Math.min(aperture.width / sample.displayWidth, aperture.height / sample.displayHeight);
          const dw = sample.displayWidth * scale;
          const dh = sample.displayHeight * scale;
          sample.draw(ctx, aperture.x + (aperture.width - dw) / 2, aperture.y + (aperture.height - dh) / 2, dw, dh);
          ctx.restore();
          return canvas;
        },
      },
      // Compatible AAC packets are copied. Request AAC only when another source codec needs conversion.
      audio: audio?.codec === 'aac' ? {} : { codec: 'aac' },
    });
    if (!conversion.isValid || !conversion.utilizedTracks.includes(video)) throw new Error('This browser cannot encode the selected video configuration. Try 720p or desktop Chrome/Edge.');
    if (audio && !conversion.utilizedTracks.includes(audio)) {
      await conversion.cancel();
      throw new Error('This browser cannot preserve the source audio. Export stopped to avoid producing a silent copy.');
    }
    let lastProgress = -1;
    conversion.onProgress = progress => {
      const percent = Math.floor(progress * 100);
      if (percent !== lastProgress) { lastProgress = percent; scope.postMessage({ type: 'progress', progress: Math.min(progress, 0.99) }); }
    };
    await conversion.execute();
    if (!target.buffer?.byteLength) throw new Error('The encoder produced an empty file. Please try again.');
    scope.postMessage({ type: 'result', blob: new Blob([target.buffer], { type: 'video/mp4' }) });
  } catch (error) {
    await output?.cancel().catch(() => undefined);
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Video export failed. Try a smaller size.' });
  } finally { bitmap?.close(); input.dispose(); }
}
