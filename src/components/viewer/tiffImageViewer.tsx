import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    X,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    Download,
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

import { useGalleryRefreshStore } from '@/stores/galleryRefreshStore';

import { format } from 'date-fns';

import { useTiffImageViewerStore } from '@/stores/tiffImageViewerStore';


const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const TiffImageViewer: React.FC = () => {
    const { t } = useTranslation();
    const { currentPage, dataUrl, width, height, nextPage, previousPage, enterCropMode, exitCropMode, readOnly, isOpen, viewMode, closeTiffViewer, totalPages, tiffImage, hasUnsavedChanges, markAsChanged, refreshCurrentPage, saveChanges, discardChanges } = useTiffImageViewerStore()

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

    // Handle close with unsaved changes
    const handleClose = async () => {
        if (hasUnsavedChanges) {
            const userChoice = confirm(t('viewer.unsavedChangesPrompt', { defaultValue: 'You have unsaved changes. Do you want to save them before closing?' }));
            if (userChoice) {
                await saveChanges();
                triggerRefresh();
            } else {
                discardChanges();
            }
        }
        closeTiffViewer();
    };









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
        if (!completedCrop || !imgRef.current || !tiffImage) {
            return;
        }

        setIsCropping(true);

        try {
            // completedCrop coordinates are relative to the RENDERED image on screen
            // imgRef.current gives us the actual displayed dimensions
            // imgRef.current.naturalWidth/Height are the PNG preview dimensions

            const displayedWidth = imgRef.current.width;
            const displayedHeight = imgRef.current.height;
            const naturalWidth = imgRef.current.naturalWidth;
            const naturalHeight = imgRef.current.naturalHeight;

            // Scale from displayed dimensions to natural PNG dimensions
            const scaleX = naturalWidth / displayedWidth;
            const scaleY = naturalHeight / displayedHeight;

            // Use Math.round for consistent rounding to minimize distortion
            let x = Math.round(completedCrop.x * scaleX);
            let y = Math.round(completedCrop.y * scaleY);
            let width = Math.round(completedCrop.width * scaleX);
            let height = Math.round(completedCrop.height * scaleY);

            // Clamp to image bounds to prevent extraction errors
            x = Math.max(0, Math.min(x, naturalWidth - width));
            y = Math.max(0, Math.min(y, naturalHeight - height));

            // Ensure width and height don't exceed bounds
            if (x + width > naturalWidth) width = naturalWidth - x;
            if (y + height > naturalHeight) height = naturalHeight - y;

            // Ensure minimum size
            width = Math.max(1, width);
            height = Math.max(1, height);

            const cropData = { x, y, width, height };

            console.log('Crop scaling:', {
                displayed: { width: displayedWidth, height: displayedHeight },
                natural: { width: naturalWidth, height: naturalHeight },
                scale: { scaleX, scaleY },
                cropInput: completedCrop,
                cropOutput: cropData,
                bounds: { maxX: naturalWidth, maxY: naturalHeight }
            });

            // Perform the crop in the electron main process
            const cropResult = await window.electronAPI?.tiff.cropPage(currentPage, cropData);
            if (!cropResult || !cropResult.success || !cropResult.buffer) {
                console.error('Failed to crop page');
                setIsCropping(false);
                return;
            }

            if (replaceOriginal) {
                // Replace the current page
                console.log('Replacing page', currentPage);
                const replaceResult = await window.electronAPI?.tiff.replacePage(currentPage, cropResult.buffer);
                if (!replaceResult || !replaceResult.success) {
                    console.error('Failed to replace page');
                    setIsCropping(false);
                    return;
                }
                console.log('Page replaced successfully');
            } else {
                // Append as new page
                console.log('Appending new page');
                const appendResult = await window.electronAPI?.tiff.appendPage(cropResult.buffer);
                if (!appendResult || !appendResult.success) {
                    console.error('Failed to append page');
                    setIsCropping(false);
                    return;
                }
                console.log('Page appended successfully, new total:', appendResult.totalPages);
            }

            // Mark as changed
            markAsChanged();

            // Refresh the preview to show the updated page
            console.log('Refreshing preview for page', currentPage);
            await refreshCurrentPage();
            console.log('Preview refreshed');

            // Exit crop mode
            exitCropMode();
            setCrop(undefined);
            setCompletedCrop(undefined);
        } catch (error) {
            console.error('Error saving crop:', error);
        } finally {
            setIsCropping(false);
        }
    };

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = async (e: KeyboardEvent) => {
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
                    handleClose();
                    break;
                case 'ArrowLeft':
                    await previousPage();
                    break;
                case 'ArrowRight':
                    await nextPage();
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
    }, [isOpen, viewMode, handleClose, nextPage, previousPage, handleCancelCrop]);

    if (!dataUrl) return null;

    const hasMultipleImages = totalPages > 1;

    const handleDownload = async () => {

    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
    const handleResetView = () => {
        setZoom(1);
        setRotation(0);
    };

    const handleDelete = async () => {

    };
    if (!tiffImage) {
        return null
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0 bg-black border-none" aria-describedby={undefined}>
                <VisuallyHidden.Root>
                    <DialogTitle>{tiffImage.filename}</DialogTitle>
                </VisuallyHidden.Root>
                {/* Top toolbar */}
                <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white">
                            <h2 className="text-lg font-semibold truncate max-w-[400px]">
                                {tiffImage.filename}
                            </h2>
                            {hasMultipleImages && viewMode === 'view' && (
                                <span className="text-sm text-gray-300">
                                    {currentPage + 1} / {totalPages}
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
                                        onClick={handleClose}
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
                                        {isCropping ? t('viewer.processing') : "Append to the last"}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleSaveCrop(true)}
                                        disabled={isCropping || !completedCrop}
                                        className="text-white hover:bg-white/20"
                                    >
                                        <Check className="h-5 w-5 mr-2" />
                                        {isCropping ? t('viewer.processing') : "Replace current page"}
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
                            onClick={previousPage}
                            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
                        >
                            <ChevronLeft className="h-8 w-8" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={nextPage}
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
                                src={dataUrl}
                                alt={tiffImage.filename}
                                className="max-w-full max-h-full object-contain transition-transform duration-200"
                                style={{
                                    transform: `scale(${zoom})`,
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
                                style={{
                                    display: 'inline-block',
                                    maxWidth: 'calc(95vw - 8rem)',
                                    maxHeight: 'calc(95vh - 8rem)',
                                }}
                            >
                                <img
                                    ref={imgRef}
                                    src={dataUrl}
                                    alt={tiffImage.filename}
                                    style={{
                                        display: 'block',
                                        width: 'auto',
                                        height: 'auto',
                                        maxWidth: 'calc(95vw - 8rem)',
                                        maxHeight: 'calc(95vh - 8rem)',
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
                                <div className="font-medium">{tiffImage.filename}</div>
                            </div>
                            <div>
                                <div className="text-gray-400">{t('viewer.fileSize')}</div>
                                <div className="font-medium">{formatBytes(tiffImage.fileSize)}</div>
                            </div>
                            <div>
                                <div className="text-gray-400">{t('viewer.format')}</div>
                                <div className="font-medium uppercase">{tiffImage.format}</div>
                            </div>
                            <div>
                                <div className="text-gray-400">{t('viewer.dimensions')}</div>
                                <div className="font-medium">
                                    {tiffImage.tiffDimensions && tiffImage.tiffDimensions.length > 0
                                        ? `${tiffImage.tiffDimensions[0].width} × ${tiffImage.tiffDimensions[0].height} (Page 1/${tiffImage.pageCount || 1})`
                                        : `${tiffImage.width || 0} × ${tiffImage.height || 0}`}
                                </div>
                            </div>
                            <div>
                                <div className="text-gray-400">{t('viewer.uploaded')}</div>
                                <div className="font-medium">
                                    {tiffImage.createdAt ? format(new Date(tiffImage.createdAt), 'yyyy-MM-dd HH:mm') : 'N/A'}
                                </div>
                            </div>
                            <div>
                                <div className="text-gray-400">{t('viewer.modified')}</div>
                                <div className="font-medium">
                                    {tiffImage.updatedAt ? format(new Date(tiffImage.updatedAt), 'yyyy-MM-dd HH:mm') : 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};