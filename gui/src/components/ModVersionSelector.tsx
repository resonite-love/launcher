import React, { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ModRelease {
  version: string;
  download_url?: string;
  release_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  changelog?: string;
  file_name?: string;
  file_size?: number;
}

interface InstalledMod {
  name: string;
  description: string;
  source_location: string;
  installed_version: string;
  installed_date: string;
  dll_path: string;
}

interface ModVersionSelectorProps {
  mod: InstalledMod;
  availableVersions: ModRelease[];
  onVersionSelect: (version: string) => void;
  isLoading?: boolean;
}

export const ModVersionSelector: React.FC<ModVersionSelectorProps> = ({
  mod,
  availableVersions,
  onVersionSelect,
  isLoading = false
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(mod.installed_version);

  const handleVersionSelect = (version: string) => {
    setSelectedVersion(version);
    onVersionSelect(version);
    setIsOpen(false);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('ja-JP');
    } catch {
      return dateString;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb > 1 ? `${mb.toFixed(1)}MB` : `${(bytes / 1024).toFixed(0)}KB`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || availableVersions.length === 0}
        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 
                   disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed
                   rounded-md border border-gray-600 text-sm transition-colors w-full"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <span>{selectedVersion || t('modLoader.versionSelector.selectVersion')}</span>
        )}
        {availableVersions.length > 0 && (
          <ChevronDown 
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          />
        )}
      </button>

      {isOpen && availableVersions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 
                        rounded-md shadow-lg z-[70] min-w-80 max-h-96 overflow-y-auto">
          <div className="p-2 border-b border-gray-600">
            <h4 className="text-sm font-medium text-gray-300">
              {t('modLoader.versionSelector.title', { modName: mod.name })}
            </h4>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {availableVersions.map((release) => (
              <button
                key={release.version}
                onClick={() => handleVersionSelect(release.version)}
                className={`w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors
                           border-b border-gray-700 last:border-b-0 
                           ${release.version === mod.installed_version 
                             ? 'bg-blue-900/30 text-blue-300' 
                             : 'text-gray-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{release.version}</span>
                    {release.version === mod.installed_version && (
                      <span className="text-xs bg-blue-600 px-2 py-0.5 rounded">
                        {t('modLoader.versionSelector.installed')}
                      </span>
                    )}
                    {release.prerelease && (
                      <span className="text-xs bg-yellow-600 px-2 py-0.5 rounded">
                        {t('modLoader.versionSelector.prerelease')}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(release.published_at)}
                  </span>
                </div>
                
                {release.changelog && (
                  <div className="mt-1 text-xs text-gray-400 line-clamp-2">
                    {release.changelog}
                  </div>
                )}
                
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  {release.file_name && (
                    <span>{release.file_name}</span>
                  )}
                  {release.file_size && (
                    <span>({formatFileSize(release.file_size)})</span>
                  )}
                </div>
              </button>
            ))}
          </div>
          
          {availableVersions.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              {t('modLoader.versionSelector.noVersions')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};