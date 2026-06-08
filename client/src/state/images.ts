const _imageCache = new Map<string, HTMLImageElement>();

export async function getImgFromCacheOrFetch(url: string): Promise<
  { success: true; data: HTMLImageElement } | { success: false; err: string }
> {
  const cached = _imageCache.get(url);
  if (cached) return { success: true, data: cached };

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      _imageCache.set(url, img);
      resolve({ success: true, data: img });
    };
    img.onerror = () => resolve({ success: false, err: `Failed to load image: ${url}` });
    img.src = url;
  });
}
