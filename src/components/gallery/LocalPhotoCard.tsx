import React from 'react';
import { Loader2, Download, Eye, Trash2, Copy, CheckSquare, Edit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ImageWithSource } from '@/types/gallery';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { useImageViewerStore } from '@/stores/imageViewerStore';
import { useGalleryRefreshStore } from '@/stores/galleryRefreshStore';
import { localImageService } from '@/services/localImage.service';
import { getImageUrl, getThumbnailUrl } from '@/utils/imagePaths';
import { useTiffImageViewerStore } from '@/stores/tiffImageViewerStore';
import { useExifEditorStore } from '@/stores/exifEditorStore';


interface LocalPhotoCardProps {
  image: ImageWithSource;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (imageId: string) => void;
  onStartSelection?: (imageId: string) => void;
}

const LocalPhotoCard: React.FC<LocalPhotoCardProps> = ({
  image,
  selectionMode = false,
  isSelected = false,
  onSelect,
  onStartSelection
}) => {
  const { t } = useTranslation();
  const { openViewer } = useImageViewerStore();
  const { openTiffViewer } = useTiffImageViewerStore();
  const { triggerRefresh } = useGalleryRefreshStore();
  const { openEditor } = useExifEditorStore();

  // Ensure this is a local image
  if (image.source !== 'local') {
    console.warn('LocalPhotoCard received non-local image');
    return null;
  }

  const displayName = image.filename || 'Unknown';
  const fileSize = image.fileSize || 0;

  const handleDownload = async () => {
    if (!image.uuid || !image.format) return;

    try {
      // Construct the local-image URL and fetch it


      const buffer = await window.electronAPI?.loadLocalImage(image.uuid, image.format)
      if (!buffer) {
        throw "cannot read file"
      }
      const blob = new Blob([buffer as unknown as BlobPart], { type: image.mimeType });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = displayName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleCopyId = () => {
    if (image.uuid) {
      navigator.clipboard.writeText(image.uuid);
    }
  };



  const handleSelect = () => {
    if (!selectionMode && onStartSelection && image.uuid) {
      onStartSelection(image.uuid);
    } else if (selectionMode && onSelect && image.uuid) {
      onSelect(image.uuid);
    }
  };

  const handleCardDoubleClick = (e: React.MouseEvent) => {
    if (selectionMode && onSelect && image.uuid) {
      e.preventDefault();
      onSelect(image.uuid);
    } else if (!selectionMode) {
      // Open viewer when clicking the card (not in selection mode)
      openViewer({
        uuid: image.uuid || '',
        filename: image.filename || '',
        fileSize: image.fileSize || 0,
        format: image.format || '',
        width: image.width,
        height: image.height,
        source: 'local'
      } as any);
    }
  };

  const handleCardClick = async (e: React.MouseEvent) => {
    if (selectionMode && onSelect && image.uuid) {
      e.preventDefault();
      onSelect(image.uuid);
    } else if (!selectionMode) {
      // Open viewer when clicking the card (not in selection mode)
      if (image.format === 'tiff') {
        await openTiffViewer(image)
      } else {
        openViewer(image);
      }

    }
  };

  const handleViewDetails = () => {


    if (image.format === 'tiff') {
      openTiffViewer(image)
      return
    } else {

      openViewer(image);
    }
  
  };

  const handleEditExif = () => {
    if (!image) return;
    openEditor(image);
  };

  const handleDelete = async () => {
    if (!image.uuid) return;

    if (!window.confirm(t('viewer.confirmDelete'))) return;

    try {
      await localImageService.deleteImages([image.uuid]);
      triggerRefresh();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className="relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer bg-gray-100 group"
          style={{
            width: '100%',
            aspectRatio: image.aspectRatio || 1,
          }}
          onClick={handleCardClick}
        >
          {image.uuid ? (

            <img
              src={getThumbnailUrl(image.uuid)}
              alt={displayName}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
            />


          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          )}
          {/* TIFF page count indicator - shown for multi-page TIFF files */}
          {image.format === 'tiff' && image.pageCount && image.pageCount > 1 && (
            <div className="absolute bottom-1 right-1 z-10 bg-black/50 text-white text-xs font-semibold px-2 py-1 rounded backdrop-blur-sm">
              {image.pageCount}
            </div>
          )}



          {/* Checkbox overlay - shown when in selection mode */}
          {selectionMode && (
            <div className="absolute top-2 right-2 z-10">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect && image.uuid && onSelect(image.uuid)}
                className="bg-white border-2 border-gray-300"
              />
            </div>
          )}

          {/* Info overlay - shown on hover anywhere in the card */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-white text-sm font-medium truncate">{displayName}</p>
            <p className="text-white/80 text-xs">
              {fileSize > 1024 * 1024
                ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
                : `${(fileSize / 1024).toFixed(1)} KB`}
            </p>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {!selectionMode && (
          <>
            <ContextMenuItem onClick={handleSelect}>
              <CheckSquare className="mr-2 h-4 w-4" />
              {t('contextMenu.select')}
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={handleCopyId}>
          <Copy className="mr-2 h-4 w-4" />
          {t('contextMenu.copyId')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleViewDetails}>
          <Eye className="mr-2 h-4 w-4" />
          {t('contextMenu.viewDetails')}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleEditExif}>
          <Edit className="mr-2 h-4 w-4" />
          Edit EXIF
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          {t('contextMenu.download')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive" onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t('contextMenu.delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default LocalPhotoCard;
