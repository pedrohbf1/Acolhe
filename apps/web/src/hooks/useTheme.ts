import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const THEME_KEY = "theme";

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>("light");

    useEffect(() => {
        const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;

        if (savedTheme === "dark" || savedTheme === "light") {
            applyTheme(savedTheme);
            setTimeout(() => {

                setThemeState(savedTheme);
            }, 0)
            return;
        }

        applyTheme("light");
        setTimeout(() => {

            setThemeState("light");
        }, 0)
    }, []);

    const setTheme = (value: Theme) => {
        applyTheme(value);
        localStorage.setItem(THEME_KEY, value);
        setThemeState(value);
    };

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    return {
        theme,
        setTheme,
        toggleTheme,
        isDark: theme === "dark",
    };
}

function applyTheme(theme: Theme) {
    const root = document.documentElement;

    if (theme === "dark") {
        root.classList.add("dark");
    } else {
        root.classList.remove("dark");
    }
}
