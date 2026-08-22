import { useEffect, useState } from 'react';
import type { LinkPreview } from '../types/message.types';
import { linkPreviewService } from '../services/linkPreviewService';

/**
 * Hook to lazily resolve a link preview for a URL.
 * Uses the shared in-memory cache of {@link linkPreviewService}; only the
 * first request for a given URL triggers a network call.
 *
 * @param url - The URL to resolve a preview for; pass null/undefined to skip.
 * @returns The resolved preview or null while unavailable/loading.
 */
export function useLinkPreview(url: string | null | undefined): LinkPreview | null {
  const [preview, setPreview] = useState<LinkPreview | null>(() =>
    url ? linkPreviewService.getCached(url) || null : null
  );

  useEffect(() => {
    if (!url) {
      setPreview(null);
      return;
    }

    const cached = linkPreviewService.getCached(url);
    if (cached) {
      setPreview(cached);
      return;
    }

    let cancelled = false;
    setPreview(null);

    linkPreviewService
      .fetchLinkPreview(url)
      .then((resolved) => {
        if (!cancelled) setPreview(resolved);
      })
      .catch(() => {
        // fetchLinkPreview always resolves; keep this for safety
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return preview;
}
