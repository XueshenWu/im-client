import { useTranslation } from 'react-i18next'
import LanguageSwitcher from "@/components/common/LanguageSwitcher"
import ThemeSwitcher from "@/components/common/ThemeSwitcher"
import SourceModeSettings from "@/components/settings/SourceModeSettings"
import { Separator } from "@/components/ui/separator"
import HomeLink from '@/components/common/home-link'


export default function Settings() {
  const { t } = useTranslation()

  return (
    <div className="h-full w-full overflow-y-auto bg-white dark:bg-gray-900">
      <div className="p-6 space-y-6 w-full">
        <div className='space-y-3 shrink-0'>
          <HomeLink />
          <div className='flex items-center justify-between gap-3'>

            <h1 className='text-4xl font-bold font-sans text-gray-900 dark:text-gray-200'>
              {t('navigation.settings')}
            </h1>

           
          </div>

        </div>


        <Separator />

        {/* Source Mode Settings */}
        <section>
          <SourceModeSettings />
        </section>

        <Separator />

        {/* Theme Settings */}
        <section>
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-200">{t('settings.theme', 'Theme')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t('settings.themeDescription', 'Customize your own theme pages')}
              </p>
            </div>
            <ThemeSwitcher />
          </div>
        </section>

        <Separator />

        {/* Language Settings */}
        <section>
          <div className=" flex items-center justify-start gap-x-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-200">{t('settings.language', 'Language')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t('settings.languageDescription', 'Choose your preferred language')}
              </p>
            </div>
            <LanguageSwitcher />
          </div>
        </section>
      </div>
    </div>
  )
}
