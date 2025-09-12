/**
 * YouTube URL 처리 유틸리티
 */

export interface YouTubeVideoInfo {
  videoId: string;
  timestamp?: string | null;
  playlistId?: string | null;
}

/**
 * YouTube URL인지 확인
 */
export function isYouTubeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    return (
      hostname === 'youtube.com' ||
      hostname === 'www.youtube.com' ||
      hostname === 'youtu.be' ||
      hostname === 'm.youtube.com'
    );
  } catch {
    return false;
  }
}

/**
 * YouTube URL에서 Video ID 추출
 */
export function extractYouTubeVideoId(url: string): YouTubeVideoInfo | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    let videoId: string | null = null;
    let timestamp: string | null = null;
    let playlistId: string | null = null;

    // youtube.com/watch?v=VIDEO_ID
    if (
      hostname === 'youtube.com' ||
      hostname === 'www.youtube.com' ||
      hostname === 'm.youtube.com'
    ) {
      if (pathname === '/watch') {
        videoId = searchParams.get('v');
        timestamp = searchParams.get('t');
        playlistId = searchParams.get('list');
      }
      // youtube.com/embed/VIDEO_ID
      else if (pathname.startsWith('/embed/')) {
        const after = pathname.split('/embed/')[1];
        if (after) {
          const idPart = after.split('?')[0] ?? null;
          videoId = idPart || null;
        }
      }
      // youtube.com/v/VIDEO_ID (legacy)
      else if (pathname.startsWith('/v/')) {
        const after = pathname.split('/v/')[1];
        if (after) {
          const idPart = after.split('?')[0] ?? null;
          videoId = idPart || null;
        }
      }
    }
    // youtu.be/VIDEO_ID
    else if (hostname === 'youtu.be') {
      const idStr = pathname.slice(1);
      const qIndex = idStr.indexOf('?');
      const cleanId = qIndex >= 0 ? idStr.slice(0, qIndex) : idStr;
      videoId = cleanId || null;
      timestamp = searchParams.get('t');
      playlistId = searchParams.get('list');
    }

    // Video ID 유효성 검증 (11자리 영숫자)
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return {
        videoId,
        timestamp,
        playlistId,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * YouTube 임베드 HTML 생성 (Privacy Enhanced Mode 사용)
 */
export function generateYouTubeEmbed(
  videoInfo: YouTubeVideoInfo,
  options?: {
    title?: string;
    width?: number;
    height?: number;
    autoplay?: boolean;
    muted?: boolean;
    controls?: boolean;
    modestbranding?: boolean;
  },
): string {
  const {
    title = 'YouTube video',
    autoplay = false,
    muted = false,
    controls = true,
    modestbranding = true,
  } = options || {};

  // Privacy Enhanced Mode URL 구성
  let embedUrl = `https://www.youtube-nocookie.com/embed/${videoInfo.videoId}`;

  // URL 파라미터 구성
  const params: string[] = [];

  if (videoInfo.timestamp) {
    // 타임스탬프 처리 (예: 1m30s -> 90)
    const seconds = parseTimestamp(videoInfo.timestamp);
    if (seconds > 0) {
      params.push(`start=${seconds}`);
    }
  }

  if (videoInfo.playlistId) {
    params.push(`list=${videoInfo.playlistId}`);
  }

  if (autoplay) {
    params.push('autoplay=1');
    // 자동재생을 위해서는 muted가 필요 (브라우저 정책)
    params.push('mute=1');
  } else if (muted) {
    params.push('mute=1');
  }

  if (!controls) {
    params.push('controls=0');
  }

  if (modestbranding) {
    params.push('modestbranding=1');
  }

  // 추가 권장 파라미터
  params.push('rel=0'); // 관련 동영상을 같은 채널에서만 표시
  params.push('fs=1'); // 전체화면 허용

  if (params.length > 0) {
    embedUrl += `?${params.join('&')}`;
  }

  // 반응형 컨테이너와 iframe 생성
  // frameborder는 deprecated이므로 제거하고 CSS로 처리
  return `
    <div class="youtube-embed-container" data-youtube-video="${videoInfo.videoId}">
      <iframe
        src="${embedUrl}"
        title="${escapeHtml(title)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        loading="lazy"
      ></iframe>
    </div>
  `.trim();
}

/**
 * 타임스탬프를 초 단위로 변환
 */
function parseTimestamp(timestamp: string): number {
  // 이미 숫자인 경우 (초 단위)
  if (/^\d+$/.test(timestamp)) {
    return parseInt(timestamp, 10);
  }

  // 1h2m3s 형식
  const match = timestamp.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (match) {
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Markdown 텍스트에서 YouTube 링크를 임베드로 변환
 */
export function convertYouTubeLinksToEmbeds(markdown: string): string {
  // 링크 패턴: [텍스트](URL) 또는 단독 URL
  const linkPattern =
    /(?:\[([^\]]*)\]\((https?:\/\/[^\s)]+)\))|(?:^|\s)(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^\s]+)/gm;

  return markdown.replace(linkPattern, (match, linkText, mdUrl, standaloneUrl) => {
    const url = mdUrl || standaloneUrl;

    if (!isYouTubeUrl(url)) {
      return match;
    }

    const videoInfo = extractYouTubeVideoId(url);
    if (!videoInfo) {
      return match;
    }

    // 링크 텍스트가 있으면 제목으로 사용
    const title = linkText || 'YouTube video';
    const embedHtml = generateYouTubeEmbed(videoInfo, { title });

    // Markdown 링크였다면 앞뒤 공백 유지
    if (mdUrl) {
      return embedHtml;
    } else {
      // 단독 URL인 경우 앞 공백 유지
      const leadingSpace = match.startsWith(' ') ? ' ' : '';
      return leadingSpace + embedHtml;
    }
  });
}
