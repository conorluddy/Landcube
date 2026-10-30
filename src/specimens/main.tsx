import { createRoot } from 'react-dom/client';
import '../ui/ui.css';
import './specimens.css';
import { Catalogue } from './catalogue';

const params = new URLSearchParams(window.location.search);
const root = document.getElementById('root');

if (!root) {
  throw new Error('specimens.html is missing its #root element.');
}

if (params.get('theme') === 'light') {
  document.documentElement.dataset.theme = 'light';
}

createRoot(root).render(<Catalogue only={params.get('only')} />);
