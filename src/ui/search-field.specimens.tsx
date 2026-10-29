import { useState } from 'react';
import { SearchField, searchFieldInputClassName, type SearchFieldSize } from './search-field';
import { defineSpecimens } from './specimens';

function Demo({
  size = 'bar',
  initial = '',
  isOpen = false,
  keyboardHint,
  label = 'Search',
}: {
  size?: SearchFieldSize;
  initial?: string;
  isOpen?: boolean;
  keyboardHint?: string[];
  label?: string;
}): React.JSX.Element {
  const [query, setQuery] = useState(initial);

  return (
    <SearchField
      label={label}
      size={size}
      isOpen={isOpen}
      keyboardHint={keyboardHint}
      input={
        <input
          className={searchFieldInputClassName}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="specimen-search-results"
          placeholder="Mountain, town, lake…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      }
      popover={
        isOpen ? (
          <ul id="specimen-search-results" role="listbox">
            <li role="option" aria-selected="false">
              Ben Nevis
            </li>
          </ul>
        ) : null
      }
      statusLine={<span role="status">Place data © OpenStreetMap contributors</span>}
    />
  );
}

export default defineSpecimens('search-field', [
  { variant: 'bar', render: () => <Demo keyboardHint={['⌘', 'K']} /> },
  { variant: 'bar', state: 'hover', render: () => <Demo keyboardHint={['⌘', 'K']} /> },
  { variant: 'bar', state: 'focus', render: () => <Demo keyboardHint={['⌘', 'K']} /> },
  { variant: 'bar', state: 'filled', render: () => <Demo initial="Ben Nevis" /> },
  {
    variant: 'bar',
    state: 'long',
    render: () => (
      <Demo initial="Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch, Wales" />
    ),
  },
  { variant: 'bar', state: 'narrow', width: 200, render: () => <Demo keyboardHint={['⌘', 'K']} /> },
  { variant: 'mobile', width: 360, render: () => <Demo size="mobile" /> },
  { variant: 'mobile', state: 'focus', width: 360, render: () => <Demo size="mobile" /> },
]);
