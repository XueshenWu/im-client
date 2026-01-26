import React, { useState, useCallback } from 'react';
import { Crop as CropIcon, X, Save, Check } from 'lucide-react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { createCroppedImage, blobToFile } from '@/utils/cropImage';
import { localImageService } from '@/services/localImage.service';
import { replaceImages } from '@/services/images.service';
import { generateThumbnail } from '@/utils/thumbnailGenerator';
import type { LocalImage } from '@/types/local';
import type { ImageEditorTool, ToolContext, CropToolState } from '../types';

const TOOL_ID = 'crop';

// Crop mode controls component
const CropModeControls: React.FC<{ ctx: ToolContext }> = ({ ctx }) => {
  const { t } = useTranslation();
  const toolState = ctx.getToolState<CropToolState>(TOOL_ID) || {
    isProcessing: false,
    completedCrop: undefined,
  };

  const handleCancel = () => {
    ctx.setToolState(TOOL_ID, { ...toolState, crop: undefined, completedCrop: undefined });
    ctx.setActiveTool(null);
  };

  const handleSave = async (replaceOriginal: boolean) => {
    const { completedCrop } = toolState;
    if (!ctx.image || !completedCrop || !ctx.imageRef.current) return;

    ctx.setToolState(TOOL_ID, { ...toolState, isProcessing: true });

    try {
      const format = ctx.image.format === 'png' ? 'png' : 'jpeg';
      const croppedBlob = await createCroppedImage(
        ctx.imageRef.current,
        completedCrop as PixelCrop,
        format,
        0.95
      );

      const fileName = replaceOriginal
        ? ctx.image.filename
        : `cropped_${ctx.image.filename}`;
      const croppedFile = blobToFile(croppedBlob, fileName);

      if (ctx.isLocalImage) {
        await saveLocalImage(ctx, croppedFile, format, replaceOriginal, fileName);
      } else {
        await saveCloudImage(ctx, croppedFile, format, replaceOriginal, fileName);
      }

      ctx.triggerRefresh();
      ctx.setActiveTool(null);
      ctx.closeViewer();
    } catch (error) {
      console.error('Error saving cropped image:', error);
      alert('Failed to save cropped image. Please try again.');
    } finally {
      ctx.setToolState(TOOL_ID, { ...toolState, isProcessing: false });
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCancel}
        className="text-white hover:bg-white/20"
        title={t('viewer.cancel')}
      >
        <X className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        onClick={() => handleSave(false)}
        disabled={toolState.isProcessing || !toolState.completedCrop}
        className="text-white hover:bg-white/20"
      >
        <Save className="h-5 w-5 mr-2" />
        {toolState.isProcessing ? t('viewer.processing') : t('viewer.saveAsNew')}
      </Button>
      <Button
        variant="ghost"
        onClick={() => handleSave(true)}
        disabled={toolState.isProcessing || !toolState.completedCrop}
        className="text-white hover:bg-white/20"
      >
        <Check className="h-5 w-5 mr-2" />
        {toolState.isProcessing ? t('viewer.processing') : t('viewer.replaceOriginal')}
      </Button>
    </>
  );
};

// Crop canvas overlay component
const CropCanvas: React.FC<{ ctx: ToolContext }> = ({ ctx }) => {
  const toolState = ctx.getToolState<CropToolState>(TOOL_ID) || {
    crop: undefined,
    completedCrop: undefined,
    isProcessing: false,
  };

  const handleCropChange = (c: Crop) => {
    ctx.setToolState(TOOL_ID, { ...toolState, crop: c });
  };

  const handleCropComplete = (c: PixelCrop) => {
    ctx.setToolState(TOOL_ID, { ...toolState, completedCrop: c });
  };

  return (
    <div className="flex items-center justify-center w-full h-full">
      <ReactCrop
        crop={toolState.crop}
        onChange={handleCropChange}
        onComplete={handleCropComplete}
        className="max-h-full max-w-full"
      >
        <img
          ref={ctx.imageRef}
          src={ctx.imageUrl}
          alt={ctx.image.filename}
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
  );
};

// Helper function to save local image
async function saveLocalImage(
  ctx: ToolContext,
  croppedFile: File,
  format: 'png' | 'jpeg',
  replaceOriginal: boolean,
  fileName: string
) {
  const arrayBuffer = await croppedFile.arrayBuffer();
  const imageUuid = replaceOriginal ? ctx.image.uuid : uuidv4();

  const savedPath = await window.electronAPI?.saveImageBuffer(
    imageUuid,
    format,
    arrayBuffer
  );

  if (!savedPath) {
    throw new Error('Failed to save cropped image to local storage');
  }

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
    await localImageService.updateImage(ctx.image.uuid, {
      fileSize: croppedFile.size,
      width: imageWidth,
      height: imageHeight,
      updatedAt: new Date().toISOString(),
    });
  } else {
    const newImage: LocalImage = {
      uuid: imageUuid,
      filename: fileName,
      fileSize: croppedFile.size,
      format: format as any,
      width: imageWidth,
      height: imageHeight,
      hash: '',
      mimeType: croppedFile.type,
      isCorrupted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      pageCount: 1,
      exifData: ctx.image.exifData,
    };
    await localImageService.addImage(newImage);
  }
}

// Helper function to save cloud image
async function saveCloudImage(
  ctx: ToolContext,
  croppedFile: File,
  format: 'png' | 'jpeg',
  replaceOriginal: boolean,
  fileName: string
) {
  if (replaceOriginal) {
    const result = await replaceImages([{
      uuid: ctx.image.uuid,
      file: croppedFile,
    }]);

    if (result.stats.failed > 0) {
      const error = result.errors[0];
      throw new Error(error?.error || 'Failed to replace image');
    }
  } else {
    const { requestPresignedURLs, uploadToPresignedURL } = await import('@/services/images.service');
    const { generateThumbnailBlob } = await import('@/utils/thumbnailGenerator');

    const newUuid = uuidv4();
    const imageFormat = format === 'png' ? 'png' : 'jpeg';

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

    const arrayBuffer = await croppedFile.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

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
    }] as any);

    if (!presignedURLs || presignedURLs.length === 0) {
      throw new Error('Failed to get presigned URLs');
    }

    const urls = presignedURLs[0];

    const thumbnailBlob = await generateThumbnailBlob(croppedFile, 300);
    const thumbnailSuccess = await uploadToPresignedURL(urls.thumbnailUrl, thumbnailBlob, true);

    if (!thumbnailSuccess) {
      throw new Error('Failed to upload thumbnail');
    }

    const imageSuccess = await uploadToPresignedURL(urls.imageUrl, croppedFile, false);

    if (!imageSuccess) {
      throw new Error('Failed to upload cropped image');
    }
  }
}

// Export the crop tool definition
export const cropTool: ImageEditorTool = {
  id: TOOL_ID,
  icon: CropIcon,
  label: 'Crop',
  onActivate: (ctx) => {
    ctx.setToolState(TOOL_ID, {
      crop: undefined,
      completedCrop: undefined,
      isProcessing: false,
    });
    ctx.setActiveTool(TOOL_ID);
  },
  onDeactivate: (ctx) => {
    ctx.setToolState(TOOL_ID, {
      crop: undefined,
      completedCrop: undefined,
      isProcessing: false,
    });
  },
  renderModeControls: (ctx) => <CropModeControls ctx={ctx} />,
  renderCanvas: (ctx) => <CropCanvas ctx={ctx} />,
};
