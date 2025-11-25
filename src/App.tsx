import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Gallery from './pages/Gallery'
import Sync from './pages/Sync'
import Activity from './pages/Activity'
import Settings from './pages/Settings'
import { ImageViewer } from './components/viewer/ImageViewer'

function App() {
  // Initialize database on app startup
  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        const result = await window.electronAPI?.db.initialize();
        if (result?.success) {
          console.log('[App] Local database initialized successfully');
        } else {
          console.error('[App] Failed to initialize local database:', result?.error);
        }
      } catch (error) {
        console.error('[App] Database initialization error:', error);
      }
    };

    initializeDatabase();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/gallery" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="upload" element={<Upload />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="sync" element={<Sync />} />
          {/* <Route path="activity" element={<Activity />} /> */}
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <ImageViewer />
    </BrowserRouter>
  )
}

export default App
