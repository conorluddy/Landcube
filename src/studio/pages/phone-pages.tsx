import type { ReactNode } from 'react';
import type { OutputRenderer } from '../../types/export';
import { TabBar } from '../../ui/tab-bar';
import type { StudioController, StudioPage, StudioState } from '../controller';
import { browserSessionStorage } from '../browser-storage';
import { AccountPage } from './account';
import { LibraryPage } from './library';
import { PresetsPage } from './presets';
import { markSplashSeen } from './splash-session';
import { SplashPage } from './splash';

const tabItems: readonly { id: StudioPage; glyph: string; label: string }[] = [
  { id: 'library', glyph: '▦', label: 'Library' },
  { id: 'studio', glyph: '≋', label: 'Studio' },
  { id: 'presets', glyph: '◧', label: 'Presets' },
  { id: 'account', glyph: '○', label: 'Account' },
];

/**
 * Phone-only siblings of `.studio-shell`: the Library, Presets and Account pages, the TabBar and
 * the first-visit splash. The shell stays mounted and laid out (so the WebGL canvas never resizes);
 * it is only made invisible while another page is open.
 */
export function PhonePages({
  controller: c,
  state,
  renderer,
}: {
  controller: StudioController;
  state: StudioState;
  renderer: OutputRenderer;
}): ReactNode {
  const { page, hasSeenSplash, sheetSnap } = state.workspace;
  // A full sheet covers the tab bar; dragging it back down reveals the bar again.
  const isTabBarCovered = page === 'studio' && sheetSnap === 'full';

  return (
    <>
      <LibraryPage controller={c} state={state} renderer={renderer} isActive={page === 'library'} />
      <PresetsPage controller={c} state={state} isActive={page === 'presets'} />
      <AccountPage isActive={page === 'account'} />
      <div className="studio-tab-bar" data-covered={isTabBarCovered || undefined}>
        <TabBar
          items={tabItems}
          activeId={page}
          onSelect={(next) => {
            c.workspace({ page: next });
          }}
        />
      </div>
      {!hasSeenSplash && (
        <SplashPage
          onEnter={() => {
            markSplashSeen(browserSessionStorage);
            c.workspace({ hasSeenSplash: true });
          }}
        />
      )}
    </>
  );
}
