import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import type { ImageItem } from '@/types/gallery';
import type { Image } from '@/types/api';
import CloudPhotoCard from './CloudPhotoCard';
import { imageService } from '@/services/api';

interface CloudPhotoWallProps {
  columnWidth?: number;
  gap?: number;
}

const LIMIT = 20;

const CloudPhotoWall: React.FC<CloudPhotoWallProps> = ({
  columnWidth = 250,
  gap = 12
}) => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Load images from cloud API
  const loadCloudImages = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await imageService.getPaginatedImages({
        limit: LIMIT,
        cursor: cursor,
      });

      if (result?.success && result.data) {
        if (result.data.length > 0) {
          // Convert API images to ImageItem format
          const cloudImages: ImageItem[] = result.data.map((img: Image) => ({
            id: img.uuid,
            preview: imageService.getThumbnailUrl(img.thumbnailPath),
            aspectRatio: img.width / img.height,
            source: 'cloud' as const,
            cloudData: img,
            createdAt: img.createdAt,
          }));

          // Filter out duplicates
          setImages((prevImages) => {
            const existingIds = new Set(prevImages.map((i) => i.id));
            const newUniqueImages = cloudImages.filter(
              (img) => !existingIds.has(img.id)
            );
            return [...prevImages, ...newUniqueImages];
          });

          setCursor(result.pagination.nextCursor || undefined);
        }
        setHasMore(result.pagination.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load cloud images:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [cursor, hasMore]);

  // Initial load
  useEffect(() => {
    loadCloudImages();
  }, []);

  // Set up Intersection Observer for infinite scroll
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadCloudImages();
        }
      },
      { threshold: 0.1 }
    );

    return () => observerRef.current?.disconnect();
  }, [loadCloudImages]);

  // Observe sentinel element
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const observer = observerRef.current;

    if (sentinel && observer) {
      observer.observe(sentinel);
    }

    return () => {
      if (sentinel && observer) {
        observer.unobserve(sentinel);
      }
    };
  }, [images.length]);

  // Calculate column count based on container width
  const [columnCount, setColumnCount] = useState(3);

  useEffect(() => {
    const updateColumnCount = () => {
      if (scrollContainerRef.current) {
        const containerWidth = scrollContainerRef.current.offsetWidth;
        const cols = Math.max(1, Math.floor(containerWidth / (columnWidth + gap)));
        setColumnCount(cols);
      }
    };

    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, [columnWidth, gap]);

  // Organize images into columns for masonry layout
  const columns: ImageItem[][] = Array.from({ length: columnCount }, () => []);
  const columnHeights = Array(columnCount).fill(0);

  images.forEach((img) => {
    const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
    columns[shortestColumnIndex].push(img);
    const imageHeight = columnWidth / (img.aspectRatio || 1);
    columnHeights[shortestColumnIndex] += imageHeight + gap;
  });

  if (images.length === 0 && !loading) {
    return (
      <div className="h-full w-full flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
          <p className="text-lg">No images found in cloud</p>
          <p className="text-sm mt-2">Sync images to the cloud to see them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Images Grid */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-6"
      >
        <div className="flex gap-3 items-start">
          {columns.map((column, columnIndex) => (
            <div
              key={columnIndex}
              className="flex-1 flex flex-col gap-3"
              style={{ minWidth: `${columnWidth}px` }}
            >
              {column.map((img) => (
                <CloudPhotoCard
                  key={img.id}
                  image={img}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Sentinel element for infinite scroll */}
        <div ref={sentinelRef} className="h-10 mt-4">
          {loading && (
            <div className="flex justify-center items-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading more images...</span>
            </div>
          )}
        </div>

        {!hasMore && images.length > 0 && (
          <div className="text-center py-4 text-gray-500">
            No more images to load
          </div>
        )}
      </div>
    </div>
  );
};

export default CloudPhotoWall;
