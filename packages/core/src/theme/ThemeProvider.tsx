import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

export type Theme = 'dark' | 'light' | 'system'

interface ThemeProviderProps {
  children: ReactNode
  /** Theme applied before any stored preference exists. */
  defaultTheme?: Theme
  /** localStorage key used to persist the user's choice. */
  storageKey?: string
}

interface ThemeProviderState {
  theme: Theme
  /** The concrete theme currently on <html> ('dark' | 'light'), resolving 'system'. */
  resolvedTheme: 'dark' | 'light'
  setTheme: (theme: Theme) => void
}

const DEFAULT_STORAGE_KEY = 'vite-ui-theme'

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-color-scheme: dark)').matches

const resolveTheme = (theme: Theme): 'dark' | 'light' => {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light'
  return theme
}

const readStoredTheme = (storageKey: string, fallback: Theme): Theme => {
  if (typeof window === 'undefined') return fallback
  try {
    const stored = window.localStorage.getItem(storageKey) as Theme | null
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  } catch {
    // localStorage unavailable (private mode / sandboxed frame) — fall back.
  }
  return fallback
}

/**
 * Toggles the canonical `.dark` / `.light` class on <html> and persists the
 * user's choice. Pairs with @ci-avatar/core/styles/globals.css, whose :root and
 * .dark blocks define the actual token values.
 */
export const ThemeProvider = ({
  children,
  defaultTheme = 'dark',
  storageKey = DEFAULT_STORAGE_KEY
}: ThemeProviderProps) => {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme(storageKey, defaultTheme))
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(() => resolveTheme(theme))

  useEffect(() => {
    const root = document.documentElement
    const resolved = resolveTheme(theme)
    root.classList.remove('dark', 'light')
    root.classList.add(resolved)
    root.style.colorScheme = resolved
    setResolvedTheme(resolved)
  }, [theme])

  // Keep 'system' in sync with OS-level changes.
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const resolved = prefersDark() ? 'dark' : 'light'
      const root = document.documentElement
      root.classList.remove('dark', 'light')
      root.classList.add(resolved)
      root.style.colorScheme = resolved
      setResolvedTheme(resolved)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback(
    (next: Theme) => {
      try {
        window.localStorage.setItem(storageKey, next)
      } catch {
        // Ignore persistence failures — the in-memory state still updates.
      }
      setThemeState(next)
    },
    [storageKey]
  )

  const value = useMemo<ThemeProviderState>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  )

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>
}

export const useTheme = (): ThemeProviderState => {
  const context = useContext(ThemeProviderContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
