import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface RmlVersion {
  version: string;
  prerelease: boolean;
  installable: boolean;
}

interface Props {
  currentVersion?: string;
  isChanging: boolean;
  onClose: () => void;
  onVersionSelect: (version: string) => Promise<void>;
}

export default function RmlVersionModal({ currentVersion, isChanging, onClose, onVersionSelect }: Props) {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<RmlVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setVersions([]);
    setSelectedVersion('');
    void invoke<RmlVersion[]>('get_resonite_mod_loader_versions')
      .then(result => { if (!cancelled) setVersions(result); })
      .catch(err => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isChanging) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isChanging, onClose]);

  const canChange = !isLoading && !isChanging && versions.some(v => v.version === selectedVersion && v.installable);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[70]"
      onClick={() => { if (!isChanging) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="rml-version-title"
        className="bg-dark-900 border border-dark-600 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-5"
        onClick={event => event.stopPropagation()}
        onSubmit={event => { event.preventDefault(); if (canChange) void onVersionSelect(selectedVersion); }}>
        <div className="flex items-center justify-between gap-3">
          <h3 id="rml-version-title" className="text-xl font-bold text-white">{t('profiles.editPage.changeRmlVersion')}</h3>
          <button type="button" onClick={onClose} disabled={isChanging} aria-label={t('common.close')}
            className="text-gray-400 hover:text-white disabled:opacity-50"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-300">
          {t('profiles.editPage.rmlCurrentVersion', { version: currentVersion || t('profiles.editPage.unknown') })}
        </p>
        {isLoading ? (
          <p className="flex items-center gap-2 text-gray-300" role="status"><Loader2 className="w-4 h-4 animate-spin" />{t('common.loading')}</p>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-red-400 text-sm break-words" role="alert">{t('profiles.editPage.rmlVersionsFailed', { message: error })}</p>
            <button type="button" className="btn-secondary" onClick={() => setRetry(value => value + 1)}>{t('common.retry')}</button>
          </div>
        ) : versions.length === 0 ? (
          <p className="text-gray-400 text-sm">{t('profiles.editPage.rmlNoVersions')}</p>
        ) : (
          <div className="space-y-2">
            <label htmlFor="rml-version" className="block text-sm text-gray-300">{t('profiles.editPage.rmlSelectVersion')}</label>
            <select id="rml-version" autoFocus className="select-primary w-full" value={selectedVersion}
              disabled={isChanging} onChange={event => setSelectedVersion(event.target.value)}>
              <option value="" disabled>{t('profiles.editPage.rmlSelectVersion')}</option>
              {versions.map(release => (
                <option key={release.version} value={release.version} disabled={!release.installable}>
                  {release.version}
                  {release.version === currentVersion ? ` (${t('modLoader.versionSelector.installed')})` : ''}
                  {release.prerelease ? ` (${t('modLoader.versionSelector.prerelease')})` : ''}
                  {!release.installable ? ` (${t('profiles.editPage.rmlMissingAssets')})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="text-xs text-gray-400">{t('profiles.editPage.rmlVersionChangeHint')}</p>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isChanging}>{t('common.cancel')}</button>
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={!canChange}>
            {isChanging && <Loader2 className="w-4 h-4 animate-spin" />}
            {t(isChanging ? 'profiles.editPage.rmlVersionChanging' : 'profiles.editPage.rmlApplyVersion')}
          </button>
        </div>
      </form>
    </div>
  );
}
