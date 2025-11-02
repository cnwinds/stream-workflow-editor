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

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ padding: 0, background: '#fff', borderBottom: '1px solid #e8e8e8' }}>
        <Toolbar />
      </Header>
      <Layout>
        <Sider width={250} style={{ background: '#fff', borderRight: '1px solid #e8e8e8' }}>
          <NodePalette />
        </Sider>
        <Content style={{ position: 'relative', overflow: 'hidden' }}>
          <WorkflowCanvas onNodeSelect={setSelectedNodeId} selectedNodeId={selectedNodeId} />
        </Content>
        <Sider width={350} style={{ background: '#fff', borderLeft: '1px solid #e8e8e8' }}>
          <NodeConfigPanel nodeId={selectedNodeId} />
        </Sider>
      </Layout>
    </Layout>
  )
}

export default App


