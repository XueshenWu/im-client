import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ImageItem } from '@/types/gallery';

interface CloudPhotoCardProps {
  image: ImageItem;
}

const CloudPhotoCard: React.FC<CloudPhotoCardProps> = ({ image }) => {
  // Ensure this is a cloud image
  if (image.source !== 'cloud') {
    console.warn('CloudPhotoCard received non-cloud image');
    return null;
  }

  const cloudData = image.cloudData;
  const displayName = cloudData?.originalName || cloudData?.filename || 'Unknown';
  const fileSize = cloudData?.fileSize;

  return (
    <div
      className="relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer bg-gray-100"
      style={{
        width: '100%',
        aspectRatio: image.aspectRatio || 1,
      }}
    >
      {image.preview ? (
        <img
          src={image.preview}
          alt={displayName}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-200">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 hover:opacity-100 transition-opacity">
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
  );
};

export default CloudPhotoCard;
