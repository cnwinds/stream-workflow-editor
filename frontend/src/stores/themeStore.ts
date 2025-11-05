import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ThemeMode = 'light' | 'eye-care' | 'dark'

export interface Theme {
  name: string
  mode: ThemeMode
  colors: {
    // 背景色
    background: string
    backgroundSecondary: string
    backgroundTertiary: string
    // 文字颜色
    text: string
    textSecondary: string
    textTertiary: string
    // 边框颜色
    border: string
    borderSecondary: string
    // 主色
    primary: string
    primaryHover: string
    // 节点颜色
    nodeBackground: string
    nodeBorder: string
    nodeSelected: string
    // 画布颜色
    canvasBackground: string
    canvasGrid: string
  }
}

const themes: Record<ThemeMode, Theme> = {
  light: {
    name: '明亮',
    mode: 'light',
    colors: {
      background: '#ffffff',
      backgroundSecondary: '#fafafa',
      backgroundTertiary: '#f5f5f5',
      text: '#262626',
      textSecondary: '#595959',
      textTertiary: '#8c8c8c',
      border: '#e8e8e8',
      borderSecondary: '#d9d9d9',
      primary: '#1890ff',
      primaryHover: '#40a9ff',
      nodeBackground: '#ffffff',
      nodeBorder: '#d9d9d9',
      nodeSelected: '#1890ff',
      canvasBackground: '#ffffff',
      canvasGrid: '#f0f0f0',
    },
  },
  'eye-care': {
    name: '护眼',
    mode: 'eye-care',
    colors: {
      background: '#f7f6f0',
      backgroundSecondary: '#f0efe8',
      backgroundTertiary: '#e8e7e0',
      text: '#3d3d3d',
      textSecondary: '#5a5a5a',
      textTertiary: '#7a7a7a',
      border: '#d4d3cc',
      borderSecondary: '#c4c3bc',
      primary: '#52c41a',
      primaryHover: '#73d13d',
      nodeBackground: '#f7f6f0',
      nodeBorder: '#c4c3bc',
      nodeSelected: '#52c41a',
      canvasBackground: '#f7f6f0',
      canvasGrid: '#e8e7e0',
    },
  },
  dark: {
    name: '暗色',
    mode: 'dark',
    colors: {
      background: '#1f1f1f',
      backgroundSecondary: '#262626',
      backgroundTertiary: '#2f2f2f',
      text: '#ffffff',
      textSecondary: '#d9d9d9',
      textTertiary: '#8c8c8c',
      border: '#434343',
      borderSecondary: '#595959',
      primary: '#177ddc',
      primaryHover: '#3c9fe8',
      nodeBackground: '#262626',
      nodeBorder: '#434343',
      nodeSelected: '#177ddc',
      canvasBackground: '#1a1a1a',
      canvasGrid: '#2a2a2a',
    },
  },
}

interface ThemeState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  getCurrentTheme: () => Theme
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme: ThemeMode) => {
        set({ theme })
        // 应用主题到 CSS 变量
        applyThemeToDocument(theme)
      },
      getCurrentTheme: () => {
        return themes[get().theme]
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // 恢复主题时应用
        if (state) {
          applyThemeToDocument(state.theme)
        }
      },
    }
  )
)

// 应用主题到文档的 CSS 变量
function applyThemeToDocument(themeMode: ThemeMode) {
  const theme = themes[themeMode]
  const root = document.documentElement

  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--theme-${key}`, value)
  })

  // 设置主题类名到 body
  document.body.className = `theme-${themeMode}`
}

// 初始化主题
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('theme-storage')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      applyThemeToDocument(parsed.state?.theme || 'light')
    } catch {
      applyThemeToDocument('light')
    }
  } else {
    applyThemeToDocument('light')
  }
}

