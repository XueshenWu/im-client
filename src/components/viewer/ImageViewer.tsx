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
import { replaceImages, deleteImages } from '@/services/images.service';
import { createCroppedImage, blobToFile } from '@/utils/cropImage';
import { format } from 'date-fns';
import { localImageService } from '@/services/localImage.service';
import { LocalImage } from '@/types/local';
import { generateThumbnail } from '@/utils/thumbnailGenerator';
import { getImageUrl, getCloudImagePresignedUrlEndpoint } from '@/utils/imagePaths';
import { v4 as uuidv4 } from 'uuid';


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
    readOnly,
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
  const [cloudImageUrl, setCloudImageUrl] = useState<string>('');

  // Crop mode states
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const { triggerRefresh } = useGalleryRefreshStore();

  const isLocalImage = currentImage ? (currentImage as any).source === 'local' : false;

  // Fetch presigned URL for cloud images
  useEffect(() => {
    if (!currentImage || isLocalImage) {
      setCloudImageUrl('');
      return;
    }

    // Fetch presigned URL from the endpoint
    const fetchPresignedUrl = async () => {
      try {
        const endpoint = getCloudImagePresignedUrlEndpoint(currentImage.uuid);
        const response = await fetch(endpoint);
        if (!response.ok) {
          console.error('Failed to fetch presigned URL');
          return;
        }
        const data = await response.json();
        if (data.success && data.data.presignedUrl) {
          setCloudImageUrl(data.data.presignedUrl);
        }
      } catch (error) {
        console.error('Error fetching presigned URL:', error);
      }
    };

    fetchPresignedUrl();
  }, [currentImage, isLocalImage]);

  // Determine the image URL to use
  const imageUrl = React.useMemo(() => {
    if (!currentImage) return '';

    if (isLocalImage) {
      // Use UUID-based URL for local images
      return getImageUrl(currentImage.uuid, currentImage.format);
    }

    // For cloud images, use the fetched presigned URL
    return cloudImageUrl;
  }, [currentImage, isLocalImage, cloudImageUrl]);

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
        ? currentImage.filename
        : `cropped_${currentImage.filename}`;
      const croppedFile = blobToFile(croppedBlob, fileName);

      if (isLocalImage) {
        // LOCAL MODE: Save to local storage
        const arrayBuffer = await croppedFile.arrayBuffer();

        // Generate UUID for the new/updated image
        const imageUuid = replaceOriginal ? currentImage.uuid : uuidv4();

        // Save the cropped image buffer using UUID
        const savedPath = await window.electronAPI?.saveImageBuffer(
          imageUuid,
          format === 'png' ? 'png' : 'jpeg',
          arrayBuffer
        );

        if (!savedPath) {
          throw new Error('Failed to save cropped image to local storage');
        }

        // Generate thumbnail for the cropped image
        let imageWidth = 0;
        let imageHeight = 0;

        try {
          const thumbnailResult = await generateThumbnail(savedPath, imageUuid, 300);
          if (thumbnailResult.success) {
            imageWidth = thumbnailResult.width || 0;
            imageHeight = thumbnailResult.height || 0;
          }
        } catch (error) {
          console.error('Failed to generate thumbnail for cropped image:', error);
        }

        if (replaceOriginal) {
          // Update the existing record
          await localImageService.updateImage(currentImage.uuid, {
            fileSize: croppedFile.size,
            width: imageWidth,
            height: imageHeight,
            updatedAt: new Date().toISOString(),
          });
        } else {
          // Create a new record
          const newImage: LocalImage = {
            uuid: imageUuid,
            filename: fileName,
            fileSize: croppedFile.size,
            format: (format === 'png' ? 'png' : 'jpeg') as any,
            width: imageWidth,
            height: imageHeight,
            hash: '',
            mimeType: croppedFile.type,
            isCorrupted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deletedAt: null,
            pageCount:1,
            exifData:currentImage.exifData
          };
          await localImageService.addImage(newImage);
        }
      } else {
        // CLOUD MODE: Upload to cloud using presigned URLs
        if (replaceOriginal) {
          // Replace the original image using replaceImages
          const result = await replaceImages([{
            uuid: currentImage.uuid,
            file: croppedFile,
          }]);

          if (result.stats.failed > 0) {
            const error = result.errors[0];
            throw new Error(error?.error || 'Failed to replace image');
          }
        } else {
          // Upload as new image using requestPresignedURLs
          const { requestPresignedURLs, uploadToPresignedURL } = await import('@/services/images.service');
          const { generateThumbnailBlob } = await import('@/utils/thumbnailGenerator');

          // Generate UUID and calculate metadata
          const newUuid = uuidv4();
          const imageFormat = format === 'png' ? 'png' : 'jpeg';

          // Calculate dimensions from the cropped blob
          const img = new Image();
          const imageUrl = URL.createObjectURL(croppedFile);
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              URL.revokeObjectURL(imageUrl);
              resolve();
            };
            img.onerror = () => {
              URL.revokeObjectURL(imageUrl);
              reject(new Error('Failed to load cropped image'));
            };
            img.src = imageUrl;
          });

          const width = img.naturalWidth;
          const height = img.naturalHeight;

          // Calculate file hash using Web Crypto API
          const arrayBuffer = await croppedFile.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

          // Request presigned URLs
          const presignedURLs = await requestPresignedURLs([{
            uuid: newUuid,
            filename: fileName,
            fileSize: croppedFile.size,
            format: imageFormat,
            width,
            height,
            hash,
            mimeType: croppedFile.type,
            isCorrupted: false,
          }]);

          if (!presignedURLs || presignedURLs.length === 0) {
            throw new Error('Failed to get presigned URLs');
          }

          const urls = presignedURLs[0];

          // Generate and upload thumbnail first
          const thumbnailBlob = await generateThumbnailBlob(croppedFile, 300);
          const thumbnailSuccess = await uploadToPresignedURL(urls.thumbnailUrl, thumbnailBlob, true);

          if (!thumbnailSuccess) {
            throw new Error('Failed to upload thumbnail');
          }

          // Upload the cropped image
          const imageSuccess = await uploadToPresignedURL(urls.imageUrl, croppedFile, false);

          if (!imageSuccess) {
            throw new Error('Failed to upload cropped image');
          }
        }
      }

      // Trigger gallery refresh to show updated data
      triggerRefresh();

      // Exit crop mode and close viewer
      exitCropMode();
      closeViewer();
    } catch (error) {
      console.error('Error saving cropped image:', error);
      alert('Failed to save cropped image. Please try again.');
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

  const hasMultipleImages = images.length > 1;

  const handleDownload = async () => {
    try {
      if (isLocalImage) {
        // Fetch using the local-image:// protocol
        const buffer = await window.electronAPI?.loadLocalImage(currentImage.uuid, currentImage.format)
        if (!buffer) {
          throw "cannot read file"
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
        // Cloud image download - fetch from presigned URL endpoint
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
      if (isLocalImage) {
        // LOCAL MODE: Delete from local database
        await localImageService.deleteImage(currentImage.uuid);
      } else {
        // CLOUD MODE: Delete from cloud
        await deleteImages([currentImage.uuid]);
      }

      triggerRefresh();
      closeViewer();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete image. Please try again.');
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

                  {/* Crop - Hide in readonly mode */}
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleEnterCropMode}
                      className="text-white hover:bg-white/20"
                      title={t('viewer.crop')}
                    >
                      <CropIcon className="h-5 w-5" />
                    </Button>
                  )}

                  {/* Download - Hide in readonly mode */}
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

                  {/* Delete - Hide in readonly mode */}
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
                // Crop mode controls (unchanged)
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
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-16">
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
                alt={currentImage.filename}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
                onLoad={() => setImageLoaded(true)}
              />
            </>
          ) : (
            // Crop mode - react-image-crop component
            <div className="flex items-center justify-center w-full h-full">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                className="max-h-full max-w-full"
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt={currentImage.filename}
                  style={{
                    width: 'auto',
                    height: 'auto',
                    maxWidth: 'calc(95vw - 8rem)',
                    maxHeight: 'calc(95vh - 8rem)',
                    minWidth: '400px',
                    minHeight: '400px',
                    objectFit: 'contain',
                  }}
                  crossOrigin="anonymous"
                />
              </ReactCrop>
            </div>
          )}
        </div>

        {/* Info panel - only in view mode */}
        {showInfo && viewMode === 'view' && (
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