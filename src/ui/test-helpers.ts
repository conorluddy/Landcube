import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** Renders a component to an HTML string so node tests can assert on markup without a DOM. */
export function renderMarkup(node: ReactNode): string {
  return renderToStaticMarkup(node);
}
