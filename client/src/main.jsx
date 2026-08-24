import React from 'react';
import ReactDOM from 'react-dom/client';
import { initConsoleHijack } from './utils/consoleHijack.js';

initConsoleHijack();
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { LanguageProvider } from './contexts/LanguageContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import { PushProvider } from './contexts/PushContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <ThemeProvider>
                <LanguageProvider>
                    <ToastProvider>
                        <AuthProvider>
                            <PushProvider>
                                <App />
                            </PushProvider>
                        </AuthProvider>
                    </ToastProvider>
                </LanguageProvider>
            </ThemeProvider>
        </BrowserRouter>
    </React.StrictMode>
);
