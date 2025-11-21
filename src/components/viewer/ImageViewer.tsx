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
  Info
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useImageViewerStore } from '@/stores/imageViewerStore';
import { imageService } from '@/services/api';
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
    closeViewer,
    nextImage,
    previousImage,
  } = useImageViewerStore();

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset zoom and rotation when image changes
  useEffect(() => {
    if (currentImage) {
      setZoom(1);
      setRotation(0);
      setImageLoaded(false);
    }
  }, [currentImage]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [isOpen, images.length, closeViewer, nextImage, previousImage]);

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeViewer()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0 bg-black border-none">
        {/* Top toolbar */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <h2 className="text-lg font-semibold truncate max-w-[400px]">
                {currentImage.originalName}
              </h2>
              {hasMultipleImages && (
                <span className="text-sm text-gray-300">
                  {currentIndex + 1} / {images.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
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

              {/* Close */}
              <Button
                variant="ghost"
                size="icon"
                onClick={closeViewer}
                className="text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation arrows */}
        {hasMultipleImages && (
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
        </div>

        {/* Info panel */}
        {showInfo && (
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