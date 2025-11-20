import React, { useState } from 'react';
import { Cloud, HardDrive } from 'lucide-react';
import type { ImageSource } from '@/types/gallery';
import CloudPhotoWall from './CloudPhotoWall';
import LocalPhotoWall from './LocalPhotoWall';

interface PhotoWallProps {
  columnWidth?: number;
  gap?: number;
}

const PhotoWall: React.FC<PhotoWallProps> = ({ columnWidth = 250, gap = 12 }) => {
  const [source, setSource] = useState<ImageSource>('cloud');

  return (
    <div className="h-full w-full flex flex-col">
      {/* Source Toggle Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setSource('local')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              source === 'local'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Local</span>
          </button>
          <button
            onClick={() => setSource('cloud')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              source === 'cloud'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Cloud</span>
          </button>
        </div>
      </div>

      {/* Render appropriate photo wall based on source */}
      <div className="flex-1 overflow-hidden">
        {source === 'cloud' ? (
          <CloudPhotoWall columnWidth={columnWidth} gap={gap} />
        ) : (
          <LocalPhotoWall columnWidth={columnWidth} gap={gap} />
        )}
      </div>
    </div>
  );
};

export default PhotoWall;
