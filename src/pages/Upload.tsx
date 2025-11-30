import { useTranslation } from 'react-i18next'
import FileList from '@/components/upload/filelistv2'
import HomeLink from '@/components/common/home-link'


export default function Upload() {
  const { t } = useTranslation()

  return (
    <div className='w-full flex flex-col px-6 py-6 h-full gap-6 bg-white dark:bg-gray-900'>
      {/* Header Section */}
      <div className='space-y-3'>
        <HomeLink />
        <div className='flex items-center gap-3'>

          <h1 className='text-4xl font-bold font-sans text-gray-900 dark:text-gray-200'>
            {t('pages.upload.title')}
          </h1>
        </div>

      </div>

      {/* Divider */}
      <div className='border-t border-gray-300 dark:border-gray-600' />

      {/* File List Section */}
      <div className='flex-1 min-h-0'>
        <FileList />
      </div>
    </div>
  )
}