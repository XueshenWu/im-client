import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import type { ImageItem, ImageSource } from '@/types/gallery';
import LocalPhotoCard from './LocalPhotoCard';
import { localDatabase } from '@/services/localDatabase.service';

interface LocalPhotoWallProps {
  columnWidth?: number;
  gap?: number;
}

const LIMIT = 20;

const LocalPhotoWall: React.FC<LocalPhotoWallProps> = ({
  columnWidth = 250,
  gap = 12
}) => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Load images from local database
  const loadLocalImages = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await localDatabase.getPaginatedImages(page, LIMIT);

      if (result && result.images.length > 0) {
        // Process images to add preview and aspect ratio
        const imagesWithPreview = await Promise.all(
          result.images.map(async (img: any) => {
            const buffer = await window.electronAPI?.readLocalFile(img.filePath);
            if (!buffer) {
              return {
                name: img.filename,
                path: img.filePath,
                size: img.fileSize,
                aspectRatio: img.width && img.height ? img.width / img.height : 1,
                source: 'local' as ImageSource,
                id: img.uuid,
                createdAt: img.createdAt,
                modifiedAt: img.updatedAt,
              };
            }

            const blob = new Blob([buffer]);
            const preview = URL.createObjectURL(blob);

            const aspectRatio = img.width && img.height
              ? img.width / img.height
              : await new Promise<number>((resolve) => {
                  const image = new Image();
                  image.onload = () => resolve(image.width / image.height);
                  image.onerror = () => resolve(1);
                  image.src = preview;
                });

            return {
              name: img.filename,
              path: img.filePath,
              size: img.fileSize,
              preview,
              aspectRatio,
              source: 'local' as ImageSource,
              id: img.uuid,
              createdAt: img.createdAt,
              modifiedAt: img.updatedAt,
            };
          })
        );

        // Filter out duplicates
        setImages((prevImages) => {
          const existingIds = new Set(prevImages.map((i) => i.id));
          const newUniqueImages = imagesWithPreview.filter(
            (img) => !existingIds.has(img.id)
          );
          return [...prevImages, ...newUniqueImages];
        });

        setPage((prev) => prev + 1);

        // Check if there are more images
        const totalPages = Math.ceil(result.total / LIMIT);
        setHasMore(page < totalPages);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load local images:', error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [page, hasMore]);

  // Initial load
  useEffect(() => {
    loadLocalImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up Intersection Observer for infinite scroll
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadLocalImages();
        }
      },
      { threshold: 0.1 }
    );

    return () => observerRef.current?.disconnect();
  }, [loadLocalImages]);

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

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.preview) {
          URL.revokeObjectURL(img.preview);
        }
      });
    };
  }, [images]);

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
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <p className="text-lg">No images found in local storage</p>
        <p className="text-sm mt-2">Upload some images to get started</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="h-full w-full overflow-y-auto overflow-x-hidden p-6"
    >
      <div className="flex gap-3 items-start">
        {columns.map((column, columnIndex) => (
          <div
            key={columnIndex}
            className="flex-1 flex flex-col gap-3"
            style={{ minWidth: `${columnWidth}px` }}
          >
            {column.map((img) => (
              <LocalPhotoCard
                key={img.id || img.path}
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
  );
};

export default LocalPhotoWall;
