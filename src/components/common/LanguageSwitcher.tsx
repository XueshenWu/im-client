import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Languages } from 'lucide-react';
import { useLanguageStore } from '@/stores/languageStore';

const LanguageSwitcher: React.FC = () => {
  const { language, changeLanguage } = useLanguageStore();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' }
  ];

  const handleLanguageChange = (languageCode: string) => {
    changeLanguage(languageCode);
  };

  return (
    <div className="flex items-center gap-2">
      <Languages className="h-4 w-4 text-gray-600 dark:text-gray-400" />
      <Select value={language} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[140px] ring-gray-300 dark:ring-gray-600 border-gray-100 dark:border-gray-700 border-2 cursor-pointer bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem className='cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' key={lang.code} value={lang.code}>
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSwitcher;