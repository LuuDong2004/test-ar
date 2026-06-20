import './deeparGlPatch'; // must run before DeepAR creates its WebGL context
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// No React.StrictMode: its dev double-mount re-runs effects and can double-init
// the DeepAR SDK (a known cause of init hangs), which we must avoid.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
