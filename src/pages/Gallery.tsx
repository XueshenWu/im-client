import { useState } from "react";
import { useTranslation } from 'react-i18next'
import HybridPhotoWall from "@/components/gallery/HybridPhotoWall";
import HomeLink from '@/components/common/home-link'
import { ViewSwitch, type View } from "@/components/gallery/ViewSwitch";
import DetailList from "@/components/gallery/DetailList";


export default function Gallery() {
  const { t } = useTranslation()
  const [view, setView] = useState<View>("photowall");



  return (
    <div className='w-full flex flex-col px-6 py-6 h-full gap-6 bg-white'>
       {/* Header Section */}
            <div className='space-y-3 shrink-0'>
              <HomeLink />
              <div className='flex items-center justify-between gap-3'>

                <h1 className='text-4xl font-bold font-sans text-gray-900'>
                  {t('navigation.gallery')}
                </h1>

                <ViewSwitch onViewChange={setView} />
              </div>

            </div>

            {/* Divider */}
            <div className='border-t border-gray-300 shrink-0' />

          <div className='flex-1 min-h-0'>
            {
              view==='photowall'?<HybridPhotoWall />:<DetailList/>
            }
          </div>

    </div>
  )
}
