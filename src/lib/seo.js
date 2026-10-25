import { useEffect } from 'react';

/** Per-page metadata + JSON-LD. Non-public / unpublished content is marked noindex. */
export function useSeo({ title, description, jsonLd, noindex }) {
  useEffect(() => {
    document.title = title ? `${title} | MubaPay` : 'MubaPay';
    const set = (name, content) => {
      let m = document.querySelector(`meta[name="${name}"]`);
      if (!m) {
        m = document.createElement('meta');
        m.setAttribute('name', name);
        document.head.appendChild(m);
      }
      m.setAttribute('content', content);
    };
    if (description) set('description', description.slice(0, 160));
    set('robots', noindex ? 'noindex, nofollow' : 'index, follow');
    let s = document.getElementById('jsonld');
    if (jsonLd) {
      if (!s) {
        s = document.createElement('script');
        s.type = 'application/ld+json';
        s.id = 'jsonld';
        document.head.appendChild(s);
      }
      s.textContent = JSON.stringify(jsonLd);
    } else if (s) s.remove();
  }, [title, description, noindex, JSON.stringify(jsonLd)]); // eslint-disable-line react-hooks/exhaustive-deps
}
