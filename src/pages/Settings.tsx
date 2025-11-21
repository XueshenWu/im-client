import { useTranslation } from 'react-i18next'
import LanguageSwitcher from "@/components/common/LanguageSwitcher"


export default function Settings() {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-center h-full">
      <h1 className="text-2xl">{t('navigation.settings')}</h1>
      <LanguageSwitcher/>
    </div>
  )
}
