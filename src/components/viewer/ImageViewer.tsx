import React, { useEffect, useState } from 'react';
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
  Crop as CropIcon,
  Check,
  Save,
  Trash2
} from 'lucide-react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { useImageViewerStore } from '@/stores/imageViewerStore';
import { useGalleryRefreshStore } from '@/stores/galleryRefreshStore';
import { imageService } from '@/services/api';
import { uploadImageAuto, replaceImageAuto, deleteImage } from '@/services/images.service';
import { createCroppedImage, blobToFile } from '@/utils/cropImage';
import { format } from 'date-fns';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const ImageViewer: React.FC = () => {
  const { t } = useTranslation();
  const {
    isOpen,
    currentImage,
    images,
    currentIndex,
    viewMode,
    closeViewer,
    nextImage,
    previousImage,
    enterCropMode,
    exitCropMode,
  } = useImageViewerStore();

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Crop mode states
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const { triggerRefresh } = useGalleryRefreshStore();

  // Reset zoom and rotation when image changes
  useEffect(() => {
    if (currentImage) {
      setZoom(1);
      setRotation(0);
      setImageLoaded(false);
      setCrop(undefined);
      setCompletedCrop(undefined);
    }
  }, [currentImage]);

  // Reset crop mode when closing viewer
  useEffect(() => {
    if (!isOpen) {
      exitCropMode();
    }
  }, [isOpen, exitCropMode]);

  // Handle entering crop mode
  const handleEnterCropMode = () => {
    enterCropMode();
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  // Handle canceling crop
  const handleCancelCrop = () => {
    exitCropMode();
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  // Handle saving cropped image
  const handleSaveCrop = async (replaceOriginal: boolean) => {
    if (!currentImage || !completedCrop || !imgRef.current) return;

    setIsCropping(true);
    try {
      // Determine format based on original image
      const format = currentImage.format === 'png' ? 'png' : 'jpeg';

      // Create cropped image blob using the actual image element
      const croppedBlob = await createCroppedImage(
        imgRef.current,
        completedCrop,
        format,
        0.95
      );

      // Convert blob to file
      const fileName = replaceOriginal
        ? currentImage.originalName
        : `cropped_${currentImage.originalName}`;
      const croppedFile = blobToFile(croppedBlob, fileName);

      if (replaceOriginal) {
        // Replace the original image (uses chunked upload if > 50MB)
        await replaceImageAuto(currentImage.uuid, croppedFile);
      } else {
        // Upload as new image (uses chunked upload if > 50MB)
        await uploadImageAuto(croppedFile);
      }

      // Trigger gallery refresh to show updated data
      triggerRefresh();

      // Exit crop mode and close viewer
      exitCropMode();
      closeViewer();
    } catch (error) {
      console.error('Error saving cropped image:', error);
    } finally {
      setIsCropping(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // In crop mode, only allow Escape to cancel
      if (viewMode === 'crop') {
        if (e.key === 'Escape') {
          handleCancelCrop();
        }
        return;
      }

      // Normal view mode keyboard shortcuts
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
          setZoom(prev => Math.min(prev + 0.25, 3));
          break;
        case '-':
        case '_':
          setZoom(prev => Math.max(prev - 0.25, 0.5));
          break;
        case 'r':
        case 'R':
          setRotation(prev => (prev + 90) % 360);
          break;
        case 'i':
        case 'I':
          setShowInfo(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, images.length, viewMode, closeViewer, nextImage, previousImage, handleCancelCrop]);

  if (!currentImage) return null;

  const imageUrl = imageService.getImageFileUrl(currentImage.uuid);
  const hasMultipleImages = images.length > 1;

  const handleDownload = async () => {
    try {
      const response = await fetch(`${imageUrl}?info=true`);
      if (!response.ok) return;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = currentImage.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleDelete = async () => {
    if (!currentImage) return;

    if (!window.confirm(t('viewer.confirmDelete'))) return;

    try {
      await deleteImage(currentImage.id);
      triggerRefresh();
      closeViewer();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeViewer()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0 bg-black border-none" aria-describedby={undefined}>
        <VisuallyHidden.Root>
          <DialogTitle>{currentImage.originalName}</DialogTitle>
        </VisuallyHidden.Root>
        {/* Top toolbar */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <h2 className="text-lg font-semibold truncate max-w-[400px]">
                {currentImage.originalName}
              </h2>
              {hasMultipleImages && viewMode === 'view' && (
                <span className="text-sm text-gray-300">
                  {currentIndex + 1} / {images.length}
                </span>
              )}
              {viewMode === 'crop' && (
                <span className="text-sm text-yellow-400">
                  {t('viewer.cropMode')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {viewMode === 'view' ? (
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

              {/* Crop */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEnterCropMode}
                className="text-white hover:bg-white/20"
                title={t('viewer.crop')}
              >
                <CropIcon className="h-5 w-5" />
              </Button>

              {/* Download */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="text-white hover:bg-white/20"
                title={t('contextMenu.download')}
              >
                <Download className="h-5 w-5" />
              </Button>

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
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="text-white hover:bg-red-500/80"
                title={t('contextMenu.delete')}
              >
                <Trash2 className="h-5 w-5" />
              </Button>

              {/* Close */}
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
                // Crop mode controls
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCancelCrop}
                    className="text-white hover:bg-white/20"
                    title={t('viewer.cancel')}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleSaveCrop(false)}
                    disabled={isCropping || !completedCrop}
                    className="text-white hover:bg-white/20"
                  >
                    <Save className="h-5 w-5 mr-2" />
                    {isCropping ? t('viewer.processing') : t('viewer.saveAsNew')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleSaveCrop(true)}
                    disabled={isCropping || !completedCrop}
                    className="text-white hover:bg-white/20"
                  >
                    <Check className="h-5 w-5 mr-2" />
                    {isCropping ? t('viewer.processing') : t('viewer.replaceOriginal')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation arrows - only in view mode */}
        {hasMultipleImages && viewMode === 'view' && (
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
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          {viewMode === 'view' ? (
            // View mode - normal image with zoom/rotation
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
                </div>
              )}
              <img
                src={imageUrl}
                alt={currentImage.originalName}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
                onLoad={() => setImageLoaded(true)}
              />
            </>
          ) : (
            // Crop mode - react-image-crop component
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              className="max-h-full"
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt={currentImage.originalName}
                className="max-w-full max-h-[calc(95vh-120px)] object-contain"
                crossOrigin="anonymous"
              />
            </ReactCrop>
          )}
        </div>

        {/* Info panel - only in view mode */}
        {showInfo && viewMode === 'view' && (
          <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/90 to-transparent p-6">
            <div className="grid grid-cols-2 gap-4 text-white text-sm max-w-2xl">
              <div>
                <div className="text-gray-400">{t('viewer.filename')}</div>
                <div className="font-medium">{currentImage.originalName}</div>
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
                  {currentImage.width} × {currentImage.height}
                </div>
              </div>
              <div>
                <div className="text-gray-400">{t('viewer.uploaded')}</div>
                <div className="font-medium">
                  {format(new Date(currentImage.createdAt), 'yyyy-MM-dd HH:mm')}
                </div>
              </div>
              <div>
                <div className="text-gray-400">{t('viewer.modified')}</div>
                <div className="font-medium">
                  {format(new Date(currentImage.updatedAt), 'yyyy-MM-dd HH:mm')}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};