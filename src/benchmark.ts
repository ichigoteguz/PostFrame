import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, canEncodeAudio, canEncodeVideo } from 'mediabunny';

export interface BenchmarkOptions { signal?: AbortSignal; onProgress?: (progress: number) => void; audio?: boolean; width?: number; height?: number }

/** Generates a deterministic fixture offline. The clock and moving marker reveal dropped endings and frozen frames. */
export async function createBenchmarkSource(durationSeconds = 120, options: BenchmarkOptions = {}): Promise<Blob> {
  const seconds = Math.min(120, Math.max(1, durationSeconds));
  const fps = 30;
  const width = options.width || 1280;
  const height = options.height || 720;
  const frames = Math.round(seconds * fps);
  const quality = new Quality({ bitrate: 2_500_000 });
  if (!await canEncodeVideo('avc', { width, height, frameRate: fps, quality })) throw new Error('H.264 encoding is unavailable in this browser. Use desktop Chrome or Edge.');
  const withAudio = options.audio !== false;
  if (withAudio && !await canEncodeAudio('aac', { numberOfChannels: 1, sampleRate: 48000 })) throw new Error('AAC fixture generation is unavailable in this browser. Ordinary AAC source passthrough does not require this encoder.');
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'reserve' }), target });
  const video = new CanvasSource(canvas, { codec: 'avc', quality, keyFrameInterval: 1 });
  const audio = withAudio ? new AudioBufferSource({ codec: 'aac', quality: new Quality({ bitrate: 96_000 }) }) : null;
  output.addVideoTrack(video, { frameRate: fps, maximumPacketCount: frames + 4 });
  if (audio) output.addAudioTrack(audio, { maximumPacketCount: Math.ceil(seconds * 48000 / 1024) + 8 });
  const checkCancel = () => { if (options.signal?.aborted) throw new DOMException('Fixture generation canceled.', 'AbortError'); };
  try {
    checkCancel();
    await output.start();
    // Feed each track in parallel so muxer backpressure cannot deadlock a long single-track lead.
    await Promise.all([
      (async () => {
        for (let i = 0; i < frames; i++) {
          checkCancel();
          const t = i / fps;
          ctx.save();
          ctx.scale(width / 1280, height / 720);
          ctx.fillStyle = '#112826'; ctx.fillRect(0, 0, 1280, 720);
          const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
          gradient.addColorStop(0, '#183c39'); gradient.addColorStop(1, '#395238');
          ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1280, 720);
          ctx.fillStyle = '#d6f675'; ctx.font = '700 38px sans-serif'; ctx.fillText('POSTFRAME · VIDEO TEST', 70, 90);
          ctx.fillStyle = '#fff'; ctx.font = '700 116px monospace'; ctx.fillText(`${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`, 65, 315);
          ctx.font = '30px sans-serif'; ctx.fillStyle = '#c7dbce'; ctx.fillText(`${width} × ${height}  /  H.264  /  30 fps`, 70, 385);
          ctx.fillText(withAudio ? '440 Hz audio · one pulse each second' : 'Silent source · no audio track', 70, 435);
          ctx.fillStyle = '#d6f675'; ctx.beginPath(); ctx.arc(90 + ((t * 175) % 1090), 555 + Math.sin(t * Math.PI) * 30, 26, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(70, 650, 1140 * (i + 1) / frames, 9);
          ctx.restore();
          await video.add(t, 1 / fps);
          if (i % 30 === 0) { options.onProgress?.(i / frames); await new Promise(resolve => setTimeout(resolve, 0)); }
        }
        video.close();
      })(),
      (async () => {
        if (!audio) return;
        for (let offset = 0; offset < seconds; offset++) {
          checkCancel();
          const length = Math.round(Math.min(1, seconds - offset) * 48000);
          const buffer = new AudioBuffer({ numberOfChannels: 1, sampleRate: 48000, length });
          const channel = buffer.getChannelData(0);
          for (let i = 0; i < length; i++) {
            const t = i / 48000;
            // A pulse on each whole-second boundary makes A/V synchronization audibly checkable.
            channel[i] = Math.sin(2 * Math.PI * 440 * t) * (t < 0.13 ? 0.16 : 0.015);
          }
          await audio.add(buffer);
        }
        audio.close();
      })(),
    ]);
    checkCancel();
    await output.finalize();
    if (!target.buffer) throw new Error('Fixture encoding did not produce a file.');
    options.onProgress?.(1);
    return new Blob([target.buffer], { type: 'video/mp4' });
  } catch (error) { await output.cancel().catch(() => undefined); throw error; }
}
