export interface TabBarItem<T extends string> {
  id: T;
  /** Decorative character above the label. */
  glyph: string;
  label: string;
}

export interface TabBarProps<T extends string> {
  items: readonly TabBarItem<T>[];
  activeId: T;
  onSelect: (id: T) => void;
}

/** Phone root-page navigation (C-13): `nav[aria-label="Pages"]` of buttons; the active one has `aria-current="page"`. */
export function TabBar<T extends string>({
  items,
  activeId,
  onSelect,
}: TabBarProps<T>): React.JSX.Element {
  return (
    <nav className="lc-tab-bar" aria-label="Pages" data-ui-surface>
      {items.map((item) => (
        <button
          key={item.id}
          className="lc-tab-bar__item"
          type="button"
          aria-current={item.id === activeId ? 'page' : undefined}
          onClick={() => {
            onSelect(item.id);
          }}
        >
          <span className="lc-tab-bar__glyph" aria-hidden="true">
            {item.glyph}
          </span>
          <span className="lc-tab-bar__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
