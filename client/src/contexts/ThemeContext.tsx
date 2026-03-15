import React, { createContext, useContext, useEffect } from "react";

type Theme = "light";

interface ThemeContextType {
  theme: Theme;
  switchable: false;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
}: ThemeProviderProps) {
  useEffect(() => {
    // Force light theme permanently — remove any dark class and stored preference
    document.documentElement.classList.remove("dark");
    try {
      localStorage.removeItem("theme");
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "light", switchable: false }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
