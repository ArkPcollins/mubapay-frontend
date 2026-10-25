/**
 * English at launch. Shared UI strings are centralised here so additional
 * languages (e.g. Igbo, Hausa, Yoruba, Pidgin) can be added as new dictionaries.
 */
const en = {
  appName: 'MubaPay',
  nav: { home: 'Home', wallet: 'Wallet', savings: 'Savings', marketplace: 'Marketplace', realEstate: 'Real estate', orders: 'Orders', viewings: 'Viewings', messages: 'Messages', support: 'Support', settings: 'Settings', notifications: 'Notifications' },
  common: { save: 'Save', cancel: 'Cancel', confirm: 'Confirm', retry: 'Try again', loading: 'Loading…', next: 'Next', previous: 'Previous', close: 'Close', signOut: 'Sign out' },
};
const dictionaries = { en };
let current = 'en';
export function setLanguage(l) {
  if (dictionaries[l]) current = l;
}
export function t(path) {
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), dictionaries[current]) ?? path;
}
