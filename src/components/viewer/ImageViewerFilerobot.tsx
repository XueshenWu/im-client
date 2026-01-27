import React, { useCallback, useEffect, useState } from 'react';
import FilerobotImageEditor, {
  TABS,
  TOOLS,
} from 'react-filerobot-image-editor';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { useImageViewerFilerobotStore } from '@/stores/imageViewerFilerobotStore';
import { useGalleryRefreshStore } from '@/stores/galleryRefreshStore';
import { localImageService } from '@/services/localImage.service';
import { generateThumbnail } from '@/utils/thumbnailGenerator';
import { blobToFile } from '@/utils/cropImage';
import { getCloudImagePresignedUrlEndpoint } from '@/utils/imagePaths';
import { v4 as uuidv4 } from 'uuid';
import type { LocalImage } from '@/types/local';

export const ImageViewerFilerobot: React.FC = () => {
  const { isOpen, currentImage, isLocalImage, closeEditor } =
    useImageViewerFilerobotStore();
  const { triggerRefresh } = useGalleryRefreshStore();
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

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
          // Load local image as blob URL (Filerobot can't handle custom protocols)
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

  const handleClose = useCallback(() => {
    // Cleanup blob URL
    if (imageUrl && imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl('');
    closeEditor();
  }, [imageUrl, closeEditor]);

  const handleSave = useCallback(
    async (editedImageObject: any, _designState: any) => {
      if (!currentImage) return;

      try {
        // Get the edited image data
        const { imageBase64, fullName, mimeType } = editedImageObject;

        // Convert base64 to blob
        const response = await fetch(imageBase64);
        const blob = await response.blob();

        // Determine format from mime type
        const format = mimeType === 'image/png' ? 'png' : 'jpeg';
        const fileName = fullName || `edited_${currentImage.filename}`;
        const file = blobToFile(blob, fileName);

        if (isLocalImage) {
          // Save locally
          const arrayBuffer = await file.arrayBuffer();
          const imageUuid = uuidv4();

          const savedPath = await window.electronAPI?.saveImageBuffer(
            imageUuid,
            format,
            arrayBuffer
          );

          if (!savedPath) {
            throw new Error('Failed to save edited image');
          }

          // Generate thumbnail
          let width = editedImageObject.width || 0;
          let height = editedImageObject.height || 0;

          try {
            const thumbnailResult = await generateThumbnail(savedPath, imageUuid, 300);
            if (thumbnailResult.success) {
              width = thumbnailResult.width || width;
              height = thumbnailResult.height || height;
            }
          } catch (error) {
            console.error('Failed to generate thumbnail:', error);
          }

          // Create new image record
          const newImage: LocalImage = {
            uuid: imageUuid,
            filename: fileName,
            fileSize: file.size,
            format: format as any,
            width,
            height,
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
        } else {
          // Save to cloud as new image
          const { requestPresignedURLs, uploadToPresignedURL } = await import(
            '@/services/images.service'
          );
          const { generateThumbnailBlob } = await import('@/utils/thumbnailGenerator');

          const newUuid = uuidv4();
          const width = editedImageObject.width || 0;
          const height = editedImageObject.height || 0;

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
              width,
              height,
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

        triggerRefresh();
        handleClose();
      } catch (error) {
        console.error('Error saving edited image:', error);
        alert('Failed to save edited image. Please try again.');
      }
    },
    [currentImage, isLocalImage, triggerRefresh, handleClose]
  );

  if (!currentImage) return null;

  // Show loading spinner
  if (isLoading || !imageUrl) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent
          className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0 bg-black border-none overflow-hidden flex items-center justify-center"
          aria-describedby={undefined}
        >
          <VisuallyHidden.Root>
            <DialogTitle>Loading: {currentImage.filename}</DialogTitle>
          </VisuallyHidden.Root>
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0 bg-black border-none overflow-hidden"
        aria-describedby={undefined}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Edit: {currentImage.filename}</DialogTitle>
        </VisuallyHidden.Root>

        <div className="w-full h-full filerobot-container">
          <FilerobotImageEditor
            source={imageUrl}
            onSave={handleSave}
            onClose={handleClose}
            annotationsCommon={{
              fill: '#ff0000',
            }}
            Text={{ text: 'Text...' }}
            Rotate={{ angle: 90, componentType: 'slider' }}
            Crop={{
              presetsItems: [
                {
                  titleKey: 'classicTv',
                  descriptionKey: '4:3',
                  ratio: 4 / 3,
                },
                {
                  titleKey: 'cipi',
                  descriptionKey: '16:9',
                  ratio: 16 / 9,
                },
                {
                  titleKey: 'portrait',
                  descriptionKey: '3:4',
                  ratio: 3 / 4,
                },
                {
                  titleKey: 'square',
                  descriptionKey: '1:1',
                  ratio: 1,
                },
              ],
            }}
            tabsIds={[TABS.ADJUST, TABS.ANNOTATE, TABS.FILTERS, TABS.FINETUNE, TABS.RESIZE]}
            defaultTabId={TABS.ADJUST}
            defaultToolId={TOOLS.CROP}
            savingPixelRatio={1}
            previewPixelRatio={1}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
