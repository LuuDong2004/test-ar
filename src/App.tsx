import WatchTryOnPage from './pages/WatchTryOnPage';
import DeepARTryOnPage from './pages/DeepARTryOnPage';

/**
 * Engine A/B toggle via query string (no router needed):
 *   /                → MediaPipe build (current)
 *   /?engine=deepar  → DeepAR Web SDK build
 */
export default function App() {
  const useDeepAR = new URLSearchParams(window.location.search).get('engine') === 'deepar';
  return useDeepAR ? <DeepARTryOnPage /> : <WatchTryOnPage />;
}
