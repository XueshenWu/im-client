import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export default function HomeLink() {
  return (
    <Link
      to="/dashboard"
      className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium transition-colors"
    >
      <ChevronLeft className="h-4 w-4" />
      <span>Back to Dashboard</span>
    </Link>
  )
}
