import WatchTryOnPage from './pages/WatchTryOnPage';
import DeepARTryOnPage from './pages/DeepARTryOnPage';

/**
 * DeepAR is the default engine now. The old MediaPipe build stays available for
 * comparison at `?engine=mediapipe`.
 *   /                    → DeepAR Web SDK (default)
 *   /?engine=mediapipe   → MediaPipe build
 */
export default function App() {
  const engine = new URLSearchParams(window.location.search).get('engine');
  const useMediaPipe = engine === 'mediapipe' || engine === 'old';
  return useMediaPipe ? <WatchTryOnPage /> : <DeepARTryOnPage />;
}
