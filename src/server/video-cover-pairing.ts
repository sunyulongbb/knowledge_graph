export type VideoCoverPairs = {
  videos: string[];
  covers: string[];
};

const cleanSlots = (values: unknown): string[] =>
  (Array.isArray(values) ? values : []).map((value) =>
    String(value ?? "").trim(),
  );

/** Append videos and covers as positional pairs without deduplicating covers. */
export function appendVideoCoverPairs(
  existingVideos: unknown,
  existingCovers: unknown,
  incomingVideos: unknown,
  incomingCovers: unknown,
): VideoCoverPairs {
  const videos = cleanSlots(existingVideos).filter(Boolean);
  const covers = cleanSlots(existingCovers).slice(0, videos.length);
  while (covers.length < videos.length) covers.push("");

  const nextVideos = cleanSlots(incomingVideos);
  const nextCovers = cleanSlots(incomingCovers);
  for (let index = 0; index < nextVideos.length; index += 1) {
    const video = nextVideos[index];
    if (!video) continue;
    const cover = nextCovers[index] || "";
    const existingIndex = videos.indexOf(video);
    if (existingIndex >= 0) {
      if (cover) covers[existingIndex] = cover;
      continue;
    }
    videos.push(video);
    covers.push(cover);
  }

  return { videos, covers };
}
