import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  RotateCw,
  Maximize2,
  Info,
  Trash2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { useImageViewerStoreV2 } from '@/stores/imageViewerStoreV2';
import { useGalleryRefreshStore } from '@/stores/galleryRefreshStore';
import { deleteImages } from '@/services/images.service';
import { format } from 'date-fns';
import { localImageService } from '@/services/localImage.service';
import { getCloudImagePresignedUrlEndpoint } from '@/utils/imagePaths';
import type { ImageEditorTool, ToolContext } from './types';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export interface ImageViewerV2Props {
  tools?: ImageEditorTool[];
}

export const ImageViewerV2: React.FC<ImageViewerV2Props> = ({
  tools = [],
}) => {
  const { t } = useTranslation();
  const {
    isOpen,
    currentImage,
    images,
    currentIndex,
    readOnly,
    activeToolId,
    toolState,
    closeViewer,
    nextImage,
    previousImage,
    setActiveTool,
    setToolState,
    getToolState,
  } = useImageViewerStoreV2();

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);

  const { triggerRefresh } = useGalleryRefreshStore();

  const isLocalImage = currentImage ? (currentImage as any).source === 'local' : false;

  // Find the currently active tool
  const activeTool = tools.find((t) => t.id === activeToolId) || null;

  // Load image URL - convert local images to blob URLs for canvas compatibility
  useEffect(() => {
    if (!currentImage || !isOpen) {
      setResolvedImageUrl('');
      return;
    }

    let blobUrl = '';

    const loadImage = async () => {
      try {
        if (isLocalImage) {
          // Load local image as blob URL (canvas can't handle custom protocols)
          const buffer = await window.electronAPI?.loadLocalImage(
            currentImage.uuid,
            currentImage.format
          );
          if (buffer) {
            const blob = new Blob([buffer as unknown as BlobPart], {
              type: currentImage.mimeType || 'image/jpeg',
            });
            blobUrl = URL.createObjectURL(blob);
            setResolvedImageUrl(blobUrl);
          }
        } else {
          // Fetch presigned URL for cloud images
          const endpoint = getCloudImagePresignedUrlEndpoint(currentImage.uuid);
          const response = await fetch(endpoint);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.presignedUrl) {
              setResolvedImageUrl(data.data.presignedUrl);
            }
          }
        }
      } catch (error) {
        console.error('Error loading image:', error);
      }
    };

    loadImage();

    // Cleanup blob URL on unmount or image change
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [currentImage, isLocalImage, isOpen]);

  // Use the resolved URL
  const imageUrl = resolvedImageUrl;

  // Reset state when image changes
  useEffect(() => {
    if (currentImage) {
      setZoom(1);
      setRotation(0);
      setImageLoaded(false);
    }
  }, [currentImage]);

  // Reset tool when closing viewer
  useEffect(() => {
    if (!isOpen && activeToolId) {
      setActiveTool(null);
    }
  }, [isOpen, activeToolId, setActiveTool]);

  // Build tool context
  const toolContext: ToolContext | null = currentImage
    ? {
        image: currentImage,
        imageRef: imgRef,
        imageUrl,
        isLocalImage,
        activeToolId,
        setActiveTool,
        toolState,
        setToolState,
        getToolState,
        closeViewer,
        triggerRefresh,
      }
    : null;

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If a tool is active, only allow Escape to cancel
      if (activeToolId) {
        if (e.key === 'Escape') {
          const tool = tools.find((t) => t.id === activeToolId);
          tool?.onDeactivate?.(toolContext!);
          setActiveTool(null);
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          closeViewer();
          break;
        case 'ArrowLeft':
          if (images.length > 1) previousImage();
          break;
        case 'ArrowRight':
          if (images.length > 1) nextImage();
          break;
        case '+':
        case '=':
          setZoom((prev) => Math.min(prev + 0.25, 3));
          break;
        case '-':
        case '_':
          setZoom((prev) => Math.max(prev - 0.25, 0.5));
          break;
        case 'r':
        case 'R':
          setRotation((prev) => (prev + 90) % 360);
          break;
        case 'i':
        case 'I':
          setShowInfo((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, images.length, activeToolId, closeViewer, nextImage, previousImage, tools, toolContext, setActiveTool]);

  if (!currentImage) return null;

  const hasMultipleImages = images.length > 1;

  const handleDownload = async () => {
    try {
      if (isLocalImage) {
        const buffer = await window.electronAPI?.loadLocalImage(currentImage.uuid, currentImage.format);
        if (!buffer) {
          throw new Error('Cannot read file');
        }
        const blob = new Blob([buffer as unknown as BlobPart], { type: currentImage.mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = currentImage.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.error('Failed to fetch cloud image');
          return;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = currentImage.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleDelete = async () => {
    if (!currentImage) return;
    if (!window.confirm(t('viewer.confirmDelete'))) return;

    try {
      if (isLocalImage) {
        await localImageService.deleteImage(currentImage.uuid);
      } else {
        await deleteImages([currentImage.uuid]);
      }
      triggerRefresh();
      closeViewer();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete image. Please try again.');
    }
  };

  const handleToolClick = (tool: ImageEditorTool) => {
    if (toolContext) {
      tool.onActivate(toolContext);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeViewer()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0 bg-black border-none" aria-describedby={undefined}>
        <VisuallyHidden.Root>
          <DialogTitle>{currentImage.filename}</DialogTitle>
        </VisuallyHidden.Root>

        {/* Top toolbar */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <h2 className="text-lg font-semibold truncate max-w-[400px]">
                {currentImage.filename}
              </h2>
              {hasMultipleImages && !activeToolId && (
                <span className="text-sm text-gray-300">
                  {currentIndex + 1} / {images.length}
                </span>
              )}
              {activeToolId && (
                <span className="text-sm text-yellow-400">
                  {activeTool?.label} Mode
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!activeToolId ? (
                // View mode controls
                <>
                  {/* Zoom controls */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.5}
                    className="text-white hover:bg-white/20"
                  >
                    <ZoomOut className="h-5 w-5" />
                  </Button>
                  <span className="text-white text-sm min-w-[60px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomIn}
                    disabled={zoom >= 3}
                    className="text-white hover:bg-white/20"
                  >
                    <ZoomIn className="h-5 w-5" />
                  </Button>

                  {/* Rotate */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRotate}
                    className="text-white hover:bg-white/20"
                  >
                    <RotateCw className="h-5 w-5" />
                  </Button>

                  {/* Reset view */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleResetView}
                    className="text-white hover:bg-white/20"
                    title={t('viewer.resetView')}
                  >
                    <Maximize2 className="h-5 w-5" />
                  </Button>

                  {/* Tool buttons - only show if not readOnly */}
                  {!readOnly &&
                    tools.map((tool) => {
                      const isAvailable = tool.isAvailable
                        ? tool.isAvailable(toolContext!)
                        : true;
                      if (!isAvailable) return null;

                      const Icon = tool.icon;
                      return (
                        <Button
                          key={tool.id}
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToolClick(tool)}
                          className="text-white hover:bg-white/20"
                          title={tool.label}
                        >
                          <Icon className="h-5 w-5" />
                        </Button>
                      );
                    })}

                  {/* Download */}
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDownload}
                      className="text-white hover:bg-white/20"
                      title={t('contextMenu.download')}
                    >
                      <Download className="h-5 w-5" />
                    </Button>
                  )}

                  {/* Info toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowInfo(!showInfo)}
                    className="text-white hover:bg-white/20"
                    title={t('viewer.toggleInfo')}
                  >
                    <Info className="h-5 w-5" />
                  </Button>

                  {/* Delete */}
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDelete}
                      className="text-white hover:bg-red-500/80"
                      title={t('contextMenu.delete')}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeViewer}
                    className="text-white hover:bg-white/20"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </>
              ) : (
                // Tool-specific controls
                activeTool?.renderModeControls?.(toolContext!)
              )}
            </div>
          </div>
        </div>

        {/* Navigation arrows */}
        {hasMultipleImages && !activeToolId && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={previousImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          </>
        )}

        {/* Main image container */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-16">
          {!activeToolId ? (
            // View mode - standard image display
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
                </div>
              )}
              <img
                ref={imgRef}
                src={imageUrl}
                alt={currentImage.filename}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
                onLoad={() => setImageLoaded(true)}
                crossOrigin="anonymous"
              />
            </>
          ) : (
            // Tool mode - render tool's canvas
            activeTool?.renderCanvas?.(toolContext!)
          )}
        </div>

        {/* Info panel */}
        {showInfo && !activeToolId && (
          <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/90 to-transparent p-6">
            <div className="grid grid-cols-2 gap-4 text-white text-sm max-w-2xl">
              <div>
                <div className="text-gray-400">{t('viewer.filename')}</div>
                <div className="font-medium">{currentImage.filename}</div>
              </div>
              <div>
                <div className="text-gray-400">{t('viewer.fileSize')}</div>
                <div className="font-medium">{formatBytes(currentImage.fileSize)}</div>
              </div>
              <div>
                <div className="text-gray-400">{t('viewer.format')}</div>
                <div className="font-medium uppercase">{currentImage.format}</div>
              </div>
              <div>
                <div className="text-gray-400">{t('viewer.dimensions')}</div>
                <div className="font-medium">
                  {currentImage.tiffDimensions && currentImage.tiffDimensions.length > 0
                    ? `${currentImage.tiffDimensions[0].width} × ${currentImage.tiffDimensions[0].height} (Page 1/${currentImage.pageCount || 1})`
                    : `${currentImage.width || 0} × ${currentImage.height || 0}`}
                </div>
              </div>
              <div>
                <div className="text-gray-400">{t('viewer.uploaded')}</div>
                <div className="font-medium">
                  {currentImage.createdAt ? format(new Date(currentImage.createdAt), 'yyyy-MM-dd HH:mm') : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-gray-400">{t('viewer.modified')}</div>
                <div className="font-medium">
                  {currentImage.updatedAt ? format(new Date(currentImage.updatedAt), 'yyyy-MM-dd HH:mm') : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
