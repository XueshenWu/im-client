import React, { useCallback, useEffect, useRef, useState } from 'react';
import ImageEditor from 'tui-image-editor';
import 'tui-image-editor/dist/tui-image-editor.css';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { useImageViewerFilerobotStore } from '@/stores/imageViewerFilerobotStore';
import { useGalleryRefreshStore } from '@/stores/galleryRefreshStore';
import { localImageService } from '@/services/localImage.service';
import { generateThumbnail } from '@/utils/thumbnailGenerator';
import { blobToFile } from '@/utils/cropImage';
import { getCloudImagePresignedUrlEndpoint } from '@/utils/imagePaths';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import type { LocalImage } from '@/types/local';

const theme = {
  'common.bi.image': '',
  'common.bisize.width': '0',
  'common.bisize.height': '0',
  'common.backgroundImage': 'none',
  'common.backgroundColor': '#1e1e1e',
  'common.border': '0px',

  // Header
  'header.backgroundImage': 'none',
  'header.backgroundColor': '#1e1e1e',
  'header.border': '0px',

  // Load button
  'loadButton.backgroundColor': '#fff',
  'loadButton.border': '1px solid #ddd',
  'loadButton.color': '#222',
  'loadButton.fontFamily': 'NotoSans, sans-serif',
  'loadButton.fontSize': '12px',

  // Download button
  'downloadButton.backgroundColor': '#fdba74',
  'downloadButton.border': '1px solid #fdba74',
  'downloadButton.color': '#000',
  'downloadButton.fontFamily': 'NotoSans, sans-serif',
  'downloadButton.fontSize': '12px',

  // Menu buttons
  'menu.normalIcon.color': '#8a8a8a',
  'menu.activeIcon.color': '#fff',
  'menu.disabledIcon.color': '#434343',
  'menu.hoverIcon.color': '#e9e9e9',
  'menu.iconSize.width': '24px',
  'menu.iconSize.height': '24px',

  // Submenu
  'submenu.backgroundColor': '#1e1e1e',
  'submenu.partition.color': '#3c3c3c',
  'submenu.normalIcon.color': '#8a8a8a',
  'submenu.activeIcon.color': '#fff',
  'submenu.iconSize.width': '32px',
  'submenu.iconSize.height': '32px',

  // Submenu primary color
  'submenu.normalLabel.color': '#8a8a8a',
  'submenu.normalLabel.fontWeight': 'lighter',
  'submenu.activeLabel.color': '#fff',
  'submenu.activeLabel.fontWeight': 'lighter',

  // Checkbox style
  'checkbox.border': '1px solid #ccc',
  'checkbox.backgroundColor': '#fff',

  // Range style
  'range.pointer.color': '#fff',
  'range.bar.color': '#666',
  'range.subbar.color': '#d1d1d1',

  'range.disabledPointer.color': '#414141',
  'range.disabledBar.color': '#282828',
  'range.disabledSubbar.color': '#414141',

  'range.value.color': '#fff',
  'range.value.fontWeight': 'lighter',
  'range.value.fontSize': '11px',
  'range.value.border': '1px solid #353535',
  'range.value.backgroundColor': '#151515',
  'range.title.color': '#fff',
  'range.title.fontWeight': 'lighter',

  // Colorpicker style
  'colorpicker.button.border': '1px solid #1e1e1e',
  'colorpicker.title.color': '#fff',
};

export const ImageViewerTUI: React.FC = () => {
  const { isOpen, currentImage, isLocalImage, closeEditor } =
    useImageViewerFilerobotStore();
  const { triggerRefresh } = useGalleryRefreshStore();
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const editorRef = useRef<ImageEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load image URL - convert to blob URL for local images
  useEffect(() => {
    if (!currentImage || !isOpen) {
      setImageUrl('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const loadImage = async () => {
      try {
        if (isLocalImage) {
          // Load local image as blob URL (TUI can't handle custom protocols)
          const buffer = await window.electronAPI?.loadLocalImage(
            currentImage.uuid,
            currentImage.format
          );
          if (buffer) {
            const blob = new Blob([buffer as unknown as BlobPart], {
              type: currentImage.mimeType || 'image/jpeg',
            });
            const blobUrl = URL.createObjectURL(blob);
            setImageUrl(blobUrl);
          }
        } else {
          // Fetch presigned URL for cloud images
          const endpoint = getCloudImagePresignedUrlEndpoint(currentImage.uuid);
          const response = await fetch(endpoint);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.presignedUrl) {
              setImageUrl(data.data.presignedUrl);
            }
          }
        }
      } catch (error) {
        console.error('Error loading image:', error);
        toast.error('Failed to load image');
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();

    // Cleanup blob URL on unmount
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [currentImage, isLocalImage, isOpen]);

  // Initialize TUI Image Editor when image URL is ready
  useEffect(() => {
    if (!containerRef.current || !imageUrl || isLoading) return;

    // Destroy existing editor if any
    if (editorRef.current) {
      editorRef.current.destroy();
      editorRef.current = null;
    }

    // Create new editor instance
    editorRef.current = new ImageEditor(containerRef.current, {
      includeUI: {
        loadImage: {
          path: imageUrl,
          name: currentImage?.filename || 'image',
        },
        theme: theme,
        menu: ['crop', 'flip', 'rotate', 'draw', 'shape', 'icon', 'text', 'mask', 'filter'],
        initMenu: 'filter',
        uiSize: {
          width: '100%',
          height: '100%',
        },
        menuBarPosition: 'bottom',
      },
      cssMaxWidth: window.innerWidth * 0.9,
      cssMaxHeight: window.innerHeight * 0.85,
      usageStatistics: false,
    });

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [imageUrl, isLoading, currentImage?.filename]);

  const handleClose = useCallback(() => {
    // Cleanup blob URL
    if (imageUrl && imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl('');
    if (editorRef.current) {
      editorRef.current.destroy();
      editorRef.current = null;
    }
    closeEditor();
  }, [imageUrl, closeEditor]);

  const handleSave = useCallback(
    async (replaceOriginal: boolean) => {
      if (!currentImage || !editorRef.current) return;

      try {
        // Get the edited image data
        const dataURL = editorRef.current.toDataURL({
          format: currentImage.format === 'png' ? 'png' : 'jpeg',
          quality: 0.92,
        });

        // Convert data URL to blob
        const response = await fetch(dataURL);
        const blob = await response.blob();

        // Determine format from mime type
        const format = currentImage.format === 'png' ? 'png' : 'jpeg';
        const fileName = replaceOriginal
          ? currentImage.filename
          : `edited_${currentImage.filename}`;
        const file = blobToFile(blob, fileName);

        if (isLocalImage) {
          // Save locally
          const arrayBuffer = await file.arrayBuffer();
          const imageUuid = replaceOriginal ? currentImage.uuid : uuidv4();

          const savedPath = await window.electronAPI?.saveImageBuffer(
            imageUuid,
            format,
            arrayBuffer
          );

          if (!savedPath) {
            throw new Error('Failed to save edited image');
          }

          // Generate thumbnail
          try {
            await generateThumbnail(savedPath, imageUuid, 300);
          } catch (error) {
            console.error('Failed to generate thumbnail:', error);
          }

          if (replaceOriginal) {
            await localImageService.updateImage(currentImage.uuid, {
              fileSize: file.size,
              updatedAt: new Date().toISOString(),
            });
          } else {
            // Create new image record
            const newImage: LocalImage = {
              uuid: imageUuid,
              filename: fileName,
              fileSize: file.size,
              format: format as any,
              width: editorRef.current.getCanvasSize().width,
              height: editorRef.current.getCanvasSize().height,
              hash: '',
              mimeType: file.type,
              isCorrupted: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deletedAt: null,
              pageCount: 1,
              exifData: currentImage.exifData,
            };
            await localImageService.addImage(newImage);
          }
        } else {
          // Save to cloud
          if (replaceOriginal) {
            const { replaceImages } = await import('@/services/images.service');
            const result = await replaceImages([{
              uuid: currentImage.uuid,
              file: file,
            }]);

            if (result.stats.failed > 0) {
              const error = result.errors[0];
              throw new Error(error?.error || 'Failed to replace image');
            }
          } else {
            const { requestPresignedURLs, uploadToPresignedURL } = await import(
              '@/services/images.service'
            );
            const { generateThumbnailBlob } = await import('@/utils/thumbnailGenerator');

            const newUuid = uuidv4();
            const canvasSize = editorRef.current.getCanvasSize();

            // Calculate hash
            const arrayBuffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

            const presignedURLs = await requestPresignedURLs([
              {
                uuid: newUuid,
                filename: fileName,
                fileSize: file.size,
                format,
                width: canvasSize.width,
                height: canvasSize.height,
                hash,
                mimeType: file.type,
                isCorrupted: false,
              },
            ] as any);

            if (!presignedURLs || presignedURLs.length === 0) {
              throw new Error('Failed to get presigned URLs');
            }

            const urls = presignedURLs[0];

            // Upload thumbnail
            const thumbnailBlob = await generateThumbnailBlob(file, 300);
            await uploadToPresignedURL(urls.thumbnailUrl, thumbnailBlob, true);

            // Upload image
            await uploadToPresignedURL(urls.imageUrl, file, false);
          }
        }

        toast.success(replaceOriginal ? 'Image replaced successfully' : 'Image saved successfully');
        triggerRefresh();
        handleClose();
      } catch (error) {
        console.error('Error saving edited image:', error);
        toast.error('Failed to save edited image. Please try again.');
      }
    },
    [currentImage, isLocalImage, triggerRefresh, handleClose]
  );

  if (!currentImage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0 bg-[#1e1e1e] border-none overflow-hidden"
        aria-describedby={undefined}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Edit: {currentImage.filename}</DialogTitle>
        </VisuallyHidden.Root>

        {/* Loading state */}
        {(isLoading || !imageUrl) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e] z-50">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
          </div>
        )}

        {/* TUI Editor container */}
        <div className="w-full h-full relative">
          <div ref={containerRef} className="w-full h-full" />

          {/* Custom save buttons */}
          {imageUrl && !isLoading && (
            <div className="absolute top-4 right-4 z-50 flex gap-2">
              <button
                onClick={() => handleSave(false)}
                className="px-4 py-2 bg-white text-black rounded hover:bg-gray-200 text-sm font-medium"
              >
                Save As New
              </button>
              <button
                onClick={() => handleSave(true)}
                className="px-4 py-2 bg-orange-400 text-black rounded hover:bg-orange-500 text-sm font-medium"
              >
                Replace Original
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
