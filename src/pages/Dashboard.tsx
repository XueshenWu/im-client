import { useSettingsStore } from '@/stores/settingsStore';
import { ImageUploadChart } from '@/components/dashboard/ImageUploadChart';
import { ImageFormatPieChart } from '@/components/dashboard/ImageFormatPieChart';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { SyncStatus } from '@/components/dashboard/SyncStatus';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Dashboard() {
  const sourceMode = useSettingsStore((state) => state.sourceMode);

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 pb-6 w-full mx-auto bg-white dark:bg-gray-900">
        <div className='space-y-3 shrink-0'>

          <div className='flex items-center justify-between gap-3'>

            <h1 className='text-4xl font-bold font-sans text-gray-900 dark:text-gray-200'>
              {'Dashboard'}
            </h1>

          </div>

        </div>

        <StatsCards />

        <div className="w-full">
          <ImageUploadChart days={7} />
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 ">
          <ImageFormatPieChart />

          {sourceMode === 'local' ? (
            <SyncStatus />
          ) : (
            null
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
