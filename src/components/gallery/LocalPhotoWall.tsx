import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, ListFilter, Check, Download, X, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ImageWithSource, ImageSource } from '@/types/gallery';
import LocalPhotoCard from './LocalPhotoCard';
import { localDatabase } from '@/services/localDatabase.service';
import { localImageService } from '@/services/localImage.service';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose, DrawerBody } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useGalleryRefreshStore } from '@/stores/galleryRefreshStore';
import { LocalImage } from '@/types/local';
import { toast } from 'sonner';

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
  const { refreshTrigger } = useGalleryRefreshStore();
  const [images, setImages] = useState<ImageWithSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  // Sorting state
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'type' | 'updatedAt' | 'createdAt' | null>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [exporting, setExporting] = useState(false);

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
        // Process images to add aspect ratio (NO MORE BLOBS HERE)
        const processedImages = await Promise.all(
          result.images.map(async (img: LocalImage) => {

            // Try to get aspect ratio from DB first
            let aspectRatio = img.width && img.height ? img.width / img.height : 0;

            // If DB misses dimensions, calculate them using the custom protocol
            if (!aspectRatio) {
              try {
                const tempUrl = `local-image://${img.uuid}.${img.format}`;
                aspectRatio = await new Promise<number>((resolve) => {
                  const image = new Image();
                  image.onload = () => resolve(image.width / image.height);
                  image.onerror = () => resolve(1);
                  image.src = tempUrl;
                });
              } catch (e) {
                aspectRatio = 1;
              }
            }

            return {
              id: img.id || 0,
              uuid: img.uuid,
              filename: img.filename,
              fileSize: img.fileSize,
              format: img.format,
              width: img.width,
              height: img.height,
              hash: img.hash,
              mimeType: img.mimeType,
              isCorrupted: img.isCorrupted,
              createdAt: img.createdAt,
              updatedAt: img.updatedAt,
              deletedAt: img.deletedAt,
              aspectRatio: aspectRatio || 1,
              source: 'local' as ImageSource,
              pageCount: img.pageCount || 1,
              tiffDimensions: img.tiffDimensions
            };
          })
        );

        // Filter out duplicates
        setImages((prevImages) => {
          const existingUuids = new Set(prevImages.map((i) => i.uuid));
          const newUniqueImages = processedImages.filter(
            (img) => !existingUuids.has(img.uuid)
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

const handleSort = (column: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt') => {
  // default fallback configuration
  const defaultSortBy = 'updatedAt';
  const defaultSortOrder = 'desc';

  let nextSortBy = column;
  let nextSortOrder = 'asc';

  // If clicking the currently active column
  if (sortBy === column) {
    if (sortOrder === 'asc') {
      // Toggle to Descending
      nextSortOrder = 'desc';
    } else {
      if (column === defaultSortBy) {
        nextSortOrder = 'asc';
      } else {
        nextSortBy = defaultSortBy;
        nextSortOrder = defaultSortOrder;
      }
    }
  } else {
    // Clicking a new column: Start with Ascending
    nextSortBy = column;
    nextSortOrder = 'asc';
  }

  // Update State
  setSortBy(nextSortBy);
  setSortOrder(nextSortOrder as 'asc' | 'desc');

  // Reset List
  setImages([]);
  setPage(1);
  setHasMore(true);
};

  const handleDrawerSort = (column: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt', order: 'asc' | 'desc') => {
    setSortBy(column);
    setSortOrder(order);
    setImages([]);
    setPage(1);
    setHasMore(true);
  };

  const handleResetSort = () => {
    if (sortBy === 'updatedAt') {
      if (sortOrder === 'desc') return;
      setSortOrder('desc');
      return;
    }
    setSortBy('updatedAt');
    setSortOrder('desc');
    setImages([]);
    setPage(1);
    setHasMore(true);
  };

  const handleSelectImage = (imageId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) newSet.delete(imageId);
      else newSet.add(imageId);
      return newSet;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const handleStartSelection = (imageId: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([imageId]));
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) return;
    setExporting(true);
    try {
      const selectedImages = images.filter(img => selectedIds.has(img.uuid));
      const destination = await window.electronAPI?.selectDirectory();
      if (!destination) {
        setExporting(false);
        return;
      }
      const imagesToExport = selectedImages.map(img => ({
        uuid: img.uuid,
        format: img.format,
        filename: img.filename,
      }));
      await window.electronAPI?.exportImages(imagesToExport, destination);
      handleClearSelection();
      toast.success(t('gallery.exportSuccess', { count: selectedImages.length }));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('gallery.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(t('gallery.confirmDelete', { count: selectedIds.size }))) return;
    setExporting(true);
    try {
      const uuids = Array.from(selectedIds);
      await localImageService.deleteImages(uuids);
      handleClearSelection();
      setImages([]);
      setPage(1);
      setHasMore(true);
      loadingRef.current = false;
      toast.success(t('gallery.deleteSuccess', { count: uuids.length }));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('gallery.deleteError'));
    } finally {
      setExporting(false);
    }
  };

  // Listen for refresh
  useEffect(() => {
    if (refreshTrigger > 0) {
      const resetAndReload = async () => {
        setImages([]);
        setHasMore(true);
        loadingRef.current = false;
        handleClearSelection();

        // Reset page to 1 and reload
        setPage(1);

        // Manually load first page since state updates are async
        try {
          const dbSortBy = sortBy ? sortByMap[sortBy] : undefined;
          const result = await localDatabase.getPaginatedImages(1, LIMIT, dbSortBy, sortOrder);

          if (result && result.images.length > 0) {
            const processedImages = await Promise.all(
              result.images.map(async (img: LocalImage) => {
                let aspectRatio = img.width && img.height ? img.width / img.height : 0;

                if (!aspectRatio) {
                  try {
                    const tempUrl = `local-image://${img.uuid}.${img.format}`;
                    aspectRatio = await new Promise<number>((resolve) => {
                      const image = new Image();
                      image.onload = () => resolve(image.width / image.height);
                      image.onerror = () => resolve(1);
                      image.src = tempUrl;
                    });
                  } catch (e) {
                    aspectRatio = 1;
                  }
                }

                return {
                  id: img.id || 0,
                  uuid: img.uuid,
                  filename: img.filename,
                  fileSize: img.fileSize,
                  format: img.format,
                  width: img.width,
                  height: img.height,
                  hash: img.hash,
                  mimeType: img.mimeType,
                  isCorrupted: img.isCorrupted,
                  createdAt: img.createdAt,
                  updatedAt: img.updatedAt,
                  deletedAt: img.deletedAt,
                  aspectRatio: aspectRatio || 1,
                  source: 'local' as ImageSource,
                };
              })
            );

            setImages(processedImages);
            setPage(2); // Next page will be 2

            const totalPages = Math.ceil(result.total / LIMIT);
            setHasMore(1 < totalPages);
          }
        } catch (error) {
          console.error('Failed to reload images after refresh:', error);
        }
      };

      resetAndReload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  // Initial load
  useEffect(() => {
    loadLocalImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder]);

  // Infinite Scroll Observer
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

  // Observe Sentinel
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

  // Organize images into columns
  const columns: ImageWithSource[][] = Array.from({ length: columnCount }, () => []);
  const columnHeights = Array(columnCount).fill(0);

  images.forEach((img) => {
    const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
    columns[shortestColumnIndex].push(img);
    const imageHeight = columnWidth / (img.aspectRatio || 1);
    columnHeights[shortestColumnIndex] += imageHeight + gap;
  });

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
          isActive ? "bg-blue-600 text-white hover:bg-blue-500" : "hover:bg-blue-600 hover:text-white bg-gray-100 border-gray-700"
        )}
      >
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </Button>
    );
  };

  const SortOption = ({ column, label, order }: { column: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt'; label: string; order: 'asc' | 'desc'; }) => {
    const isActive = sortBy === column && sortOrder === order;
    return (
      <button
        onClick={() => handleDrawerSort(column, order)}
        className="flex items-center justify-between py-4 px-6 hover:bg-gray-50 transition-colors text-left w-full border-b border-gray-100 last:border-b-0"
        style={{ cursor: 'pointer' }}
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
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 mr-2">{t('gallery.sortBy')}</span>
          <SortButton column="name" label={t('gallery.name')} />
          <SortButton column="size" label={t('gallery.size')} />
          <SortButton column="type" label={t('gallery.type')} />
          <SortButton column="createdAt" label="Created" />
          <SortButton column="updatedAt" label="Modified" />
        </div>
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
        {/* Selection Controls */}
        {selectionMode && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {selectedIds.size} {t('gallery.selected')}
            </span>
            <Button
              size="sm"
              onClick={handleExport}
              disabled={selectedIds.size === 0 || exporting}
              className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              {exporting ? t('gallery.exporting') : `${t('gallery.export')} (${selectedIds.size})`}
            </Button>
            <Button
              size="sm"
              onClick={handleDelete}
              disabled={selectedIds.size === 0 || exporting}
              className="flex items-center gap-2 bg-red-600 text-white hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              {t('gallery.delete')} ({selectedIds.size})
            </Button>
            <Button
              size="sm"
              onClick={handleClearSelection}
              className="flex items-center gap-2 border-gray-100 border hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
              {t('gallery.clearSelection')}
            </Button>
          </div>
        )}
      </div>

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
              <Button className="flex-1 h-11 bg-gray-200 hover:bg-gray-300" onClick={handleResetSort}>
                {t('common.reset')}
              </Button>
              <Button className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setDrawerOpen(false)}>
                Done
              </Button>
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-6">
        <div className="flex gap-3 items-start">
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className="flex-1 flex flex-col gap-3" style={{ minWidth: `${columnWidth}px` }}>
              {column.map((img) => (
                <LocalPhotoCard
                  key={img.uuid}
                  image={img}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(img.uuid)}
                  onSelect={handleSelectImage}
                  onStartSelection={handleStartSelection}
                />
              ))}
            </div>
          ))}
        </div>
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