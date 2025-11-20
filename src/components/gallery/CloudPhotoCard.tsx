import React from 'react';
import { Loader2, Download, Eye, Trash2, Copy, CheckSquare } from 'lucide-react';
import type { ImageItem } from '@/types/gallery';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { imageService } from '@/services/api';
import { Checkbox } from '@/components/ui/checkbox';

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
  // Ensure this is a cloud image
  if (image.source !== 'cloud') {
    console.warn('CloudPhotoCard received non-cloud image');
    return null;
  }

  const cloudData = image.cloudData;
  const displayName = cloudData?.originalName || cloudData?.filename || 'Unknown';
  const fileSize = cloudData?.fileSize;

  const handleDownload = async () => {
    if (!cloudData?.uuid) return;

    try {
      const imageUrl = `${imageService.getImageFileUrl(cloudData.uuid)}?info=true`;
      const response = await fetch(imageUrl);

      if (!response.ok) {
        console.error('Download failed:', response.statusText);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = cloudData.originalName || 'image.jpg';
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
          {image.preview ? (
            <img
              src={image.preview}
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
              Select
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={handleCopyId}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Image ID
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default CloudPhotoCard;
