export function youtubeEmbed(value) {
  const url = new URL(value);
  if (!['https:'].includes(url.protocol) || !['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
    throw new Error('Use a valid YouTube HTTPS embed URL.');
  }
  const id = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  if (!id) throw new Error('The YouTube embed URL must contain a video ID.');
  return {
    src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
    watch: `https://www.youtube.com/watch?v=${id}`
  };
}
