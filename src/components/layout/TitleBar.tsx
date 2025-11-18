import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow()
  }

  const handleMaximize = () => {
    window.electronAPI?.maximizeWindow()
  }

  const handleClose = () => {
    window.electronAPI?.closeWindow()
  }

  return (
    <div
      className="h-12 bg-blue-700 dark:bg-blue-900 flex items-center justify-between select-none"
      style={{
        WebkitAppRegion: 'drag',
        paddingLeft: '16px',
        paddingRight: '16px'
      } as React.CSSProperties}
    >
      {/* Left side - Logo and Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
          <span className="text-blue-700 font-bold text-sm">V</span>
        </div>
        <span className="text-white font-semibold text-sm">Voyis Image Editor</span>
      </div>

      {/* Right side - Window Controls */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-colors rounded"
          title="Minimize"
        >
          <Minus className="w-4 h-4 text-white" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-colors rounded"
          title="Maximize"
        >
          <Square className="w-3.5 h-3.5 text-white" />
        </button>
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center hover:bg-red-600 transition-colors rounded"
          title="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  )
}
