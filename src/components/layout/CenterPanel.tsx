import { useState } from 'react'
import { Grid3x3, Filter, Download, Trash2 } from 'lucide-react'

export default function CenterPanel() {
  const [selectedCount, setSelectedCount] = useState(0)
  const [filterType, setFilterType] = useState<string>('all')

  return (
    <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-800">
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="jpg">JPG</option>
                <option value="png">PNG</option>
                <option value="tif">TIF</option>
              </select>
            </div>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selectedCount > 0 ? (
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {selectedCount} selected
                </span>
              ) : (
                <span>0 images</span>
              )}
            </div>
          </div>

          {selectedCount > 0 && (
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full mb-4">
            <Grid3x3 className="w-10 h-10 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Images Yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Upload images using the sidebar to get started. Supported formats: JPG, PNG, TIF (up to 4K resolution)
          </p>
        </div>
      </div>
    </div>
  )
}
