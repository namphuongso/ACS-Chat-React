import React, { useState, useEffect, useRef } from 'react';

const imageCache = new Set<string>();
const globalImgElements = new Map<string, HTMLImageElement>();

export const preloadChatImage = (url: string) => {
  if (!url || typeof window === 'undefined') return;
  if (imageCache.has(url) || globalImgElements.has(url)) return;

  const img = new Image();
  img.src = url;
  img.onload = () => {
    imageCache.add(url);
  };
  globalImgElements.set(url, img);
};

export interface ChatImageProps {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
}

export const ChatImage: React.FC<ChatImageProps> = React.memo(({ src, alt = '', className, style, onClick }) => {
  const isInitiallyCached = imageCache.has(src);
  const [loaded, setLoaded] = useState(isInitiallyCached);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    preloadChatImage(src);
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
      imageCache.add(src);
    }
  }, [src]);

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="eager"
      decoding="auto"
      draggable={false}
      style={{
        ...style,
        opacity: loaded || isInitiallyCached ? 1 : 0,
        transition: loaded || isInitiallyCached ? 'none' : 'opacity 0.2s ease-in',
        cursor: onClick ? 'pointer' : style?.cursor,
      }}
      onClick={onClick}
      onLoad={() => {
        setLoaded(true);
        imageCache.add(src);
      }}
    />
  );
});

