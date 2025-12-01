import { create } from 'zustand';
import type { ImageWithSource } from '@/types/gallery';
import { getCloudImagePresignedUrlEndpoint } from '@/utils/imagePaths';
import { replaceImages } from '@/services/images.service';
import type { TiffPageDimensions } from '@/types/api';
type ViewMode = 'view' | 'crop';


interface TiffImageViewerStore {
    isOpen: boolean;
    tiffImage: ImageWithSource | null,
    currentPage: number;
    dataUrl: string | null,
    totalPages: number;
    viewMode: ViewMode;
    readOnly: boolean;
    width: number;
    height: number;
    hasUnsavedChanges: boolean;
    openTiffViewer: (image: ImageWithSource) => void;
    closeTiffViewer: () => Promise<void>;
    nextPage: () => void;
    previousPage: () => void;
    enterCropMode: () => void;
    exitCropMode: () => void;
    markAsChanged: () => void;
    saveChanges: () => Promise<void>;
    discardChanges: () => void;
    refreshCurrentPage: () => Promise<void>;
}

export const useTiffImageViewerStore = create<TiffImageViewerStore>((set, get) => ({
    isOpen: false,
    tiffImage: null,
    totalPages: 1,
    dataUrl: null,
    currentPage: 0,
    viewMode: 'view' as const,
    readOnly: false,
    width: 0,
    height: 0,
    hasUnsavedChanges: false,

    openTiffViewer: async (image: ImageWithSource) => {

        if (image.source === 'local') {
            const buffer = await window.electronAPI?.loadLocalImage(image.uuid, image.format);
            if (!buffer) {
                return
            }

            const loadStatus = await window.electronAPI?.tiff.loadBuffer(buffer)
            if (!loadStatus || !loadStatus.success) {
                return
            }

            const res = await window.electronAPI?.tiff.getPreview(0);
            if (!res || !res.success) {
                return
            }
            const { previewSrc, metadata: { width, height, totalPages } } = res;
 
            set({
                isOpen: true,
                tiffImage: image,
                dataUrl: previewSrc,
                currentPage: 0,
                totalPages: totalPages,
                width,
                height
            });
        } else {
            const endpoint = getCloudImagePresignedUrlEndpoint(image.uuid);
            const response = await fetch(endpoint);
            if (!response.ok) {
                console.error('Failed to fetch presigned URL');
                return;
            }
            const data = await response.json();
            if (data.success && data.data.presignedUrl) {
                const imageUrl = data.data.presignedUrl
                const response = await fetch(imageUrl);
                if (!response.ok) {
                    console.error('Failed to fetch cloud image');
                    return;
                }
                const blob = await response.blob();
                const uint8Array = new Uint8Array(await blob.arrayBuffer());
                const loadStatus = await window.electronAPI?.tiff.loadBuffer(uint8Array)
                if (!loadStatus || !loadStatus.success) {
                    return
                }

                const res = await window.electronAPI?.tiff.getPreview(0);
                if (!res || !res.success) {
                    return
                }
                const { previewSrc, metadata: { width, height, totalPages } } = res;

                set({
                    isOpen: true,
                    tiffImage: image,
                    dataUrl: previewSrc,
                    currentPage: 0,
                    totalPages: totalPages,
                    width,
                    height
                });
            }
        }
    },

    closeTiffViewer: async () => {
        const { dataUrl } = get()

        if (dataUrl) URL.revokeObjectURL(dataUrl);

        // Cleanup TIFF buffers in electron main process
        await window.electronAPI?.tiff.cleanup();

        set({
            isOpen: false,
            currentPage: 0,
            viewMode: 'view',
            hasUnsavedChanges: false,
            tiffImage: null,
            dataUrl: null,
        });
    },

    nextPage: async () => {

        const { currentPage, totalPages, tiffImage, dataUrl } = get()
        if (!tiffImage) {
            return
        }
        const nextPage = (currentPage + 1) % totalPages;
        const res = await window.electronAPI?.tiff.getPreview(nextPage)
        if (!res) {
            return
        }
        const { success, previewSrc, metadata: { width, height } } = res;
        if (dataUrl) URL.revokeObjectURL(dataUrl);
        set({
            currentPage: nextPage,
            dataUrl: previewSrc,
            totalPages: totalPages,
            width,
            height
        });
    },

    previousPage: async () => {
        const { currentPage, totalPages, tiffImage, dataUrl } = get()
        if (!tiffImage) {
            return
        }
        const prevPage = (currentPage - 1 + totalPages) % totalPages;
        const res = await window.electronAPI?.tiff.getPreview(prevPage)
        if (!res) {
            return
        }
        const { success, previewSrc, metadata: { width, height } } = res;
        if (dataUrl) URL.revokeObjectURL(dataUrl);
        set({
            currentPage: prevPage,
            dataUrl: previewSrc,
            totalPages: totalPages,
            width,
            height
        });
    },


    enterCropMode: () => {
        set({ viewMode: 'crop' });
    },

    exitCropMode: () => {
        set({ viewMode: 'view' });
    },

    markAsChanged: () => {
        set({ hasUnsavedChanges: true });
    },

    saveChanges: async () => {
        const { tiffImage, totalPages } = get();
        if (!tiffImage) return;

        if (tiffImage.source === 'local') {
            try {
                // Get the final TIFF buffer with all changes
                const finalBuffer = await window.electronAPI?.tiff.getFinalBuffer();
                if (!finalBuffer || !finalBuffer.success || !finalBuffer.buffer) {
                    console.error('Failed to get final buffer:', finalBuffer?.error);
                    alert('Failed to save changes: ' + (finalBuffer?.error || 'Unknown error'));
                    return;
                }

                // Save the TIFF file (write new one)
                const savedPath = await window.electronAPI?.saveImageBuffer(
                    tiffImage.uuid,
                    tiffImage.format,
                    finalBuffer.buffer.buffer as ArrayBuffer
                );

                if (!savedPath) {
                    throw new Error('Failed to save TIFF file');
                }

                // Get metadata for the saved TIFF
                const metadata = await window.electronAPI?.getImgMetadata(savedPath);
                if (!metadata || !metadata.success) {
                    console.error('Failed to get TIFF metadata');
                    throw new Error('Failed to get TIFF metadata');
                }

                // Generate new thumbnail (from first page)
                const thumbnailResult = await window.electronAPI?.generateThumbnail(savedPath, tiffImage.uuid);
                if (!thumbnailResult || !thumbnailResult.success) {
                    console.error('Failed to generate thumbnail');
                }

                // Calculate new file size
                const fileSize = finalBuffer.buffer?.byteLength || tiffImage.fileSize;

                // Prepare page dimensions array
                const pageDimensions = metadata.pages?.map((page: { width: number, height: number }) => ({
                    width: page.width,
                    height: page.height
                })) || [];

                // Update database with new metadata
                await window.electronAPI?.db.updateImage(tiffImage.uuid, {
                    fileSize: fileSize,
                    pageCount: totalPages,
                    tiffDimensions: JSON.stringify(pageDimensions),
                    width: pageDimensions[0]?.width || tiffImage.width,
                    height: pageDimensions[0]?.height || tiffImage.height,
                    updatedAt: new Date().toISOString(),
                });

                set({ hasUnsavedChanges: false });
            } catch (error) {
                console.error('Error saving TIFF changes:', error);
                alert('Failed to save TIFF changes: ' + (error instanceof Error ? error.message : 'Unknown error'));
            }
        } else {
            // Cloud mode - Upload edited TIFF to cloud storage
            try {
                // Get the final TIFF buffer with all changes and metadata
                const finalBuffer = await window.electronAPI?.tiff.getFinalBuffer();
                if (!finalBuffer || !finalBuffer.success || !finalBuffer.buffer || !finalBuffer.metadata) {
                    console.error('Failed to get final buffer:', finalBuffer?.error);
                    alert('Failed to save changes: ' + (finalBuffer?.error || 'Unknown error'));
                    return;
                }

                // Extract metadata directly from buffer
                const { metadata } = finalBuffer;
                const pageDimensions: TiffPageDimensions[] = metadata.pageDimensions;

                //  Create a Blob from buffer
                const tiffBlob = new Blob([finalBuffer.buffer.buffer as ArrayBuffer], { type: 'image/tiff' });

                // Generate thumbnail from the first page
                const firstPagePreview = await window.electronAPI?.tiff.getPreview(0);
                let thumbnailBlob: Blob | undefined;
                if (firstPagePreview && firstPagePreview.success && firstPagePreview.previewSrc) {
                    // Convert data URL to blob for thumbnail
                    const response = await fetch(firstPagePreview.previewSrc);
                    thumbnailBlob = await response.blob();
                }

                // Upload the modified TIFF to cloud
                const replaceResult = await replaceImages([{
                    uuid: tiffImage.uuid,
                    file: tiffBlob,
                    thumbnailBlob: thumbnailBlob,
                    metadata: {
                        width: pageDimensions[0]?.width || tiffImage.width,
                        height: pageDimensions[0]?.height || tiffImage.height,
                        filename: tiffImage.filename,
                        format: 'tiff',
                        mimeType: 'image/tiff',
                        pageCount: metadata.totalPages,
                        tiffDimensions: pageDimensions
                    }
                }]);

                if (replaceResult.errors.length > 0) {
                    throw new Error(`Upload failed: ${replaceResult.errors[0].error}`);
                }

                if (replaceResult.replaced.length === 0) {
                    throw new Error('No images were replaced');
                }

                set({ hasUnsavedChanges: false });
                console.log('Cloud TIFF saved successfully');
            } catch (error) {
                console.error('Error saving cloud TIFF changes:', error);
                alert('Failed to save cloud TIFF changes: ' + (error instanceof Error ? error.message : 'Unknown error'));
            }
        }
    },

    discardChanges: () => {
        set({ hasUnsavedChanges: false });
    },

    refreshCurrentPage: async () => {
        const { currentPage, dataUrl } = get();

        const res = await window.electronAPI?.tiff.getPreview(currentPage);
        if (!res || !res.success) {
            return;
        }

        const { previewSrc, metadata: { width, height, totalPages } } = res;
        if (dataUrl) URL.revokeObjectURL(dataUrl);

        set({
            dataUrl: previewSrc,
            totalPages,
            width,
            height
        });
    },
}));