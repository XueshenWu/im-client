import FileList from '@/components/upload/filelistv2'
import HomeLink from '@/components/common/home-link'


export default function () {
  return (
    <div className='w-full flex flex-col px-6 py-6 h-full gap-6'>
      {/* Header Section */}
      <div className='space-y-3'>
        <HomeLink />
        <div className='flex items-center gap-3'>

          <h1 className='text-4xl font-bold font-sans text-gray-900'>
            File Upload
          </h1>
        </div>

      </div>

      {/* Divider */}
      <div className='border-t border-gray-300' />

      {/* File List Section */}
      <div className='flex-1 min-h-0'>
        <FileList />
      </div>
    </div>
  )
}