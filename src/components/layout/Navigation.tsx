import { Home, Upload, Grid3x3, Settings, RefreshCw, Activity } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type NavItem = 'dashboard' | 'upload' | 'gallery' | 'sync' | 'activity' | 'settings'

export default function Navigation() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [active, setActive] = useState<NavItem>('gallery')
  const [isExpanded, setIsExpanded] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkWidth = () => {
      if (navRef.current) {
        const parentWidth = navRef.current.parentElement?.clientWidth || 0
        setIsExpanded(parentWidth > 1200)
      }
    }

    checkWidth()
    const resizeObserver = new ResizeObserver(checkWidth)

    if (navRef.current?.parentElement) {
      resizeObserver.observe(navRef.current.parentElement)
    }

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    const path = location.pathname.slice(1) as NavItem
    if (path) {
      setActive(path)
    }
  }, [location])

  const handleNavigate = (item: NavItem) => {
    setActive(item)
    navigate(`/${item}`)
  }

  const navItems = [
    { id: 'dashboard' as NavItem, icon: Home, labelKey: 'navigation.dashboard' },
    { id: 'upload' as NavItem, icon: Upload, labelKey: 'navigation.upload' },
    { id: 'gallery' as NavItem, icon: Grid3x3, labelKey: 'navigation.gallery' },
    { id: 'sync' as NavItem, icon: RefreshCw, labelKey: 'navigation.sync' },
    // { id: 'activity' as NavItem, icon: Activity, labelKey: 'navigation.activity' },
  ]

  return (
    <div
      ref={navRef}
      className={`${isExpanded ? 'min-w-36 max-w-44 items-start' : 'w-16 items-center'} bg-slate-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col  gap-y-4 transition-all duration-300`}
      style={{ paddingTop: '24px', paddingBottom: '24px', paddingLeft: isExpanded ? '12px' : '12px', paddingRight: isExpanded ? '12px' : '12px' }}
    >
      {/* Logo */}
      <div className={`${isExpanded ? 'w-full flex items-center gap-3 px-3' : 'w-12 h-12'} mb-8 transition-all duration-300`}>
        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
          <span className="text-white font-bold text-lg">I</span>
        </div>
        {isExpanded && (
          <span className="text-gray-900 dark:text-white font-semibold text-xs whitespace-nowrap overflow-hidden">
            Editor
          </span>
        )}
      </div>

      {/* Navigation Items */}
      <div className="flex-1 flex flex-col items-center gap-2 w-full">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id

          return (
            <Button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              variant="ghost"
              
              // size={isExpanded ? "default" : "icon"}

              className={cn(
                'relative h-12 rounded-2xl transition-all duration-200 cursor-pointer ',
                isExpanded ? 'w-full justify-start ' : 'w-12 flex items-center justify-center',
                isActive
                  ? 'bg-linear-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-800'
              )}
              style={{ paddingLeft: isExpanded ? '12px' : undefined}}
              title={!isExpanded ? t(item.labelKey) : undefined}
            >


              <Icon className={cn('flex-shrink-0', isActive ? 'text-white' : 'text-gray-600 dark:text-gray-400')} />

              {isExpanded && (
                <span className={cn(' text-xs whitespace-nowrap', isActive ? 'text-white' : 'text-gray-700 dark:text-gray-300')}>
                  {t(item.labelKey)}
                </span>
              )}

              {/* Tooltip - only show when collapsed */}
              {!isExpanded && (
                <div className="absolute left-full ml-6 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                  {t(item.labelKey)}
                </div>
              )}



            </Button>
          )
        })}
      </div>

      {/* Settings at Bottom */}
      <Button
        onClick={() => handleNavigate('settings')}
        variant="ghost"
        className={cn(
          'relative h-12 rounded-2xl transition-all duration-200 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800',
          isExpanded ? 'w-full justify-start' : 'w-12'
        )}
        style={{ paddingLeft: isExpanded ? '12px' : '12px', paddingRight: isExpanded ? '12px' : '12px' }}
        title={!isExpanded ? t('navigation.settings') : undefined}
      >
        <Settings className={cn('flex-shrink-0', 'text-gray-600 dark:text-gray-400')} />

        {isExpanded && (
          <span className={cn('text-xs font-medium whitespace-nowrap', 'text-gray-700 dark:text-gray-300')}>
            {t('navigation.settings')}
          </span>
        )}

        {!isExpanded && (
          <div className="absolute left-full ml-6 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
            {t('navigation.settings')}
          </div>
        )}
      </Button>
    </div>
  )
}
