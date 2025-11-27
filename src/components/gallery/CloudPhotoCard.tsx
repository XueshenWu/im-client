import React from 'react';
import { Loader2, Download, Eye, Trash2, Copy, CheckSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ImageItem } from '@/types/gallery';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { imageService } from '@/services/api';
import { deleteImage } from '@/services/images.service';
import { Checkbox } from '@/components/ui/checkbox';
import { useImageViewerStore } from '@/stores/imageViewerStore';
import { useGalleryRefreshStore } from '@/stores/galleryRefreshStore';
import { getCloudImagePresignedUrlEndpoint, getCloudThumbnailUrl } from '@/utils/imagePaths';

interface CloudPhotoCardProps {
  image: ImageItem;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (imageId: string) => void;
  onStartSelection?: (imageId: string) => void;
}

const CloudPhotoCard: React.FC<CloudPhotoCardProps> = ({
  image,
  selectionMode = false,
  isSelected = false,
  onSelect,
  onStartSelection
}) => {
  const { t } = useTranslation();
  const { openViewer } = useImageViewerStore();
  const { triggerRefresh } = useGalleryRefreshStore();
  // Ensure this is a cloud image
  if (image.source !== 'cloud') {
    console.warn('CloudPhotoCard received non-cloud image');
    return null;
  }

  const cloudData = image.cloudData;
  const displayName = cloudData?.filename || 'Unknown';
  const fileSize = cloudData?.fileSize;

  const handleDownload = async () => {
    if (!cloudData?.uuid) return;

    try {
      debugger

      const endpoint = getCloudImagePresignedUrlEndpoint(cloudData.uuid);
      let response = await fetch(endpoint);

      if (!response.ok) {
        console.error('Download failed:', response.statusText);
        return;
      }

      const data = await response.json();
      if (!data.success || !data.data.presignedUrl) {
        alert('Invalid presigned URL response');
        return;
      }
      const presignedUrl = data.data.presignedUrl;
      response = await fetch(presignedUrl);


      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = cloudData.filename || 'image.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleCopyId = () => {
    if (cloudData?.uuid) {
      navigator.clipboard.writeText(cloudData.uuid);
    }
  };

  const handleSelect = () => {
    if (!selectionMode && onStartSelection && image.id) {
      onStartSelection(image.id);
    } else if (selectionMode && onSelect && image.id) {
      onSelect(image.id);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && onSelect && image.id) {
      e.preventDefault();
      onSelect(image.id);
    } else if (!selectionMode && cloudData) {
      // Open viewer when clicking the card (not in selection mode)
      openViewer(cloudData);
    }
  };

  const handleViewDetails = () => {
    if (cloudData) {
      openViewer(cloudData);
    }
  };

  const handleDelete = async () => {
    if (!cloudData?.id) return;

    if (!window.confirm(t('viewer.confirmDelete'))) return;

    try {
      await deleteImage(cloudData.id);
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
          {cloudData?.uuid ? (
            <img
              src={getCloudThumbnailUrl(cloudData.uuid, cloudData.format)}
              alt={displayName}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          )}

          {/* Checkbox overlay - shown when in selection mode */}
          {selectionMode && (
            <div className="absolute top-2 right-2 z-10">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect && image.id && onSelect(image.id)}
                className="bg-white border-2 border-gray-300"
              />
            </div>
          )}

          {/* Info overlay - shown on hover anywhere in the card */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-white text-sm font-medium truncate">{displayName}</p>
            {fileSize && (
              <p className="text-white/80 text-xs">
                {fileSize > 1024 * 1024
                  ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
                  : `${(fileSize / 1024).toFixed(1)} KB`}
              </p>
            )}
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

export default CloudPhotoCard;
