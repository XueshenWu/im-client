import { Home, Upload, Grid3x3, Settings, RefreshCw, Activity } from 'lucide-react'
import { useState } from 'react'

type NavItem = 'dashboard' | 'upload' | 'gallery' | 'sync' | 'activity' | 'settings'

interface NavigationProps {
  onNavigate?: (item: NavItem) => void
}

export default function Navigation({ onNavigate }: NavigationProps) {
  const [active, setActive] = useState<NavItem>('gallery')

  const handleNavigate = (item: NavItem) => {
    setActive(item)
    onNavigate?.(item)
  }

  const navItems = [
    { id: 'dashboard' as NavItem, icon: Home, label: 'Dashboard' },
    { id: 'upload' as NavItem, icon: Upload, label: 'Upload' },
    { id: 'gallery' as NavItem, icon: Grid3x3, label: 'Gallery' },
    { id: 'sync' as NavItem, icon: RefreshCw, label: 'Sync' },
    { id: 'activity' as NavItem, icon: Activity, label: 'Activity' },
    { id: 'settings' as NavItem, icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="w-24 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-8 gap-4">
      {/* Logo */}
      <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg">
        <span className="text-white font-bold text-xl">V</span>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 flex flex-col gap-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id

          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={item.label}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />

              {/* Tooltip */}
              <div className="absolute left-full ml-6 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                {item.label}
              </div>

              {/* Active Indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
              )}
            </button>
          )
        })}
      </nav>

      {/* User Avatar */}
      <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all group relative">
        <span className="text-gray-600 dark:text-gray-300 font-semibold text-base">U</span>

        {/* User Tooltip */}
        <div className="absolute left-full ml-6 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
          Profile
        </div>
      </div>
    </div>
  )
}
