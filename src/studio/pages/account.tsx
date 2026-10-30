import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { signalAccentStorageKey } from '../../constants/library';
import { Button } from '../../ui/button';
import { ListRow } from '../../ui/list-row';
import { Segmented } from '../../ui/segmented';
import { SettingsGroup } from '../../ui/settings-group';
import { StatusMessage } from '../../ui/status-message';
import { version } from '../../../package.json';
import { applySignalAccent, currentSignalAccent, type SignalAccent } from '../accent';
import { browserLocalStorage, type BrowserStorage } from '../browser-storage';
import { applyTheme, currentTheme, subscribeToTheme, type StudioTheme } from '../theme';
import { clearLocalStorageKeys, clearTerrainTileCache } from './clear-local-data';

type ClearState = 'idle' | 'confirming' | 'cleared' | 'failed';

const themeOptions = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
] as const;
const accentOptions = [
  { value: 'bone', label: 'Bone' },
  { value: 'amber', label: 'Amber' },
  { value: 'phosphor', label: 'Phosphor' },
] as const;

/**
 * Account / Settings page. Local only: there is no sign-in. The Theme row reads and writes the shared
 * store in `../theme.ts`, so any other theme control (the footer toggle) stays in step.
 */
export function AccountPage({
  isActive,
  storage = browserLocalStorage,
}: {
  isActive: boolean;
  storage?: BrowserStorage;
}): ReactNode {
  const theme = useSyncExternalStore(subscribeToTheme, readCurrentTheme);
  const [accent, setAccent] = useState<SignalAccent>(() =>
    currentSignalAccent(document.documentElement),
  );
  const [clearState, setClearState] = useState<ClearState>('idle');

  const clearLocalData = async (): Promise<void> => {
    const result = clearLocalStorageKeys(storage);

    await clearTerrainTileCache('caches' in globalThis ? caches : undefined);

    if (!result.ok) {
      setClearState('failed');

      return;
    }

    applyTheme('dark', document.documentElement, storage);
    applySignalAccent('bone', document.documentElement, storage, signalAccentStorageKey);
    setAccent('bone');
    setClearState('cleared');
  };

  return (
    <section className="studio-page" aria-label="Account" hidden={!isActive}>
      <header className="studio-page__header">
        <h1 className="studio-page__title">Account</h1>
      </header>
      <SettingsGroup title="Appearance" code="SET.01">
        <Segmented
          label="Theme"
          value={theme}
          options={themeOptions}
          onChange={(next) => {
            applyTheme(next, document.documentElement, storage);
          }}
        />
        <Segmented
          label="Signal accent"
          value={accent}
          options={accentOptions}
          onChange={(next) => {
            applySignalAccent(next, document.documentElement, storage, signalAccentStorageKey);
            setAccent(next);
          }}
        />
      </SettingsGroup>
      <SettingsGroup title="Storage" code="SET.02">
        {clearState === 'confirming' ? (
          <div className="studio-page__confirm">
            <p className="studio-page__confirm-text">
              This removes saved designs, searched places, the locked seed and preferences from this
              browser, plus downloaded terrain tiles.
            </p>
            <div className="studio-page__confirm-actions">
              <Button
                variant="primary"
                size="large"
                onClick={() => {
                  void clearLocalData();
                }}
              >
                Confirm clear
              </Button>
              <Button
                variant="secondary"
                size="large"
                onClick={() => {
                  setClearState('idle');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <ListRow
            title="Clear local storage"
            detail="Saved designs, places, preferences"
            leading="○"
            onClick={() => {
              setClearState('confirming');
            }}
          />
        )}
        {clearState === 'cleared' && (
          <StatusMessage kind="ok">Local storage cleared.</StatusMessage>
        )}
        {clearState === 'failed' && (
          <StatusMessage kind="fault" isAlert>
            Browser storage is unavailable, so nothing was cleared. Check site data settings.
          </StatusMessage>
        )}
      </SettingsGroup>
      <SettingsGroup title="Sources" code="SET.03">
        <ListRow
          title="Terrarium elevation"
          detail="Mapzen terrain tiles · AWS open data"
          href="https://registry.opendata.aws/terrain-tiles/"
        />
        <ListRow
          title="Copernicus EU-DEM"
          detail="Funded by the European Union"
          href="https://land.copernicus.eu/imagery-in-situ/eu-dem"
        />
        <ListRow
          title="OpenStreetMap roads"
          detail="© OpenStreetMap contributors"
          meta="ODbL"
          href="https://www.openstreetmap.org/copyright"
        />
      </SettingsGroup>
      <SettingsGroup title="About" code="SET.04">
        <ListRow title="LANDCU.BE Studio" detail="landcube" meta={version} />
      </SettingsGroup>
    </section>
  );
}

// === HELPERS ===

function readCurrentTheme(): StudioTheme {
  return currentTheme(document.documentElement);
}
