import { useState } from 'react'
import { ChevronUp, ChevronDown, Activity, Trash2 } from 'lucide-react'
import type { ActivityLog } from '../../types'

export default function BottomPanel() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [logs, setLogs] = useState<ActivityLog[]>([
    {
      id: '1',
      timestamp: new Date().toISOString(),
      category: 'action',
      message: 'Application started'
    }
  ])

  const getCategoryColor = (category: ActivityLog['category']) => {
    switch (category) {
      case 'upload': return 'text-blue-600 dark:text-blue-400'
      case 'sync': return 'text-green-600 dark:text-green-400'
      case 'action': return 'text-gray-600 dark:text-gray-400'
      case 'error': return 'text-red-600 dark:text-red-400'
      case 'warning': return 'text-yellow-600 dark:text-yellow-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div className={`border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 transition-all duration-300 ${
      isExpanded ? 'h-48' : 'h-12'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Activity Log
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({logs.length} {logs.length === 1 ? 'entry' : 'entries'})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearLogs}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Log Content */}
      {isExpanded && (
        <div className="h-[calc(100%-3rem)] overflow-y-auto p-3 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-center py-8">
              No activity logs yet
            </p>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3">
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">
                    {formatTime(log.timestamp)}
                  </span>
                  <span className={`font-semibold uppercase shrink-0 ${getCategoryColor(log.category)}`}>
                    [{log.category}]
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
