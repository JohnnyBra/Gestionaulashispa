import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
}

interface ThemeProviderState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    clearThemeOverride: () => void;
}

const initialState: ThemeProviderState = {
    theme: 'system',
    setTheme: () => null,
    clearThemeOverride: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

const MANUAL_FLAG = 'aulas_theme_manual';

function getSharedTheme(): Theme | null {
    const m = document.cookie.match(/(?:^|;\s*)HISPA_THEME=([^;]+)/);
    const v = m?.[1];
    return (v === 'light' || v === 'dark' || v === 'system') ? v as Theme : null;
}

export function ThemeProvider({
    children,
    defaultTheme = 'system',
    storageKey = 'vite-ui-theme',
}: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (!localStorage.getItem(MANUAL_FLAG)) {
            const cookieTheme = getSharedTheme();
            if (cookieTheme) return cookieTheme;
        }
        return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    });

    useEffect(() => {
        const root = window.document.documentElement;

        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
                .matches
                ? 'dark'
                : 'light';

            root.classList.add(systemTheme);
            return;
        }

        root.classList.add(theme);
    }, [theme]);

    // Re-sync from PrismaEdu cookie when tab regains focus (if no manual override)
    useEffect(() => {
        const syncFromCookie = () => {
            if (localStorage.getItem(MANUAL_FLAG)) return;
            const cookieTheme = getSharedTheme();
            if (cookieTheme) setThemeState(cookieTheme);
        };
        const onVisibility = () => { if (document.visibilityState === 'visible') syncFromCookie(); };
        window.addEventListener('focus', syncFromCookie);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('focus', syncFromCookie);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    const clearThemeOverride = () => {
        localStorage.removeItem(MANUAL_FLAG);
        const cookieTheme = getSharedTheme();
        if (cookieTheme) {
            localStorage.setItem(storageKey, cookieTheme);
            setThemeState(cookieTheme);
        }
    };

    const value = {
        theme,
        setTheme: (theme: Theme) => {
            localStorage.setItem(MANUAL_FLAG, '1');
            localStorage.setItem(storageKey, theme);
            setThemeState(theme);
        },
        clearThemeOverride,
    };

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);

    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider");

    return context;
};
