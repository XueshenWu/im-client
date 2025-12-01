import React from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import LocalPhotoWall from './LocalPhotoWall';
import CloudPhotoWall from './CloudPhotoWall';

interface HybridPhotoWallProps {
  columnWidth?: number;
  gap?: number;
}

const HybridPhotoWall: React.FC<HybridPhotoWallProps> = ({ columnWidth, gap }) => {
  const { sourceMode } = useSettingsStore();

  // Render appropriate component based on source mode
  if (sourceMode === 'local') {
    return <LocalPhotoWall columnWidth={columnWidth} gap={gap} />;
  }

  return <CloudPhotoWall columnWidth={columnWidth} gap={gap} />;
};

export default HybridPhotoWall;
