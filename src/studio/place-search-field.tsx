import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  placeSearchAttribution,
  placeSearchDebounceMs,
  placeSearchMinimumQueryLength,
} from '../constants/place-search';
import { getFault } from '../constants/faults';
import { operationErrorCodes } from '../constants/operations';
import type { PlaceMatch } from '../place-search';
import type { StudioController } from './controller';
import { SearchField, searchFieldInputClassName } from '../ui/search-field';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; places: PlaceMatch[] }
  | { kind: 'failed'; message: string };

/**
 * Autocompleting place search; choosing a match loads its terrain and saves it to the menu.
 * Framed as the glass SearchField, in the header and in the Terrain section.
 */
export function PlaceSearchField({ controller }: { controller: StudioController }): ReactNode {
  const id = useId();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  // The chosen name fills the input; it should not search again until the text changes.
  const chosenQuery = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (query === chosenQuery.current) {
      return;
    }

    chosenQuery.current = undefined;

    if (query.trim().length < placeSearchMinimumQueryLength) {
      setSearch({ kind: 'idle' });

      return;
    }

    let isCurrent = true;
    const timer = setTimeout(() => {
      setSearch({ kind: 'loading' });
      void controller.searchPlaces(query).then((result) => {
        if (!isCurrent || result === undefined) {
          return;
        }

        setActiveIndex(-1);
        setSearch(
          result.ok
            ? { kind: 'results', places: result.data }
            : { kind: 'failed', message: result.error.message },
        );
      });
    }, placeSearchDebounceMs);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [controller, query]);

  const places = search.kind === 'results' ? search.places : [];

  const choosePlace = (place: PlaceMatch) => {
    chosenQuery.current = place.name;
    setQuery(place.name);
    setSearch({ kind: 'idle' });
    setActiveIndex(-1);
    setIsOpen(false);
    void controller.loadSearchedPlace(place);
  };

  const input = (
    <input
      id={`${id}-search`}
      className={searchFieldInputClassName}
      type="text"
      role="combobox"
      autoComplete="off"
      placeholder="Mountain, town, lake…"
      aria-expanded={isOpen}
      aria-controls={`${id}-results`}
      aria-activedescendant={activeIndex >= 0 ? `${id}-result-${activeIndex}` : undefined}
      value={query}
      onFocus={() => {
        setIsOpen(true);
      }}
      onBlur={() => {
        setIsOpen(false);
      }}
      onChange={(event) => {
        setQuery(event.target.value);
        setIsOpen(true);
      }}
      onKeyDown={(event) => {
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && places.length > 0) {
          event.preventDefault();
          const step = event.key === 'ArrowDown' ? 1 : -1;

          setIsOpen(true);
          setActiveIndex((index) =>
            index < 0 && step < 0
              ? places.length - 1
              : (index + step + places.length) % places.length,
          );
        } else if (event.key === 'Enter' && activeIndex >= 0 && activeIndex < places.length) {
          event.preventDefault();
          choosePlace(places[activeIndex]);
        } else if (event.key === 'Escape') {
          setSearch({ kind: 'idle' });
          setActiveIndex(-1);
          setIsOpen(false);
        }
      }}
    />
  );
  const popover = (
    <div className="place-search-popover" data-open={isOpen}>
      {isOpen && places.length > 0 && (
        <ul id={`${id}-results`} className="place-search-results" role="listbox">
          {places.map((place, index) => (
            <li
              id={`${id}-result-${index}`}
              key={`${place.latitude},${place.longitude},${place.name}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                // Keeps focus in the input so the click lands before any blur.
                event.preventDefault();
                choosePlace(place);
              }}
            >
              <strong>{place.name}</strong>
              {place.detail !== '' && <span>{place.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      <p role="status">
        {search.kind === 'loading'
          ? 'Searching…'
          : search.kind === 'failed'
            ? `${getFault(operationErrorCodes.placeSearchFailed).code} · ${search.message}`
            : search.kind === 'results' && places.length === 0
              ? 'No places found.'
              : placeSearchAttribution}
      </p>
    </div>
  );

  return <SearchField label="Search" isOpen={isOpen} input={input} popover={popover} />;
}
