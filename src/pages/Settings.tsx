import { useTranslation } from 'react-i18next'
import LanguageSwitcher from "@/components/common/LanguageSwitcher"
import SourceModeSettings from "@/components/settings/SourceModeSettings"
import { Separator } from "@/components/ui/separator"


export default function Settings() {
  const { t } = useTranslation()

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('navigation.settings')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('settings.description', 'Manage your application preferences and sync settings')}
          </p>
        </div>

        <Separator />

        {/* Source Mode Settings */}
        <section>
          <SourceModeSettings />
        </section>

        <Separator />

        {/* Language Settings */}
        <section>
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{t('settings.language', 'Language')}</h2>
              <p className="text-sm text-muted-foreground">
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
