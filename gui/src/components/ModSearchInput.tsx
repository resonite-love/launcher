import { useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ModSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ModSearchInput({ value, onChange }: ModSearchInputProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative mb-4">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('profiles.editPage.searchMods')}
        aria-label={t('profiles.editPage.searchMods')}
        className="input-primary w-full pr-10"
      />
      {value && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-resonite-blue"
          aria-label={t('profiles.editPage.clearModSearch')}
          title={t('profiles.editPage.clearModSearch')}
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
