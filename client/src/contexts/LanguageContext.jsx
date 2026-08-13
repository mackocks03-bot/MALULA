import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { translate as t, setLanguage as setLang, getLangFlag, getLangName, initLanguage } from '../utils/language.js';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    const [lang, setLangState] = useState(() => localStorage.getItem('language') || 'en');

    useEffect(() => {
        initLanguage();
        const saved = localStorage.getItem('language') || 'en';
        setLangState(saved);
    }, []);

    const setLanguage = useCallback((code) => {
        setLang(code);
        setLangState(code);
    }, []);

    const translate = useCallback((key) => t(key, lang), [lang]);

    return (
        <LanguageContext.Provider value={{ lang, setLanguage, translate, getLangFlag, getLangName }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
    return ctx;
}
