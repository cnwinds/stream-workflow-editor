# YAML 配置文件前端展示说明

## 展示效果

当您导入 `tests.yaml` 文件时，前端界面会按以下方式展示：

### 1. 工作流标题栏
- 显示工作流名称："大模型语音聊天工作流"
- 显示工作流描述："完整的语音对话流程：VAD -> ASR -> LLM -> TTS"

### 2. 节点展示

画布上会显示 4 个节点，按从左到右的顺序排列：

#### 节点 1: VAD（语音活动检测）
- **位置**: 左上角 (x: 200, y: 100)
- **显示名称**: "语音活动检测"
- **节点类型**: `vad_node`
- **样式**: 根据执行模式显示不同颜色（流式节点为绿色）
- **配置**: 可在右侧面板查看和编辑
  ```json
  {
    "threshold": 0.5,
    "min_speech_duration": 0.3
  }
  ```

#### 节点 2: ASR（语音识别）
- **位置**: (x: 500, y: 100)
- **显示名称**: "语音识别"
- **节点类型**: `asr_node`
- **配置**:
  ```json
  {
    "model": "whisper",
    "language": "zh",
    "stream_mode": true
  }
  ```

#### 节点 3: Agent（智能对话代理）
- **位置**: (x: 800, y: 100)
- **显示名称**: "智能对话代理"
- **节点类型**: `agent_node`
- **配置**:
  ```json
  {
    "model": "gpt-4",
    "temperature": 0.7,
    "stream": true,
    "system_prompt": "你是一个专业的AI语音助手..."
  }
  ```

#### 节点 4: TTS（文本转语音）
- **位置**: (x: 200, y: 300)
- **显示名称**: "文本转语音"
- **节点类型**: `tts_node`
- **配置**:
  ```json
  {
    "voice": "zh-CN-XiaoxiaoNeural",
    "speed": 1.0,
    "pitch": 1.0,
    "audio_format": "opus"
  }
  ```

### 3. 连接线展示

画布上会显示 4 条连接线，每条连接线都有标签显示参数名称：

#### 连接 1: VAD → ASR
- **起点**: VAD 节点的右侧（`audio_stream` 输出）
- **终点**: ASR 节点的左侧（`audio_in` 输入）
- **标签**: "audio_stream → audio_in"

#### 连接 2: ASR → Agent
- **起点**: ASR 节点的右侧（`text_stream` 输出）
- **终点**: Agent 节点的左侧（`text_input` 输入）
- **标签**: "text_stream → text_input"

#### 连接 3: Agent → TTS
- **起点**: Agent 节点的右侧（`response_text` 输出）
- **终点**: TTS 节点的左侧（`text_input` 输入）
- **标签**: "response_text → text_input"

#### 连接 4: TTS → Agent（反馈回路）
- **起点**: TTS 节点的右侧（`broadcast_status` 输出）
- **终点**: Agent 节点的左侧（`broadcast_status` 输入）
- **标签**: "broadcast_status → broadcast_status"
- **说明**: 这是一个反馈回路，用于实现打断功能

### 4. 节点配置面板

点击任意节点后，右侧面板会显示：

#### 表单视图
- **节点ID**: 只读，显示节点 ID（如 "vad"）
- **节点类型**: 只读，显示节点类型（如 "vad_node"）
- **节点名称**: 可编辑，显示节点显示名称
- **节点配置**: 可编辑的 JSON 文本区域，显示完整的配置对象

#### YAML 视图
- 显示当前节点的 YAML 格式配置片段

### 5. 工作流配置

顶部工具栏可以：
- **验证**: 检查工作流配置是否正确
- **导出**: 导出为 YAML 格式（使用 `from/to` 格式）
- **保存**: 保存到后端

### 6. 数据流可视化

工作流的执行流程清晰可见：
```
VAD (语音检测) 
  ↓ audio_stream
ASR (语音识别) 
  ↓ text_stream
Agent (智能对话) 
  ↓ response_text
TTS (语音合成)
  ↑ broadcast_status (反馈)
Agent
```

## 特性说明

### 自动布局
- 如果 YAML 中没有定义 `position`，系统会自动生成布局
- 节点按水平排列，每行 3 个节点

### 连接格式支持
- **导入**: 支持 `from: "node.param"` 和 `to: "node.param"` 格式
- **导出**: 导出为 `from/to` 格式，与 stream-workflow 兼容

### 节点配置
- 节点的 `config` 字段会完整保留
- 可以在前端界面中编辑配置
- 配置以 JSON 格式显示和编辑

### 流式连接
- 流式节点的连接线会显示参数名称
- 支持反馈回路（循环连接）


