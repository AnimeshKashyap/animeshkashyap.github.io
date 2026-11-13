import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

(typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb: IdleRequestCallback) => setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 1))(() => import('./chatbot').then((m) => m.mountChatbot({ page: 'main' })));
