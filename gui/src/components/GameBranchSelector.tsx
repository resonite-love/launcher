import { useEffect, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/tauri';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SteamBranch {
  name: string;
  description: string;
  password_required: boolean;
}

interface GameBranchSelectorProps {
  value: string;
  onChange: (branch: string) => void;
  disabled?: boolean;
  onValidityChange?: (valid: boolean) => void;
}

const fallbackBranches: SteamBranch[] = ['release', 'prerelease'].map(name => ({
  name, description: '', password_required: false,
}));

export default function GameBranchSelector({ value, onChange, disabled, onValidityChange }: GameBranchSelectorProps) {
  const { t } = useTranslation();
  const id = useId();
  const isOther = value !== 'release';
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['gameBranches'],
    queryFn: () => invoke<SteamBranch[]>('get_game_branches'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: isOther,
  });
  const branches = data ?? fallbackBranches;
  const selected = branches.find(branch => branch.name === value);
  const valid = !isOther || (!!value && !selected?.password_required);

  useEffect(() => { onValidityChange?.(valid); }, [valid, onValidityChange]);

  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-sm font-medium text-gray-300">{t('common.branch')}</legend>
      <div className="flex flex-wrap gap-4 text-sm text-gray-300">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name={id} value="release" checked={!isOther}
            onChange={() => onChange('release')} className="accent-resonite-blue" />
          {t('gameBranch.release')}
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name={id} value="other" checked={isOther}
            onChange={() => onChange('')} className="accent-resonite-blue" />
          {t('gameBranch.other')}
        </label>
      </div>
      {isOther && <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-sm font-medium text-gray-300">{t('gameBranch.otherSelection')}</label>
          <button type="button" onClick={() => void refetch()} disabled={disabled || isFetching}
            className="text-gray-400 hover:text-white disabled:opacity-50"
            title={t('gameBranch.refresh')} aria-label={t('gameBranch.refresh')}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <select id={id} value={value} onChange={event => onChange(event.target.value)}
          disabled={disabled} className="select-primary w-full text-sm">
          <option value="" disabled>{t('gameBranch.selectBranch')}</option>
          {value && !selected && <option value={value}>{value}</option>}
          {branches.filter(branch => branch.name !== 'release').map(branch => (
            <option key={branch.name} value={branch.name} disabled={branch.password_required}>
              {branch.name}{branch.password_required ? ` (${t('gameBranch.passwordRequired')})` : ''}
            </option>
          ))}
        </select>
        {selected?.description && <p className="text-xs text-gray-400">{selected.description}</p>}
        {isFetching && <p role="status" className="text-xs text-gray-400">{t('gameBranch.loading')}</p>}
        {isError && <p role="alert" className="text-xs text-yellow-400">{t('gameBranch.fetchFailed')}</p>}
        {selected?.password_required && <p role="alert" className="text-xs text-yellow-400">{t('gameBranch.passwordRequired')}</p>}
      </div>}
    </fieldset>
  );
}
