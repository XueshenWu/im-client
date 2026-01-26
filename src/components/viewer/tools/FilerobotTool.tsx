import React from 'react';
import { Wand2 } from 'lucide-react';
import { useImageViewerFilerobotStore } from '@/stores/imageViewerFilerobotStore';
import type { ImageEditorTool } from '../types';

const TOOL_ID = 'filerobot';

// Tool that opens the Filerobot advanced editor
export const filerobotTool: ImageEditorTool = {
  id: TOOL_ID,
  icon: Wand2,
  label: 'Advanced Editor',
  onActivate: (ctx) => {
    // Open Filerobot editor with the current image
    const { openEditor } = useImageViewerFilerobotStore.getState();
    openEditor(ctx.image);

    // Close the basic viewer since Filerobot takes over
    ctx.closeViewer();
  },
};
