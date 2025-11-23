import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, Download, X, Trash2, ListFilter, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ImageItem } from '@/types/gallery';
import type { Image } from '@/types/api';
import CloudPhotoCard from './CloudPhotoCard';
import { imageService } from '@/services/api';
import { Button } from '@/components/ui/button';
import { useGalleryRefreshStore } from '@/stores/galleryRefreshStore';
import { deleteImagesByUuid } from '@/services/images.service';
import JSZip from 'jszip';
import { format } from 'date-fns';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose, DrawerBody } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

interface CloudPhotoWallProps {
  columnWidth?: number;
  gap?: number;
}

const LIMIT = 20;

const CloudPhotoWall: React.FC<CloudPhotoWallProps> = ({
  columnWidth = 250,
  gap = 12
}) => {
  const { t } = useTranslation();
  const { refreshTrigger } = useGalleryRefreshStore();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

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

  // Load images from cloud API
  const loadCloudImages = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    try {
      const params: any = {
        limit: LIMIT,
        cursor: cursor,
      };

      if (sortBy) {
        params.sortBy = sortBy;
        params.sortOrder = sortOrder;
      }

      const result = await imageService.getPaginatedImages(params);

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
  }, [cursor, hasMore, sortBy, sortOrder]);

  // Track internal reload trigger
  const [reloadKey, setReloadKey] = useState(0);

  // Listen for gallery refresh trigger (e.g., after image crop/save/delete)
  useEffect(() => {
    if (refreshTrigger > 0) {
      // Reset state and trigger reload
      setImages([]);
      setCursor(undefined);
      setHasMore(true);
      loadingRef.current = false;
      setReloadKey(prev => prev + 1);
    }
  }, [refreshTrigger]);

  // Handle sort changes - reset and reload
  const handleSort = (column: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt') => {
    if (sortBy === column) {
      // Toggle between asc -> desc -> inactive
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        setSortBy(null);
        setSortOrder('desc');
      }
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }

    // Reset images and cursor to reload from beginning
    setImages([]);
    setCursor(undefined);
    setHasMore(true);
  };

  // Handle sort from drawer with explicit order
  const handleDrawerSort = (column: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt', order: 'asc' | 'desc') => {
    setSortBy(column);
    setSortOrder(order);

    // Reset images and cursor to reload from beginning
    setImages([]);
    setCursor(undefined);
    setHasMore(true);
  };

  // Reset sort
  const handleResetSort = () => {
    setSortBy(null);
    setSortOrder('desc');

    // Reset images and cursor to reload from beginning
    setImages([]);
    setCursor(undefined);
    setHasMore(true);
  };

  // Selection handlers
  const handleSelectImage = (imageId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
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

  // Export handler
  const handleExport = async () => {
    if (selectedIds.size === 0) return;

    setExporting(true);
    try {
      const zip = new JSZip();
      const imagesFolder = zip.folder('images');
      const invoiceItems: Array<{ name: string; format: string; size: string }> = [];

      for (const imageId of Array.from(selectedIds)) {
        const image = images.find((img) => img.id === imageId);
        if (!image?.cloudData?.uuid) continue;

        try {
          const imageUrl = `${imageService.getImageFileUrl(image.cloudData.uuid)}?info=true`;
          const response = await fetch(imageUrl);

          if (!response.ok) {
            console.error(`Failed to download image ${imageId}:`, response.statusText);
            continue;
          }

          const blob = await response.blob();
          const originalName = response.headers.get('x-image-original-name') || `image-${imageId}.jpg`;
          const fileSize = parseInt(response.headers.get('x-image-file-size') || '0', 10);
          const imageFormat = response.headers.get('x-image-format') || 'unknown';

          imagesFolder?.file(originalName, blob);

          const formattedSize =
            fileSize > 1024 * 1024
              ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
              : `${(fileSize / 1024).toFixed(2)} KB`;

          invoiceItems.push({
            name: originalName,
            format: imageFormat.toUpperCase(),
            size: formattedSize,
          });
        } catch (error) {
          console.error(`Error downloading image ${imageId}:`, error);
        }
      }

      // Generate markdown invoice
      const invoiceContent = `# Image Export Invoice

**Export Date:** ${format(new Date(), 'MMMM dd, yyyy HH:mm:ss')}

**Total Images:** ${invoiceItems.length}

## Exported Images

| # | Filename | Format | Size |
|---|----------|--------|------|
${invoiceItems.map((item, idx) => `| ${idx + 1} | ${item.name} | ${item.format} | ${item.size} |`).join('\n')}

---

*Generated by Cloud Photo Gallery*
`;

      zip.file('INVOICE.md', invoiceContent);

      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `images-export-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Clear selection after export
      handleClearSelection();
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!window.confirm(t('gallery.confirmDelete', { count: selectedIds.size }))) {
      return;
    }

    setExporting(true); // Reuse loading state
    try {
      // Get UUIDs from selected images
      const uuids = Array.from(selectedIds)
        .map(id => images.find(img => img.id === id)?.cloudData?.uuid)
        .filter((uuid): uuid is string => uuid !== undefined);

      if (uuids.length === 0) {
        console.error('No valid UUIDs found');
        return;
      }

      await deleteImagesByUuid(uuids);

      // Reset state and trigger reload
      setImages([]);
      setCursor(undefined);
      setHasMore(true);
      loadingRef.current = false;
      setReloadKey(prev => prev + 1);

      // Clear selection
      handleClearSelection();
    } catch (error) {
      console.error('Delete error:', error);
      alert(t('gallery.deleteError'));
    } finally {
      setExporting(false);
    }
  };

  // Initial load, reload when sorting changes, or when reloadKey changes
  useEffect(() => {
    loadCloudImages();
  }, [sortBy, sortOrder, reloadKey]);

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
          <p className="text-lg">{t('gallery.noImagesCloud')}</p>
          <p className="text-sm mt-2">{t('gallery.syncToCloud')}</p>
        </div>
      </div>
    );
  }

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
          isActive && "bg-gray-900 text-white hover:bg-gray-800"
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
            variant="outline"
            size="sm"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2"
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
              variant="default"
              size="sm"
              onClick={handleExport}
              disabled={selectedIds.size === 0 || exporting}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {exporting ? t('gallery.exporting') : `${t('gallery.export')} (${selectedIds.size})`}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={selectedIds.size === 0 || exporting}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {t('gallery.delete')} ({selectedIds.size})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearSelection}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              {t('gallery.clearSelection')}
            </Button>
          </div>
        )}
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
            <div className="sticky bottom-0 flex gap-3 p-4 border-t bg-white">
              <Button
                variant="outline"
                className="flex-1 h-11"
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
                <CloudPhotoCard
                  key={img.id}
                  image={img}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(img.id!)}
                  onSelect={handleSelectImage}
                  onStartSelection={handleStartSelection}
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
              <span className="ml-2 text-gray-600">{t('gallery.loadingMore')}</span>
            </div>
          )}
        </div>

        {!hasMore && images.length > 0 && (
          <div className="text-center py-4 text-gray-500">
            {t('gallery.noMoreImages')}
          </div>
        )}
      </div>
    </div>
  );
};

export default CloudPhotoWall;
