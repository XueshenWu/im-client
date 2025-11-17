import Navigation from './Navigation'
import MainContent from './MainContent'

export default function AppLayout() {
  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Left Navigation */}
      <Navigation />

      {/* Main Content Area */}
      <MainContent />
    </div>
  )
}
