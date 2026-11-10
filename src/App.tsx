import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, Check, CircleHelp, Clapperboard, Crop, ExternalLink, Film, Frame, Github, Image as ImageIcon, Link2, LoaderCircle, Maximize, Moon, RotateCcw, ShieldCheck, Sun, X } from 'lucide-react';
import { DEFAULT_SETTINGS, LIMITS } from './types';
import type { Background, ExportSettings, MediaSelection, Post } from './types';
import { DEMO_POST } from './demo';
import { loadPost } from './provider';
import { allMedia, BACKGROUNDS, firstMotion, getSelectedMedia, PostFrameView } from './PostCard';
import { captureFrame, getFrameDimensions } from './render';
import { exportVideo, fetchVideo, inspectVideo } from './video';
import type { VideoInfo } from './video';

const STORAGE_KEY = 'postframe.settings.v1';
function storedSettings(): ExportSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const allowed: Record<keyof ExportSettings, readonly unknown[]> = { theme: ['light', 'dim', 'dark'], background: Object.keys(BACKGROUNDS), padding: ['s', 'm', 'l'], aspect: ['auto', '1:1', '4:5', '16:9', '9:16'], format: ['png', 'jpg'], scale: [2, 3, 4], videoQuality: [720, 1080] };
    return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => [key, allowed[key as keyof ExportSettings].includes(stored[key]) ? stored[key] : value])) as unknown as ExportSettings;
  } catch { return DEFAULT_SETTINGS; }
}
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
function Options<T extends string | number>({ label, value, values, onChange, disabled, className = '' }: { label: string; value: T; values: { value: T; label: string; icon?: React.ReactNode }[]; onChange: (value: T) => void; disabled?: boolean; className?: string }) {
  return <div className={`segmented ${className}`} role="group" aria-label={label}>{values.map(item => <button key={item.value} type="button" disabled={disabled} aria-pressed={value === item.value} className={value === item.value ? 'active' : ''} onClick={() => onChange(item.value)}>{item.icon}{item.label}</button>)}</div>;
}
function Preview({ post, settings, selection, demo, videoUrl }: { post: Post; settings: ExportSettings; selection?: MediaSelection; demo: boolean; videoUrl?: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 600, height: 550, scale: .8 });
  useLayoutEffect(() => {
    const outer = outerRef.current, frame = frameRef.current;
    if (!outer || !frame) return;
    const measure = () => setBounds({ width: frame.offsetWidth, height: frame.offsetHeight, scale: Math.min((outer.clientWidth - 64) / frame.offsetWidth, 1) });
    const observer = new ResizeObserver(measure); observer.observe(outer); observer.observe(frame); measure();
    return () => observer.disconnect();
  }, [post, settings, selection]);
  const media = getSelectedMedia(post, selection);
  return <div className="preview-stage" ref={outerRef}><div className="preview-scaled-space" style={{ width: bounds.width * bounds.scale, height: bounds.height * bounds.scale }}><div className="preview-scaled-frame" style={{ transform: `scale(${bounds.scale})` }}><PostFrameView ref={frameRef} post={post} settings={settings} selection={selection} videoUrl={!demo && media?.type !== 'photo' ? videoUrl : undefined}/></div></div></div>;
}
export default function App() {
  const [post, setPost] = useState<Post>(DEMO_POST);
  const [demo, setDemo] = useState(true);
  const [url, setUrl] = useState('');
  const [settings, setSettings] = useState<ExportSettings>(storedSettings);
  const [selection, setSelection] = useState<MediaSelection | undefined>(() => firstMotion(DEMO_POST));
  const [mode, setMode] = useState<'image' | 'video'>(() => firstMotion(DEMO_POST) ? 'video' : 'image');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'preparing' | 'exporting'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [help, setHelp] = useState(false);
  const [videoSource, setVideoSource] = useState<{ key: string; blob: Blob; info: VideoInfo; url: string } | null>(null);
  const [videoCheck, setVideoCheck] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const exportRef = useRef<HTMLDivElement>(null);
  const taskRef = useRef<AbortController | null>(null);
  const busy = phase !== 'idle';
  const mediaList = allMedia(post);
  const selectedMedia = getSelectedMedia(post, selection);
  const hasVideo = selectedMedia && selectedMedia.type !== 'photo';
  const videoMode = mode === 'video' && !!hasVideo;
  const browserSupportsVideo = typeof VideoEncoder !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
  const videoKey = videoMode && !demo && selectedMedia ? `${post.id}:${selection?.postId}:${selectedMedia.id}:${settings.videoQuality}` : undefined;
  const readyVideo = videoSource && videoSource.key === videoKey ? videoSource : null;
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* Preferences are optional. */ } }, [settings]);
  useEffect(() => () => taskRef.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    let sourceUrl: string | undefined;
    setVideoSource(null);
    if (!videoKey || !selectedMedia || !browserSupportsVideo) { setVideoCheck('idle'); return () => controller.abort(); }
    setVideoCheck('loading'); setError('');
    void (async () => {
      try {
        const source = await fetchVideo(selectedMedia, settings.videoQuality, controller.signal);
        const info = await inspectVideo(source);
        if (controller.signal.aborted) return;
        if (info.duration > LIMITS.videoSeconds + .1) throw new Error('This first version supports videos up to 2 minutes. Choose another attachment or export a still image.');
        sourceUrl = URL.createObjectURL(source);
        setVideoSource({ key: videoKey, blob: source, info, url: sourceUrl });
        setVideoCheck('ready');
      } catch (e) {
        if (!controller.signal.aborted) { setVideoCheck('error'); setError(e instanceof Error ? e.message : 'The selected video could not be prepared. Reload the post or choose another quality.'); }
      }
    })();
    return () => { controller.abort(); if (sourceUrl) URL.revokeObjectURL(sourceUrl); };
  }, [videoKey, selectedMedia, settings.videoQuality, browserSupportsVideo]);
  useEffect(() => {
    const node = exportRef.current;
    if (!node) return;
    const update = () => {
      if (videoMode && !readyVideo) { setDimensions(videoCheck === 'error' ? 'Video unavailable' : demo ? 'Load a video post' : !browserSupportsVideo ? 'Video not supported' : 'Checking video…'); return; }
      try { const size = getFrameDimensions(node, settings, videoMode && readyVideo ? { videoMode: true, videoSize: readyVideo.info } : {}); setDimensions(`${size.width.toLocaleString()} × ${size.height.toLocaleString()} px`); } catch (e) { setDimensions(e instanceof Error ? e.message : 'Layout is too large'); }
    };
    const observer = new ResizeObserver(update); observer.observe(node); update();
    return () => observer.disconnect();
  }, [post, settings, selection, videoMode, readyVideo, videoCheck, demo, browserSupportsVideo]);
  function update<K extends keyof ExportSettings>(key: K, value: ExportSettings[K]) { setSettings(current => ({ ...current, [key]: value })); setNotice(''); }
  async function load(event: React.FormEvent) {
    event.preventDefault(); if (!url.trim() || busy) return;
    const controller = new AbortController(); taskRef.current = controller;
    setPhase('loading'); setError(''); setNotice('');
    try {
      const result = await loadPost(url, controller.signal);
      if (controller.signal.aborted) return;
      setPost(result); setDemo(false); const motion = firstMotion(result); setSelection(motion); setMode(motion ? 'video' : 'image');
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'The post could not be loaded. Please try again.'); }
    finally { if (taskRef.current === controller) { taskRef.current = null; setPhase('idle'); } }
  }
  async function save() {
    if (busy || !exportRef.current || (videoMode && !readyVideo)) return;
    const controller = new AbortController(); taskRef.current = controller;
    setPhase('preparing'); setError(''); setNotice(''); setProgress(0);
    try {
      let blob: Blob;
      if (videoMode && readyVideo) {
        const frame = await captureFrame(exportRef.current, settings, { videoMode: true, videoSize: readyVideo.info });
        if (controller.signal.aborted) return;
        setDimensions(`${frame.width.toLocaleString()} × ${frame.height.toLocaleString()} px`); setPhase('exporting');
        blob = await exportVideo(readyVideo.blob, frame, { signal: controller.signal, onProgress: setProgress });
      } else {
        const frame = await captureFrame(exportRef.current, settings); blob = frame.blob;
      }
      if (controller.signal.aborted) return;
      downloadBlob(blob, `postframe-${post.author.handle}-${post.id}${selection ? `-${selection.mediaId}` : ''}.${videoMode ? 'mp4' : settings.format}`);
      setNotice(`${videoMode ? 'Your framed video' : 'Your image'} is ready. Download started.`);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Export failed. Try a smaller layout or lower quality.'); }
    finally { if (taskRef.current === controller) { taskRef.current = null; setPhase('idle'); } }
  }
  function cancel() { taskRef.current?.abort(); setNotice('Canceled. You can start another export.'); }
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href={import.meta.env.BASE_URL} aria-label="PostFrame home"><span className="brand-mark"><Frame size={23} strokeWidth={2.3}/><i/></span><span>PostFrame<span className="brand-dot">.</span></span></a><nav aria-label="Main navigation"><button className="nav-help" onClick={() => setHelp(value => !value)}><CircleHelp size={15}/>How it works</button><a href="https://github.com/ichigoteguz/PostFrame" target="_blank" rel="noreferrer"><Github size={17}/><span>View on GitHub</span><ExternalLink size={12}/></a></nav></header>
    <main>
      <section className="intro"><div className="eyebrow"><span/><span>THE POST. THE CONTEXT. THE WHOLE PICTURE.</span></div><h1>Keep the <span>whole post.</span></h1><p className="intro-description">For that one friend who doesn't want to create a Twitter account, so sharing memes becomes more difficult than it has to be.</p><div className="format-pills"><span><ImageIcon size={14}/>Images</span><i>+</i><span><Film size={14}/>Framed videos</span><span className="private-pill"><ShieldCheck size={13}/>Made in your browser</span></div>
      <form className="url-form" onSubmit={load}><Link2 size={19}/><label className="sr-only" htmlFor="post-url">X or Twitter post URL</label><input id="post-url" type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="Paste an X / Twitter post link…" required disabled={busy} autoComplete="off" spellCheck={false}/><button type="submit" disabled={busy || !url.trim()}>{phase === 'loading' ? <LoaderCircle size={17} className="spin"/> : null}<span>{phase === 'loading' ? 'Loading…' : 'Load post'}</span>{phase !== 'loading' && <ArrowRight size={17}/>}</button></form>
      <div className="url-hint">Public posts only. No sign-in. No watermark.</div>
      {help && <div className="help-panel"><button aria-label="Close help" onClick={() => setHelp(false)}><X size={17}/></button><b>One link. A little context. Ready to share.</b><p>Copy the link to a public X post, paste it above, and choose your look. Pick a single video to give it the full media area, then download an MP4 with the post around it. Photos and text-only posts download as images.</p><p>Posts load through FxTwitter. Your downloads are created on your device. Video export is designed for desktop Chrome and Edge and supports clips up to two minutes.</p></div>}
      </section>
      <div className="workspace-heading"><div><span className="tiny-dot"/>YOUR STUDIO</div><span>{demo ? 'A little preview of what’s possible' : `@${post.author.handle} · Post loaded`}</span></div>
      <section className="workspace" aria-label="Post customization studio">
        <aside className="settings-panel"><div className="settings-top"><h2>Make it yours</h2><button className="reset-button" title="Reset appearance" aria-label="Reset appearance" disabled={busy} onClick={() => { setSettings(DEFAULT_SETTINGS); setNotice('Appearance reset.'); }}><RotateCcw size={15}/></button></div>
          <div className="settings-section"><div className="control-label">EXPORT TYPE</div><Options label="Export type" value={mode} values={[{ value: 'image', label: 'Image', icon: <ImageIcon size={15}/> }, { value: 'video', label: 'Video', icon: <Film size={15}/> }]} onChange={value => { setMode(value); if (value === 'video' && !hasVideo) setSelection(firstMotion(post)); }} disabled={busy || !mediaList.some(item => item.media.type !== 'photo')}/>{videoMode && <p className="control-note">The video moves. The post stays.</p>}</div>
          <div className="settings-section"><div className="control-label">POST THEME</div><Options label="Post theme" value={settings.theme} values={[{ value: 'light', label: 'Light', icon: <Sun size={14}/> }, { value: 'dim', label: 'Dim', icon: <Moon size={14}/> }, { value: 'dark', label: 'Dark', icon: <span className="theme-dot"/> }]} onChange={value => update('theme', value)} disabled={busy}/></div>
          <div className="settings-section"><div className="control-label">BACKGROUND<span>{settings.background === 'none' ? 'None' : settings.background[0].toUpperCase() + settings.background.slice(1)}</span></div><div className="background-grid" role="group" aria-label="Background">{(Object.keys(BACKGROUNDS) as Background[]).map(background => <button key={background} aria-label={`Background ${background}`} title={background[0].toUpperCase() + background.slice(1)} aria-pressed={settings.background === background} disabled={busy} onClick={() => update('background', background)} className={`background-swatch ${background === 'none' ? 'no-background' : ''}${background === settings.background ? ' selected' : ''}`} style={{ background: BACKGROUNDS[background] }}>{background === 'none' ? <span/> : settings.background === background ? <Check size={14} strokeWidth={3}/> : null}</button>)}</div></div>
          <div className="settings-section padding-aspect"><div><div className="control-label">PADDING</div><Options label="Padding" value={settings.padding} values={[{ value: 's', label: 'S' }, { value: 'm', label: 'M' }, { value: 'l', label: 'L' }]} onChange={value => update('padding', value)} disabled={busy || settings.background === 'none'}/></div><div><div className="control-label">ASPECT RATIO</div><Options label="Aspect ratio" className="aspect-options" value={settings.aspect} values={[{ value: 'auto', label: 'Auto' }, { value: '1:1', label: '1:1' }, { value: '4:5', label: '4:5' }, { value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }]} onChange={value => update('aspect', value)} disabled={busy || settings.background === 'none'}/></div>{settings.background === 'none' && <p className="control-note"><Crop size={12}/>Add a background to set padding and ratio.</p>}</div>
          <div className="settings-section output-settings">{videoMode ? <><div className="control-label">VIDEO QUALITY</div><Options label="Video quality" value={settings.videoQuality} values={[{ value: 720, label: '720p · Fast' }, { value: 1080, label: '1080p' }]} onChange={value => update('videoQuality', value)} disabled={busy}/><div className="output-caption"><span className="file-chip">MP4</span>Full video · Original audio</div></> : <><div className="control-label">FORMAT</div><Options label="Image format" value={settings.format} values={[{ value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPG' }]} onChange={value => update('format', value)} disabled={busy}/><div className="control-label resolution-label">RESOLUTION</div><Options label="Image resolution" value={settings.scale} values={[{ value: 2, label: '2×' }, { value: 3, label: '3×' }, { value: 4, label: '4×' }]} onChange={value => update('scale', value)} disabled={busy}/></>}</div>
          <div className="local-note"><ShieldCheck size={17}/><div><b>Yours, from start to finish.</b><span>Files are made locally in your browser.</span></div></div>
        </aside>
        <div className="preview-panel"><div className="preview-toolbar"><div><span className="preview-dot"/>Live preview{demo && <span className="sample-label">SAMPLE POST</span>}</div><span className="preview-size"><Maximize size={13}/>{dimensions.length < 35 ? dimensions : 'Large layout'}</span></div>
          {mediaList.length > 1 && <div className="media-selector"><span>Media</span>{mediaList.every(item => item.media.type === 'photo') && <button aria-pressed={!selection} disabled={busy} onClick={() => { setSelection(undefined); setMode('image'); }}>All images</button>}{mediaList.map((item, i) => <button key={`${item.postId}-${item.media.id}`} disabled={busy} aria-pressed={selection?.mediaId === item.media.id && selection?.postId === item.postId} onClick={() => { setSelection({ postId: item.postId, mediaId: item.media.id }); setMode(item.media.type === 'photo' ? 'image' : 'video'); }}>{item.media.type === 'photo' ? <ImageIcon size={12}/> : <Film size={12}/>} {i + 1}</button>)}<small>One attachment. Full frame.</small></div>}
          <Preview post={post} settings={settings} selection={selection} demo={demo} videoUrl={readyVideo?.url}/>
          <div className="preview-bottom"><span><Check size={14}/>No watermark. Just the post.</span><span>{videoMode ? <><Clapperboard size={14}/>Framed video</> : <><ImageIcon size={14}/>High-resolution image</>}</span></div>
        </div>
      </section>
      <section className="download-bar" aria-label="Download export"><div className="export-summary"><span className="export-icon">{videoMode ? <Film size={20}/> : <ImageIcon size={20}/>}</span><div><b>{videoMode ? 'A video worth keeping in context.' : 'A post worth keeping.'}</b><span>{videoMode ? `MP4 · ${settings.videoQuality}p media · Audio preserved` : `${settings.format.toUpperCase()} · ${settings.scale}× resolution`}{dimensions.length < 35 ? ` · ${dimensions}` : ''}</span></div></div><div className="download-actions">{busy && <button className="cancel-button" onClick={cancel}>Cancel</button>}<button className="download-button" onClick={save} disabled={busy || (videoMode && !readyVideo)}>{busy || (videoMode && videoCheck === 'loading') ? <LoaderCircle className="spin" size={18}/> : <ArrowDownToLine size={18}/>}<span>{phase === 'loading' ? 'Loading post…' : phase === 'preparing' ? 'Preparing…' : phase === 'exporting' ? `Exporting ${Math.round(progress * 100)}%` : videoMode && videoCheck === 'loading' ? 'Checking video…' : `Download ${videoMode ? 'video' : 'image'}`}</span>{!busy && <span className="download-extension">{videoMode ? '.mp4' : `.${settings.format}`}</span>}</button></div>{phase === 'exporting' && <div className="export-progress" role="progressbar" aria-label="Video export progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress * 100}%` }}/></div>}</section>
      <div className="status-area" aria-live="polite">{error && <div className="status-message error" role="alert"><CircleHelp size={17}/><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={15}/></button></div>}{notice && <div className="status-message success"><Check size={17}/>{notice}</div>}{!error && !notice && demo && videoMode && <p>Paste a post link to export its video. You can try an image download with this sample.</p>}{!error && !notice && !demo && videoMode && !browserSupportsVideo && <p>Video export needs desktop Chrome or Edge with H.264 support. Image export is still available.</p>}{!error && dimensions.length >= 35 && <p className="dimension-warning">{dimensions}</p>}</div>
      <div className="features-row"><div><span className="feature-number">01</span><b>Paste a post</b><span>Bring the link. We’ll bring the context.</span></div><div><span className="feature-number">02</span><b>Find your frame</b><span>Your theme, your background, your style.</span></div><div><span className="feature-number">03</span><b>Keep it moving</b><span>Download an image or a framed video.</span></div></div>
    </main><footer className="site-footer"><div className="footer-brand"><Frame size={15}/>PostFrame<span>Keep the whole post.</span></div><span>Built for sharing, with context.</span><a href="https://docs.fxembed.com/api/introduction/" target="_blank" rel="noreferrer">Post data by FxTwitter<ArrowRight size={12}/></a></footer>
    <p className="dedication">For Marcy, with love</p>
    <div className="export-offscreen" aria-hidden="true"><PostFrameView ref={exportRef} post={post} settings={settings} selection={selection} blankVideo={videoMode}/></div>
  </div>;
}
