import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, ListFilter, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ImageItem, ImageSource } from '@/types/gallery';
import LocalPhotoCard from './LocalPhotoCard';
import { localDatabase } from '@/services/localDatabase.service';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose, DrawerBody } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

interface LocalPhotoWallProps {
  columnWidth?: number;
  gap?: number;
}

const LIMIT = 20;

const LocalPhotoWall: React.FC<LocalPhotoWallProps> = ({
  columnWidth = 250,
  gap = 12
}) => {
  const { t } = useTranslation();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  // Sorting state
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'type' | 'updatedAt' | 'createdAt' | null>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Drawer state for mobile
  const [drawerOpen, setDrawerOpen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Map sort field names from UI to database column names
  const sortByMap: Record<string, 'filename' | 'fileSize' | 'format' | 'updatedAt' | 'createdAt'> = {
    'name': 'filename',
    'size': 'fileSize',
    'type': 'format',
    'updatedAt': 'updatedAt',
    'createdAt': 'createdAt',
  };

  // Load images from local database
  const loadLocalImages = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    try {
      const dbSortBy = sortBy ? sortByMap[sortBy] : undefined;
      const result = await localDatabase.getPaginatedImages(page, LIMIT, dbSortBy, sortOrder);

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
  }, [page, hasMore, sortBy, sortOrder]);

  // Handle sort changes - reset and reload
  const handleSort = (column: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt') => {
    if (sortBy === column) {
      // Toggle between asc -> desc -> back to default
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        if (column === 'updatedAt') {
          setSortOrder('asc');
          return;
        }
        setSortBy('updatedAt');
        setSortOrder('desc');
      }
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }

    // Reset images and page to reload from beginning
    setImages([]);
    setPage(1);
    setHasMore(true);
  };

  // Handle sort from drawer with explicit order
  const handleDrawerSort = (column: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt', order: 'asc' | 'desc') => {
    setSortBy(column);
    setSortOrder(order);

    // Reset images and page to reload from beginning
    setImages([]);
    setPage(1);
    setHasMore(true);
  };

  // Reset sort
  const handleResetSort = () => {
    setSortBy('updatedAt');
    setSortOrder('desc');

    // Reset images and page to reload from beginning
    setImages([]);
    setPage(1);
    setHasMore(true);
  };

  // Initial load and reload when sorting changes
  useEffect(() => {
    loadLocalImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder]);

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

  // Sort button component (for desktop)
  const SortButton = ({ column, label }: { column: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt'; label: string }) => {
    const isActive = sortBy === column;
    const Icon = !isActive ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown;

    return (
      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => handleSort(column)}
        className={cn(
          "gap-1.5 px-3 font-medium transition-all",
          isActive ? "bg-blue-600 text-white hover:bg-blue-500":"hover:bg-blue-600 hover:text-white bg-gray-100 border-gray-700"
        )}
      >
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </Button>
    );
  };

  // Sort option component (for mobile drawer)
  const SortOption = ({
    column,
    label,
    order
  }: {
    column: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt';
    label: string;
    order: 'asc' | 'desc';
  }) => {
    const isActive = sortBy === column && sortOrder === order;

    return (
      <button
        onClick={() => handleDrawerSort(column, order)}
        className="flex items-center justify-between py-4 px-6 hover:bg-gray-50 transition-colors text-left w-full border-b border-gray-100 last:border-b-0"
      >
        <span className={`text-base ${isActive ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
          {label}
        </span>
        {isActive && <Check className="h-5 w-5 text-green-600" />}
      </button>
    );
  };

  if (images.length === 0 && !loading) {
    return (
      <div className="h-full w-full flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
          <p className="text-lg">No images found in local storage</p>
          <p className="text-sm mt-2">Upload some images to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Controls Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-gray-200">
        {/* Desktop Sort Controls (visible on lg and up) */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 mr-2">{t('gallery.sortBy')}</span>
          <SortButton column="name" label={t('gallery.name')} />
          <SortButton column="size" label={t('gallery.size')} />
          <SortButton column="type" label={t('gallery.type')} />
          <SortButton column="createdAt" label="Created" />
          <SortButton column="updatedAt" label="Modified" />
        </div>

        {/* Mobile Sort Button (visible below lg) */}
        <div className="lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-500"
          >
            <ListFilter className="h-4 w-4" />
            {sortBy ? (
              <span className="text-sm">
                {sortBy === 'name' && (sortOrder === 'asc' ? 'Name: A-Z' : 'Name: Z-A')}
                {sortBy === 'size' && (sortOrder === 'asc' ? 'Smallest' : 'Largest')}
                {sortBy === 'type' && (sortOrder === 'asc' ? 'Type: A-Z' : 'Type: Z-A')}
                {sortBy === 'createdAt' && (sortOrder === 'desc' ? 'Created: Newest' : 'Created: Oldest')}
                {sortBy === 'updatedAt' && (sortOrder === 'desc' ? 'Modified: Newest' : 'Modified: Oldest')}
              </span>
            ) : (
              t('gallery.sortBy')
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Sort Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('gallery.sortBy')}</DrawerTitle>
            <DrawerClose onClick={() => setDrawerOpen(false)} />
          </DrawerHeader>
          <DrawerBody className="p-0 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col">
                <SortOption column="name" label="Name: A-Z" order="asc" />
                <SortOption column="name" label="Name: Z-A" order="desc" />
                <SortOption column="size" label="Size: Smallest" order="asc" />
                <SortOption column="size" label="Size: Largest" order="desc" />
                <SortOption column="type" label="Type: A-Z" order="asc" />
                <SortOption column="type" label="Type: Z-A" order="desc" />
                <SortOption column="createdAt" label="Created: Newest" order="desc" />
                <SortOption column="createdAt" label="Created: Oldest" order="asc" />
                <SortOption column="updatedAt" label="Modified: Newest" order="desc" />
                <SortOption column="updatedAt" label="Modified: Oldest" order="asc" />
              </div>
            </div>
            <div className="sticky bottom-0 flex gap-3 p-4 border-t bg-white ">
              <Button
                className="flex-1 h-11 bg-gray-200 hover:bg-gray-300"
                onClick={handleResetSort}
              >
                {t('common.reset')}
              </Button>
              <Button
                className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setDrawerOpen(false)}
              >
                Done
              </Button>
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

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
    </div>
  );
};

export default LocalPhotoWall;
