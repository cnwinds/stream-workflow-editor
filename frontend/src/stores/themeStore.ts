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
    // 错误相关颜色
    error: string
    errorBackground: string
    errorBorder: string
    // 成功相关颜色
    success: string
    successBackground: string
    successBorder: string
    // 流式标签颜色
    streaming: string
    streamingBackground: string
    streamingBorder: string
    // 无效连接颜色
    invalid: string
    // Minimap 颜色
    minimapNodeFill: string
    minimapNodeStroke: string
    minimapEdgeStroke: string
    // 阴影颜色（rgba 值）
    shadow: string
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
      error: '#ff4d4f',
      errorBackground: '#fff2f0',
      errorBorder: '#ffccc7',
      success: '#52c41a',
      successBackground: '#f6ffed',
      successBorder: '#b7eb8f',
      streaming: '#52c41a',
      streamingBackground: '#f6ffed',
      streamingBorder: '#b7eb8f',
      invalid: '#ff4d4f',
      minimapNodeFill: '#b1b1b7',
      minimapNodeStroke: '#8c8c8c',
      minimapEdgeStroke: '#8c8c8c',
      shadow: 'rgba(0, 0, 0, 0.045)',
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
      error: '#ff4d4f',
      errorBackground: '#fff2f0',
      errorBorder: '#ffccc7',
      success: '#52c41a',
      successBackground: '#f6ffed',
      successBorder: '#b7eb8f',
      streaming: '#52c41a',
      streamingBackground: '#f6ffed',
      streamingBorder: '#b7eb8f',
      invalid: '#ff4d4f',
      minimapNodeFill: '#d4d3cc',
      minimapNodeStroke: '#a8a7a0',
      minimapEdgeStroke: '#7a7a7a',
      shadow: 'rgba(0, 0, 0, 0.08)',
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
      error: '#ff4d4f',
      errorBackground: '#2a1f1f',
      errorBorder: '#4a2f2f',
      success: '#52c41a',
      successBackground: '#1f2a1f',
      successBorder: '#2f4a2f',
      streaming: '#52c41a',
      streamingBackground: '#1f2a1f',
      streamingBorder: '#2f4a2f',
      invalid: '#ff4d4f',
      minimapNodeFill: '#e8e8e8',
      minimapNodeStroke: '#b1b1b7',
      minimapEdgeStroke: '#8c8c8c',
      shadow: 'rgba(0, 0, 0, 0.3)',
    },
  },
}

interface ThemeState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

// 应用主题到文档的 CSS 变量
function applyThemeToDocument(themeMode: ThemeMode) {
  const theme = themes[themeMode]
  const root = document.documentElement

  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--theme-${key}`, value)
  })

  document.body.className = `theme-${themeMode}`
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme: ThemeMode) => {
        set({ theme })
        applyThemeToDocument(theme)
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeToDocument(state.theme)
        }
      },
    }
  )
)

// 获取当前主题的 Hook（响应式）
export const useCurrentTheme = (): Theme => {
  const theme = useThemeStore((state) => state.theme)
  return themes[theme]
}

