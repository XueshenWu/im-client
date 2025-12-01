import { Outlet } from 'react-router-dom'
import Navigation from './Navigation'
import TitleBar from './TitleBar'

export default function AppLayout() {
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <TitleBar />

      <div className="flex-1 flex overflow-hidden">
        <Navigation />

        <Outlet />
      </div>
    </div>
  )
}
