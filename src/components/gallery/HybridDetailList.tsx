import React from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import DetailList from './DetailList';
import LocalDetailList from './LocalDetailList';

/**
 * HybridDetailList - Switches between cloud and local detail list based on source mode
 */
const HybridDetailList: React.FC = () => {
  const { sourceMode } = useSettingsStore();

  if (sourceMode === 'local') {
    return <LocalDetailList />;
  }

  return <DetailList />;
};

export default HybridDetailList;
