import React, { useState, useMemo, useEffect } from 'react';
import { Filter, X, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { v4 as uuidv4 } from 'uuid';
import { blobToFile } from '@/utils/cropImage';
import { localImageService } from '@/services/localImage.service';
import { replaceImages } from '@/services/images.service';
import { generateThumbnail } from '@/utils/thumbnailGenerator';
import type { LocalImage } from '@/types/local';
import type { ImageEditorTool, ToolContext, FilterToolState, ImageFilter } from '../types';
import { builtInFilters, applyFilterToImage } from '../filters';

const TOOL_ID = 'filter';

interface FilterToolProps {
  ctx: ToolContext;
  filters: ImageFilter[];
}

// Filter mode controls component
const FilterModeControls: React.FC<FilterToolProps> = ({ ctx, filters }) => {
  const toolState = ctx.getToolState<FilterToolState>(TOOL_ID) || {
    selectedFilterId: null,
    filterParams: {},
    isProcessing: false,
  };

  const selectedFilter = filters.find(f => f.id === toolState.selectedFilterId);

  const handleCancel = () => {
    ctx.setToolState(TOOL_ID, {
      selectedFilterId: null,
      filterParams: {},
      isProcessing: false,
    });
    ctx.setActiveTool(null);
  };

  const handleSave = async (replaceOriginal: boolean) => {
    if (!ctx.image || !ctx.imageRef.current || !selectedFilter) return;

    ctx.setToolState(TOOL_ID, { ...toolState, isProcessing: true });

    try {
      const format = ctx.image.format === 'png' ? 'png' : 'jpeg';
      const filteredBlob = await applyFilterToImage(
        ctx.imageRef.current,
        selectedFilter,
        toolState.filterParams,
        format
      );

      const fileName = replaceOriginal
        ? ctx.image.filename
        : `${selectedFilter.id}_${ctx.image.filename}`;
      const filteredFile = blobToFile(filteredBlob, fileName);

      if (ctx.isLocalImage) {
        await saveLocalImage(ctx, filteredFile, format, replaceOriginal, fileName);
      } else {
        await saveCloudImage(ctx, filteredFile, format, replaceOriginal, fileName);
      }

      ctx.triggerRefresh();
      ctx.setActiveTool(null);
      ctx.closeViewer();
    } catch (error) {
      console.error('Error saving filtered image:', error);
      alert('Failed to save filtered image. Please try again.');
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
        title="Cancel"
      >
        <X className="h-5 w-5" />
      </Button>
      {selectedFilter && (
        <span className="text-sm text-gray-300 mx-2">
          Preview: {selectedFilter.label}
        </span>
      )}
      <Button
        variant="ghost"
        onClick={() => handleSave(false)}
        disabled={toolState.isProcessing || !selectedFilter}
        className="text-white hover:bg-white/20"
      >
        <Save className="h-5 w-5 mr-2" />
        {toolState.isProcessing ? 'Processing...' : 'Save As New'}
      </Button>
      <Button
        variant="ghost"
        onClick={() => handleSave(true)}
        disabled={toolState.isProcessing || !selectedFilter}
        className="text-white hover:bg-white/20"
      >
        <Check className="h-5 w-5 mr-2" />
        {toolState.isProcessing ? 'Processing...' : 'Replace Original'}
      </Button>
    </>
  );
};

// Filter canvas with preview and filter selector
const FilterCanvas: React.FC<FilterToolProps> = ({ ctx, filters }) => {
  const toolState = ctx.getToolState<FilterToolState>(TOOL_ID) || {
    selectedFilterId: filters[0]?.id || null,
    filterParams: {},
    isProcessing: false,
  };

  const selectedFilter = filters.find(f => f.id === toolState.selectedFilterId);

  // Initialize params from filter defaults
  useEffect(() => {
    if (selectedFilter?.defaultParams && Object.keys(toolState.filterParams).length === 0) {
      ctx.setToolState(TOOL_ID, {
        ...toolState,
        filterParams: { ...selectedFilter.defaultParams },
      });
    }
  }, [selectedFilter]);

  const handleFilterSelect = (filterId: string) => {
    const filter = filters.find(f => f.id === filterId);
    ctx.setToolState(TOOL_ID, {
      ...toolState,
      selectedFilterId: filterId,
      filterParams: filter?.defaultParams || {},
    });
  };

  const handleParamChange = (key: string, value: number) => {
    ctx.setToolState(TOOL_ID, {
      ...toolState,
      filterParams: { ...toolState.filterParams, [key]: value },
    });
  };

  // Compute CSS filter string for preview
  const previewFilter = useMemo(() => {
    if (!selectedFilter?.cssFilter) return 'none';
    return selectedFilter.cssFilter(toolState.filterParams);
  }, [selectedFilter, toolState.filterParams]);

  return (
    <div className="flex flex-col items-center w-full h-full">
      {/* Filter selector panel */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 bg-black/80 rounded-lg p-4 max-w-xl">
        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2 justify-center mb-3">
          {filters.map((filter) => (
            <Button
              key={filter.id}
              variant={toolState.selectedFilterId === filter.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterSelect(filter.id)}
              className={toolState.selectedFilterId === filter.id
                ? 'bg-white text-black hover:bg-gray-200'
                : 'text-white border-white/30 hover:bg-white/20'}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* Parameter sliders */}
        {selectedFilter?.paramConfig && selectedFilter.paramConfig.length > 0 && (
          <div className="space-y-2 mt-3 border-t border-white/20 pt-3">
            {selectedFilter.paramConfig.map((param) => (
              <div key={param.key} className="flex items-center gap-3">
                <label className="text-white text-sm min-w-[80px]">{param.label}</label>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={toolState.filterParams[param.key] ?? param.default}
                  onChange={(e) => handleParamChange(param.key, Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-white text-sm min-w-[40px] text-right">
                  {toolState.filterParams[param.key] ?? param.default}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image preview with filter applied */}
      <div className="flex items-center justify-center w-full h-full">
        <img
          ref={ctx.imageRef}
          src={ctx.imageUrl}
          alt={ctx.image.filename}
          style={{
            width: 'auto',
            height: 'auto',
            maxWidth: 'calc(95vw - 8rem)',
            maxHeight: 'calc(95vh - 12rem)',
            objectFit: 'contain',
            filter: previewFilter,
            transition: 'filter 0.2s ease',
          }}
          crossOrigin="anonymous"
        />
      </div>
    </div>
  );
};

// Helper function to save local image
async function saveLocalImage(
  ctx: ToolContext,
  filteredFile: File,
  format: 'png' | 'jpeg',
  replaceOriginal: boolean,
  fileName: string
) {
  const arrayBuffer = await filteredFile.arrayBuffer();
  const imageUuid = replaceOriginal ? ctx.image.uuid : uuidv4();

  const savedPath = await window.electronAPI?.saveImageBuffer(
    imageUuid,
    format,
    arrayBuffer
  );

  if (!savedPath) {
    throw new Error('Failed to save filtered image to local storage');
  }

  const imageWidth = ctx.imageRef.current?.naturalWidth || 0;
  const imageHeight = ctx.imageRef.current?.naturalHeight || 0;

  try {
    await generateThumbnail(savedPath, imageUuid, 300);
  } catch (error) {
    console.error('Failed to generate thumbnail for filtered image:', error);
  }

  if (replaceOriginal) {
    await localImageService.updateImage(ctx.image.uuid, {
      fileSize: filteredFile.size,
      updatedAt: new Date().toISOString(),
    });
  } else {
    const newImage: LocalImage = {
      uuid: imageUuid,
      filename: fileName,
      fileSize: filteredFile.size,
      format: format as any,
      width: imageWidth,
      height: imageHeight,
      hash: '',
      mimeType: filteredFile.type,
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
  filteredFile: File,
  format: 'png' | 'jpeg',
  replaceOriginal: boolean,
  fileName: string
) {
  if (replaceOriginal) {
    const result = await replaceImages([{
      uuid: ctx.image.uuid,
      file: filteredFile,
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
    const width = ctx.imageRef.current?.naturalWidth || 0;
    const height = ctx.imageRef.current?.naturalHeight || 0;

    const arrayBuffer = await filteredFile.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const presignedURLs = await requestPresignedURLs([{
      uuid: newUuid,
      filename: fileName,
      fileSize: filteredFile.size,
      format: imageFormat,
      width,
      height,
      hash,
      mimeType: filteredFile.type,
      isCorrupted: false,
    }] as any);

    if (!presignedURLs || presignedURLs.length === 0) {
      throw new Error('Failed to get presigned URLs');
    }

    const urls = presignedURLs[0];

    const thumbnailBlob = await generateThumbnailBlob(filteredFile, 300);
    const thumbnailSuccess = await uploadToPresignedURL(urls.thumbnailUrl, thumbnailBlob, true);

    if (!thumbnailSuccess) {
      throw new Error('Failed to upload thumbnail');
    }

    const imageSuccess = await uploadToPresignedURL(urls.imageUrl, filteredFile, false);

    if (!imageSuccess) {
      throw new Error('Failed to upload filtered image');
    }
  }
}

// Factory function to create filter tool with custom filters
export function createFilterTool(customFilters: ImageFilter[] = []): ImageEditorTool {
  const allFilters = [...builtInFilters, ...customFilters];

  return {
    id: TOOL_ID,
    icon: Filter,
    label: 'Filter',
    onActivate: (ctx) => {
      ctx.setToolState(TOOL_ID, {
        selectedFilterId: allFilters[0]?.id || null,
        filterParams: allFilters[0]?.defaultParams || {},
        isProcessing: false,
      });
      ctx.setActiveTool(TOOL_ID);
    },
    onDeactivate: (ctx) => {
      ctx.setToolState(TOOL_ID, {
        selectedFilterId: null,
        filterParams: {},
        isProcessing: false,
      });
    },
    renderModeControls: (ctx) => <FilterModeControls ctx={ctx} filters={allFilters} />,
    renderCanvas: (ctx) => <FilterCanvas ctx={ctx} filters={allFilters} />,
  };
}

// Default filter tool with built-in filters only
export const filterTool = createFilterTool();
