import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles.css';

registerSW({ immediate: true });

// iPhone / iPad – aplikacja z ekranu głównego: iOS 26 nakłada rozmyty pas „Liquid Glass” na górę
// aplikacji także wtedy, gdy nie rysuje się ona pod paskiem statusu (wcięcie = 0), więc CSS sam
// tego nie wykryje. Klasa dodaje stały zapas pod nagłówkiem (patrz --top-safe w styles.css).
const nav = navigator as Navigator & { standalone?: boolean };
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (nav.standalone === true || (isIOS && window.matchMedia('(display-mode: standalone)').matches)) {
  document.documentElement.classList.add('ios-standalone');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
