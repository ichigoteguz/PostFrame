import { useRef, useState } from 'react';
import { DEFAULT_SETTINGS, type Post } from './types';
import { PostFrameView } from './PostCard';
import { captureFrame } from './render';
import { createBenchmarkSource } from './benchmark';
import { exportVideo, inspectVideo, verifyAudioPassthrough } from './video';

const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#d6f675"/><text x="40" y="53" text-anchor="middle" font-family="Arial" font-size="36" fill="#161d0a">P</text></svg>');
const post: Post = { id:'qa', url:'https://x.com/postframe/status/20', author:{ name:'PostFrame Studio', handle:'postframe', avatar, verified:true }, text:'Keep the motion. Keep the context.\n\nA full two-minute video, with its original audio, inside a static post frame. 🎬', facets:[], createdAt:'2026-11-09T17:00:00Z', media:[{id:'qa-video',type:'video',url:'',thumbnail:avatar,width:1280,height:720,formats:[]}], quote:{id:'quote',url:'https://x.com/postframe/status/21',author:{name:'The detail matters',handle:'studio',avatar,verified:false},text:'Rounded video edges. Sharp text. The whole post stays with you.',facets:[],createdAt:'2026-11-09T16:00:00Z',media:[]} };
const settings = {...DEFAULT_SETTINGS,theme:'dark' as const};
const selection = { postId:'qa', mediaId:'qa-video' };

async function save(name:string, data:Blob|string) {
  const response = await fetch(`${import.meta.env.BASE_URL}__qa/${name}`, {method:'POST',body:data});
  if (!response.ok) throw new Error(`Could not save QA artifact ${name}`);
}
async function stillAt(blob:Blob, time:number) {
  const video = document.createElement('video'); const url = URL.createObjectURL(blob);
  try {
    video.muted = true; video.preload = 'auto'; video.src = url;
    await new Promise<void>((resolve,reject) => {video.onloadeddata=()=>resolve(); video.onerror=()=>reject(new Error('Export does not play'));});
    video.currentTime = Math.min(time, video.duration - .1);
    await new Promise<void>((resolve,reject) => {video.onseeked=()=>resolve(); video.onerror=()=>reject(new Error('Export cannot seek'));});
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
    canvas.getContext('2d')!.drawImage(video,0,0);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No screenshot')),'image/png'));
  } finally {video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}

export default function Benchmark() {
  const root=useRef<HTMLDivElement>(null); const abort=useRef<AbortController|null>(null);
  const [status,setStatus]=useState('Ready');const [busy,setBusy]=useState(false); const [result,setResult]=useState('');const [output,setOutput]=useState('');
  async function run(seconds:number) {
    setBusy(true);setResult('');abort.current=new AbortController(); const report:Record<string,unknown>={browser:navigator.userAgent,seconds,started:new Date().toISOString()};
    try {
      setStatus(`Generating ${seconds}-second 1280×720 H.264/AAC source…`);
      const started=performance.now(); const source=await createBenchmarkSource(seconds);report.sourceGenerationMs=Math.round(performance.now()-started);report.sourceBytes=source.size;report.source=await inspectVideo(source);
      setStatus('Capturing static dark post + quote…');
      const frame=await captureFrame(root.current!,settings,{videoMode:true,videoSize:{width:1280,height:720}});report.frame={width:frame.width,height:frame.height,aperture:frame.aperture};
      await save('frame.png',frame.blob);
      setStatus('Encoding framed MP4…');const encodeStart=performance.now();
      const encoded=await exportVideo(source,frame,{signal:abort.current.signal,onProgress:p=>setStatus(`Encoding framed MP4: ${Math.round(p*100)}%`)});
      report.encodeMs=Math.round(performance.now()-encodeStart);report.outputBytes=encoded.size;report.output=await inspectVideo(encoded);
      const meta=report.output as Awaited<ReturnType<typeof inspectVideo>>;
      if (!meta.hasAudio || Math.abs(meta.duration-seconds)>.1 || meta.width!==frame.width || meta.height!==frame.height) throw new Error('Output metadata failed acceptance check');
      report.audioPassthrough=await verifyAudioPassthrough(source,encoded);
      if(!(report.audioPassthrough as {identical:boolean}).identical)throw new Error('AAC packet passthrough changed audio');
      setStatus('Verifying playback and saving first/middle/final frames…');
      await save('output.mp4',encoded);
      for (const [label,time] of [['first',.1],['middle',seconds/2],['final',seconds-.2]] as const) await save(`${label}.png`,await stillAt(encoded,time));
      if(seconds===3){
        setStatus('Checking silent video, cancellation, repeat export, PNG and JPEG…');
        const silent=await createBenchmarkSource(2,{audio:false,width:720,height:1280});
        const silentResult=await exportVideo(silent,frame);
        const silentInfo=await inspectVideo(silentResult);if(silentInfo.hasAudio)throw new Error('Silent source gained an audio track');report.silentPortrait=silentInfo;
        const cancel=new AbortController();let canceled=false;
        try{await exportVideo(source,frame,{signal:cancel.signal,onProgress:()=>cancel.abort()});}catch(error){canceled=error instanceof DOMException&&error.name==='AbortError';}
        if(!canceled)throw new Error('Cancellation did not reject with AbortError');report.cancellation=true;
        const repeated=await exportVideo(source,frame);report.repeat=(await inspectVideo(repeated)).duration;
        const png=await captureFrame(root.current!,{...settings,format:'png'});const jpg=await captureFrame(root.current!,{...settings,format:'jpg'});
        if(png.blob.type!=='image/png'||jpg.blob.type!=='image/jpeg')throw new Error('Static format MIME check failed');report.staticFormats={png:png.blob.type,jpg:jpg.blob.type};
        await save('static.png',png.blob);await save('static.jpg',jpg.blob);
      }
      if (output) URL.revokeObjectURL(output);setOutput(URL.createObjectURL(encoded));
      report.ok=true;setStatus('PASS — framed MP4 plays with audio and correct duration');
    } catch(error) {report.ok=false;report.error=String(error);setStatus(`FAIL — ${String(error)}`);}
    finally {setResult(JSON.stringify(report,null,2));await save('report.json',JSON.stringify(report,null,2)).catch(()=>{});setBusy(false);}
  }
  return <main style={{maxWidth:1050,margin:'40px auto',padding:24,color:'#20251c',fontFamily:'Arial'}}><h1>PostFrame export acceptance test</h1><p>Development-only test: synthetic moving 720p video + AAC audio, static dark frame and quote.</p><div style={{display:'flex',gap:12,margin:'20px 0'}}><button disabled={busy} onClick={()=>run(3)}>Run 3-second smoke test</button><button disabled={busy} onClick={()=>run(120)}>Run two-minute acceptance test</button><button disabled={!busy} onClick={()=>abort.current?.abort()}>Cancel export</button></div><p role="status">{status}</p><pre style={{whiteSpace:'pre-wrap'}}>{result}</pre>{output&&<video src={output} controls style={{maxWidth:750,width:'100%'}}/>}<div style={{position:'absolute',left:-10000,top:0,width:600}}><PostFrameView ref={root} post={post} settings={settings} selection={selection} blankVideo /></div></main>;
}
