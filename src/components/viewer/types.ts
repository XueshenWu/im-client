import type { LucideIcon } from 'lucide-react';
import type { ImageWithSource } from '@/types/gallery';

// Tool context passed to all tool functions
export interface ToolContext {
  image: ImageWithSource;
  imageRef: React.RefObject<HTMLImageElement | null>;
  imageUrl: string;
  isLocalImage: boolean;
  // State management
  activeToolId: string | null;
  setActiveTool: (toolId: string | null) => void;
  toolState: Record<string, any>;
  setToolState: (toolId: string, state: any) => void;
  getToolState: <T>(toolId: string) => T | undefined;
  // Actions
  closeViewer: () => void;
  triggerRefresh: () => void;
}

// Tool definition interface
export interface ImageEditorTool {
  id: string;
  icon: LucideIcon;
  label: string;
  // Optional: control when tool is available
  isAvailable?: (ctx: ToolContext) => boolean;
  // Called when tool button is clicked
  onActivate: (ctx: ToolContext) => void;
  // Called when tool is deactivated (e.g., cancel button clicked)
  onDeactivate?: (ctx: ToolContext) => void;
  // Render toolbar controls when this tool is active
  renderModeControls?: (ctx: ToolContext) => React.ReactNode;
  // Render canvas overlay/wrapper when this tool is active
  renderCanvas?: (ctx: ToolContext) => React.ReactNode;
}

// Filter parameter configuration for adjustable filters
export interface FilterParamConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

// Filter definition interface
export interface ImageFilter {
  id: string;
  label: string;
  icon?: LucideIcon;
  // Apply filter using CSS filter string (e.g., 'grayscale(100%)')
  cssFilter?: (params?: Record<string, number>) => string;
  // Or apply filter using canvas manipulation for complex filters
  applyToCanvas?: (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    params?: Record<string, number>
  ) => void;
  // Default parameter values
  defaultParams?: Record<string, number>;
  // Configuration for adjustable parameters (renders sliders)
  paramConfig?: FilterParamConfig[];
}

// Filter tool state
export interface FilterToolState {
  selectedFilterId: string | null;
  filterParams: Record<string, number>;
  isProcessing: boolean;
}

// Crop tool state
export interface CropToolState {
  crop?: { x: number; y: number; width: number; height: number; unit: '%' | 'px' };
  completedCrop?: { x: number; y: number; width: number; height: number };
  isProcessing: boolean;
}
