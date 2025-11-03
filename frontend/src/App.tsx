import { Layout } from 'antd'
import { useState } from 'react'
import WorkflowCanvas from './components/WorkflowCanvas'
import NodePalette from './components/NodePalette'
import NodeConfigPanel from './components/NodeConfigPanel'
import Toolbar from './components/Toolbar'
import './App.css'

const { Header, Content, Sider } = Layout

function App() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  // 根据选中类型确定属性栏宽度
  // 连线属性使用更宽的宽度，节点属性使用默认宽度
  const hasSelection = selectedNodeId || selectedEdgeId
  const configPanelWidth = selectedEdgeId ? 500 : 350 // 连线属性更宽

  return (
    <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header style={{ padding: 0, background: '#fff', borderBottom: '1px solid #e8e8e8', flexShrink: 0 }}>
        <Toolbar />
      </Header>
      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        <Sider width={250} style={{ background: '#fff', borderRight: '1px solid #e8e8e8', overflow: 'auto' }}>
          <NodePalette />
        </Sider>
        <Content style={{ position: 'relative', overflow: 'hidden' }}>
          <WorkflowCanvas 
            onNodeSelect={setSelectedNodeId} 
            selectedNodeId={selectedNodeId}
            onEdgeSelect={setSelectedEdgeId}
          />
        </Content>
        {hasSelection && (
          <Sider 
            width={configPanelWidth} 
            style={{ background: '#fff', borderLeft: '1px solid #e8e8e8', overflow: 'auto' }}
          >
            <NodeConfigPanel nodeId={selectedNodeId} edgeId={selectedEdgeId} />
          </Sider>
        )}
      </Layout>
    </Layout>
  )
}

export default App


