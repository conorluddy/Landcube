/**
 * `localStorage` / `sessionStorage` behind lazy accessors. Merely touching `window.localStorage`
 * throws when storage is blocked, so every call resolves it inside the caller's try/catch.
 */

export type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export const browserLocalStorage: BrowserStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => {
    localStorage.setItem(key, value);
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
  },
  key: (index) => localStorage.key(index),
  get length() {
    return localStorage.length;
  },
};

export const browserSessionStorage: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: (key) => sessionStorage.getItem(key),
  setItem: (key, value) => {
    sessionStorage.setItem(key, value);
  },
};
