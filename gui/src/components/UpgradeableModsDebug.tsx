import React from 'react';
import { useUpgradeableMods } from '../hooks/useQueries';

interface UpgradeableModsDebugProps {
  profileName: string;
}

export const UpgradeableModsDebug: React.FC<UpgradeableModsDebugProps> = ({ profileName }) => {
  const { data: upgradeableMods = [], isLoading, error } = useUpgradeableMods(profileName);

  return (
    <div className="bg-gray-800 p-4 rounded-lg mt-4">
      <h3 className="text-white font-bold mb-2">Upgradeable Mods Debug</h3>
      <div className="text-sm text-gray-300">
        <p>Profile: {profileName}</p>
        <p>Loading: {isLoading ? 'Yes' : 'No'}</p>
        <p>Error: {error ? String(error) : 'None'}</p>
        <p>Count: {upgradeableMods.length}</p>
        {upgradeableMods.length > 0 && (
          <div className="mt-2">
            <h4 className="font-semibold">Upgradeable Mods:</h4>
            <ul className="list-disc list-inside ml-4">
              {upgradeableMods.map((mod, index) => (
                <li key={index}>
                  {mod.name}: {mod.current_version} → {mod.latest_version}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};