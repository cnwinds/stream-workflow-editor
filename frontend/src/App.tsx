import { Layout, ConfigProvider } from 'antd'
import { useState, useEffect } from 'react'
import WorkflowCanvas from './components/WorkflowCanvas'
import NodePalette from './components/NodePalette'
import NodeConfigPanel from './components/NodeConfigPanel'
import Toolbar from './components/Toolbar'
import { useThemeStore } from './stores/themeStore'
import './App.css'

const { Header, Content, Sider } = Layout

function App() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const { getCurrentTheme } = useThemeStore()

  // 监听节点ID更新事件，同步更新选中状态
  useEffect(() => {
    const handleNodeIdUpdated = (event: CustomEvent) => {
      const { oldId, newId } = event.detail
      if (selectedNodeId === oldId) {
        setSelectedNodeId(newId)
      }
    }

    window.addEventListener('nodeIdUpdated', handleNodeIdUpdated as EventListener)
    return () => {
      window.removeEventListener('nodeIdUpdated', handleNodeIdUpdated as EventListener)
    }
  }, [selectedNodeId])

  // 根据选中类型确定属性栏宽度
  // 连线属性使用更宽的宽度，节点属性使用默认宽度
  const hasSelection = selectedNodeId || selectedEdgeId
  const configPanelWidth = selectedEdgeId ? 500 : 350 // 连线属性更宽

  const theme = getCurrentTheme()

  return (
    <ConfigProvider
      theme={{
        token: {
          colorBgContainer: theme.colors.background,
          colorBgElevated: theme.colors.backgroundSecondary,
          colorText: theme.colors.text,
          colorTextSecondary: theme.colors.textSecondary,
          colorBorder: theme.colors.border,
          colorPrimary: theme.colors.primary,
        },
      }}
    >
      <Layout 
        style={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          background: theme.colors.background,
        }}
      >
        <Header 
          style={{ 
            padding: 0, 
            background: theme.colors.background, 
            borderBottom: `1px solid ${theme.colors.border}`, 
            flexShrink: 0 
          }}
        >
          <Toolbar />
        </Header>
        <Layout style={{ flex: 1, overflow: 'hidden', background: theme.colors.background }}>
          <Sider 
            width={250} 
            style={{ 
              background: theme.colors.background, 
              borderRight: `1px solid ${theme.colors.border}`, 
              overflow: 'auto' 
            }}
          >
            <NodePalette />
          </Sider>
          <Content style={{ position: 'relative', overflow: 'hidden', background: theme.colors.canvasBackground }}>
            <WorkflowCanvas 
              onNodeSelect={setSelectedNodeId} 
              selectedNodeId={selectedNodeId}
              onEdgeSelect={setSelectedEdgeId}
            />
          </Content>
          {hasSelection && (
            <Sider 
              width={configPanelWidth} 
              style={{ 
                background: theme.colors.background, 
                borderLeft: `1px solid ${theme.colors.border}`, 
                overflow: 'auto' 
              }}
            >
              <NodeConfigPanel nodeId={selectedNodeId} edgeId={selectedEdgeId} />
            </Sider>
          )}
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}

export default App


