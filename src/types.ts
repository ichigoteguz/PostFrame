export type Theme = 'light' | 'dim' | 'dark';
export type Background = 'none' | 'white' | 'gray' | 'black' | 'blue' | 'sunset' | 'ocean' | 'grape' | 'mint' | 'peach' | 'night';
export interface TextFacet { start: number; end: number; type: 'link' | 'mention' | 'hashtag' | 'bold' | 'italic'; text?: string; url?: string }
export interface MediaFormat { url: string; bitrate?: number; width?: number; height?: number; type?: string; codec?: string }
export interface PostMedia { id: string; type: 'photo' | 'video' | 'gif'; url: string; thumbnail: string; width: number; height: number; duration?: number; formats: MediaFormat[] }
export interface Post { id: string; url: string; author: { name: string; handle: string; avatar: string; verified: boolean }; text: string; facets: TextFacet[]; createdAt: string; media: PostMedia[]; quote?: Post; quoteUnavailable?: boolean; replyingTo?: string; poll?: { options: { label: string; votes: number }[]; totalVotes: number; endsAt?: string }; }
export interface ExportSettings { theme: Theme; background: Background; padding: 's' | 'm' | 'l'; aspect: 'auto' | '1:1' | '4:5' | '16:9' | '9:16'; format: 'png' | 'jpg'; scale: 2 | 3 | 4; videoQuality: 720 | 1080 }
export const DEFAULT_SETTINGS: ExportSettings = { theme: 'dark', background: 'none', padding: 'm', aspect: 'auto', format: 'png', scale: 2, videoQuality: 720 };
export interface MediaSelection { postId: string; mediaId: string }
export interface Aperture { x: number; y: number; width: number; height: number; radius: number }
export interface FrameSnapshot { blob: Blob; width: number; height: number; aperture?: Aperture }
export const LIMITS = { videoSeconds: 120, sourceBytes: 100 * 1024 * 1024, videoPixels: 4_000_000, videoSide: 4096, imagePixels: 16_000_000, imageSide: 8192 };
