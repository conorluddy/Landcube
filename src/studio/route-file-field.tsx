import { useId } from 'react';
import type { StudioController } from './controller';

/** GPX file input for the Overlays popover; an invalid file reports through `workspace.routeFault`. */
export function RouteFileField({
  controller,
}: {
  controller: StudioController;
}): React.JSX.Element {
  const inputId = useId();

  return (
    <div className="lc-field">
      <div className="lc-field__head">
        <label className="lc-field__label" htmlFor={inputId}>
          GPX file
        </label>
      </div>
      <input
        id={inputId}
        className="lc-field__input"
        type="file"
        accept=".gpx,application/gpx+xml,text/xml"
        onChange={(event) => {
          const input = event.currentTarget;
          const file = input.files?.[0];

          if (!file) {
            return;
          }

          void file.text().then((text) => {
            // Wave 2 adds the replace-confirm UI; until then a new file replaces the route as before.
            controller.loadRoute(text, file.name.replace(/\.gpx$/i, ''), { confirmed: true });
            // Clearing lets the same file be chosen again after a fix.
            input.value = '';
          });
        }}
      />
    </div>
  );
}
