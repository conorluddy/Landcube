import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  placeSearchAttribution,
  placeSearchDebounceMs,
  placeSearchMinimumQueryLength,
} from '../constants/place-search';
import type { PlaceMatch } from '../place-search';
import type { StudioController } from './controller';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; places: PlaceMatch[] }
  | { kind: 'failed'; message: string };

/** Autocompleting place search; choosing a match loads its terrain and saves it to the menu. */
export function PlaceSearchField({
  controller,
  compact = false,
}: {
  controller: StudioController;
  compact?: boolean;
}): ReactNode {
  const id = useId();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });
  const [activeIndex, setActiveIndex] = useState(-1);
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
    void controller.loadSearchedPlace(place);
  };

  return (
    <div className="place-search">
      <label className="field-row">
        <span className={compact ? 'visually-hidden' : undefined}>Search</span>
        {compact && (
          <svg className="header-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="m15.5 15.5 4 4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        )}
        <input
          id={`${id}-search`}
          type="text"
          role="combobox"
          autoComplete="off"
          placeholder="Mountain, town, lake…"
          aria-expanded={places.length > 0}
          aria-controls={`${id}-results`}
          aria-activedescendant={activeIndex >= 0 ? `${id}-result-${activeIndex}` : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && places.length > 0) {
              event.preventDefault();
              const step = event.key === 'ArrowDown' ? 1 : -1;

              setActiveIndex((index) => (index + step + places.length) % places.length);
            } else if (event.key === 'Enter' && activeIndex >= 0 && activeIndex < places.length) {
              event.preventDefault();
              choosePlace(places[activeIndex]);
            } else if (event.key === 'Escape') {
              setSearch({ kind: 'idle' });
            }
          }}
        />
      </label>
      <div className="place-search-popover">
        {places.length > 0 && (
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
        <p className="export-hint" role="status">
          {search.kind === 'loading'
            ? 'Searching…'
            : search.kind === 'failed'
              ? search.message
              : search.kind === 'results' && places.length === 0
                ? 'No places found.'
                : placeSearchAttribution}
        </p>
      </div>
    </div>
  );
}
