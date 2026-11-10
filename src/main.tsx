import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { lazy, Suspense } from 'react';
import './styles.css';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource-variable/manrope/wght.css';
const Benchmark = import.meta.env.DEV && new URLSearchParams(location.search).has('benchmark') ? lazy(() => import('./BenchmarkPage')) : null;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{Benchmark ? <Suspense fallback={<p>Loading export test…</p>}><Benchmark /></Suspense> : <App />}</React.StrictMode>);
