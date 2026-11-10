import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { BadgeCheck, Play } from 'lucide-react';
import type { Background, ExportSettings, MediaSelection, Post, PostMedia } from './types';

export const BACKGROUNDS: Record<Background, string> = {
  none: 'transparent', white: '#ffffff', gray: '#e7e9ed', black: '#080a0b', blue: '#239de8',
  sunset: 'linear-gradient(135deg,#ffb46d 0%,#f66c76 50%,#b04bc5 100%)',
  ocean: 'linear-gradient(135deg,#63d9db 0%,#369bea 50%,#5864da 100%)',
  grape: 'linear-gradient(135deg,#c693f1 0%,#a55fdb 45%,#7048b5 100%)',
  mint: 'linear-gradient(135deg,#b9e7c5 0%,#79d2ba 50%,#61b8cd 100%)',
  peach: 'linear-gradient(135deg,#f6daa5 0%,#f7b2ae 55%,#e6b7db 100%)',
  night: 'linear-gradient(135deg,#343762 0%,#252344 45%,#111629 100%)',
};
export function allMedia(post: Post): { postId: string; media: PostMedia }[] {
  return [...post.media.map(media => ({ postId: post.id, media })), ...(post.quote ? allMedia(post.quote) : [])];
}
export function getSelectedMedia(post: Post, selection?: MediaSelection): PostMedia | undefined {
  return selection ? allMedia(post).find(item => item.postId === selection.postId && item.media.id === selection.mediaId)?.media : undefined;
}
export function firstMotion(post: Post): MediaSelection | undefined {
  const item = allMedia(post).find(item => item.media.type !== 'photo');
  return item ? { postId: item.postId, mediaId: item.media.id } : undefined;
}

function PostText({ post }: { post: Post }) {
  const facets = post.facets.filter(f => f.start >= 0 && f.end > f.start && f.end <= post.text.length);
  const breaks = [...new Set([0, post.text.length, ...facets.flatMap(f => [f.start, f.end])])].sort((a, b) => a - b);
  return <div className="post-text" dir="auto">{breaks.slice(0, -1).map((start, i) => {
    const end = breaks[i + 1];
    const active = facets.filter(f => f.start <= start && f.end >= end);
    const link = active.find(f => ['link', 'mention', 'hashtag'].includes(f.type));
    const display = link?.text && link.start === start && link.end === end ? link.text : post.text.slice(start, end);
    const style = { fontWeight: active.some(f => f.type === 'bold') ? 700 : undefined, fontStyle: active.some(f => f.type === 'italic') ? 'italic' : undefined };
    return <span key={start} className={link ? 'post-link' : undefined} style={style}>{display}</span>;
  })}</div>;
}
function XMark() {
  return <svg className="post-x" viewBox="0 0 24 24" aria-label="X" role="img"><path fill="currentColor" d="M18.9 1.5h3.68l-8.04 9.19L24 22.5h-7.4l-5.8-7.58-6.63 7.58H.49l8.6-9.84L0 1.5h7.59l5.24 6.93 6.07-6.93Zm-1.3 18.92h2.04L6.47 3.47H4.28L17.6 20.42Z"/></svg>;
}
function dateLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)} · ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)}`;
}
interface CardProps { post: Post; selection?: MediaSelection; blankVideo?: boolean; videoUrl?: string; quote?: boolean; depth?: number }
function Card({ post, selection, blankVideo = false, videoUrl, quote = false, depth = 0 }: CardProps) {
  const [playing, setPlaying] = useState(false);
  const items = selection ? (post.id === selection.postId ? post.media.filter(item => item.id === selection.mediaId) : []) : post.media;
  return <article className={`post-card${quote ? ' quoted-card' : ''}`}>
    <header className="post-author"><img className="post-avatar" src={post.author.avatar} alt=""/><div className="post-author-label"><div className="post-name">{post.author.name}{post.author.verified && <BadgeCheck className="verified-badge" size={19} aria-label="Verified"/>}</div><div className="post-handle">@{post.author.handle.replace(/^@/, '')}</div></div>{!quote && <XMark/>}</header>
    {post.replyingTo && <p className="post-reply">Replying to <span className="post-link">@{post.replyingTo.replace(/^@/, '')}</span></p>}
    {post.text && <PostText post={post}/>}
    {items.length > 0 && <div className={`post-media-grid media-count-${Math.min(items.length, 4)}`}>{items.map((media, index) => {
      const isMotion = media.type !== 'photo';
      const selected = selection?.mediaId === media.id && selection.postId === post.id;
      const showBlank = selected && isMotion && blankVideo;
      return <div key={media.id} className={`post-media-tile${items.length === 1 ? ' single-media' : ''}`} data-video-aperture={selected && isMotion ? 'true' : undefined} style={items.length === 1 ? { aspectRatio: `${media.width || 16} / ${media.height || 9}` } : undefined}>
        {!showBlank && (playing && selected && videoUrl ? <video src={videoUrl} controls autoPlay playsInline onEnded={() => setPlaying(false)}/> : <img src={media.type === 'photo' ? media.url : media.thumbnail} alt={media.type === 'photo' ? `Post image ${index + 1}` : 'Video preview'}/>)}
        {!showBlank && selected && isMotion && !playing && <button className="media-play" aria-label="Play video preview" onClick={() => videoUrl && setPlaying(true)} disabled={!videoUrl}><Play fill="currentColor" size={24}/></button>}
        {!showBlank && isMotion && !playing && <span className="media-duration">{media.duration ? `${Math.floor(media.duration / 60)}:${String(Math.floor(media.duration % 60)).padStart(2, '0')}` : 'VIDEO'}</span>}
      </div>;
    })}</div>}
    {post.poll && <div className="post-poll">{post.poll.options.map((option, i) => <div className="poll-option" key={i}><span style={{ width: `${post.poll!.totalVotes ? option.votes / post.poll!.totalVotes * 100 : 0}%` }}/><b>{option.label}</b><small>{post.poll!.totalVotes ? Math.round(option.votes / post.poll!.totalVotes * 100) : 0}%</small></div>)}<small>{post.poll.totalVotes.toLocaleString()} votes · Snapshot</small></div>}
    {post.quote && depth < 3 && <Card post={post.quote} selection={selection} blankVideo={blankVideo} videoUrl={videoUrl} quote depth={depth + 1}/>}
    {post.quoteUnavailable && <div className="quote-unavailable">This quoted post is unavailable.</div>}
    {!quote && <footer className="post-date">{dateLabel(post.createdAt)}</footer>}
  </article>;
}
export interface PostFrameViewProps { post: Post; settings: ExportSettings; selection?: MediaSelection; blankVideo?: boolean; videoUrl?: string }
export const PostFrameView = forwardRef<HTMLDivElement, PostFrameViewProps>(function PostFrameView({ post, settings, selection, blankVideo, videoUrl }, ref) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(0);
  useLayoutEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const measure = () => setCardHeight(node.offsetHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(node); measure();
    return () => observer.disconnect();
  }, [post, selection, settings]);
  const padding = settings.background === 'none' ? 0 : { s: 28, m: 52, l: 80 }[settings.padding];
  let width = 600 + padding * 2;
  let height = cardHeight + padding * 2;
  if (settings.background !== 'none' && settings.aspect !== 'auto') {
    const [a, b] = settings.aspect.split(':').map(Number);
    const ratio = a / b;
    width = Math.max(width, height * ratio);
    height = width / ratio;
  }
  return <div ref={ref} className={`post-frame theme-${settings.theme}${settings.background !== 'none' ? ' with-background' : ''}`} data-frame-root style={{ width: Math.ceil(width), minHeight: Math.ceil(height), padding, background: BACKGROUNDS[settings.background] }}><div className="post-card-wrap" ref={cardRef}><Card post={post} selection={selection} blankVideo={blankVideo} videoUrl={videoUrl}/></div></div>;
});
