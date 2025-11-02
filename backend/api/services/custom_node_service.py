"""
自定义节点服务
管理自定义节点的创建、读取、更新、删除
"""
import json
import os
import sys
import inspect
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
import importlib

try:
    from workflow_engine.core.node import Node
    from workflow_engine.core import ParameterSchema
except ImportError:
    Node = None
    ParameterSchema = None

# 自定义节点目录
CUSTOM_NODES_DIR = Path(__file__).parent.parent.parent / "custom_nodes"
REGISTRY_FILE = CUSTOM_NODES_DIR / "registry.json"


def ensure_custom_nodes_dir():
    """确保自定义节点目录存在"""
    CUSTOM_NODES_DIR.mkdir(parents=True, exist_ok=True)
    TEMPLATES_DIR = CUSTOM_NODES_DIR / "templates"
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)


def load_registry() -> Dict[str, Any]:
    """加载节点注册表"""
    ensure_custom_nodes_dir()
    
    if not REGISTRY_FILE.exists():
        return {"custom_nodes": []}
    
    try:
        with open(REGISTRY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"加载注册表失败: {e}")
        return {"custom_nodes": []}


def save_registry(registry: Dict[str, Any]):
    """保存节点注册表"""
    ensure_custom_nodes_dir()
    
    with open(REGISTRY_FILE, 'w', encoding='utf-8') as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)


def extract_node_metadata(node_class) -> Dict[str, Any]:
    """从节点类中提取元数据"""
    if not Node or not issubclass(node_class, Node):
        return {}
    
    # 提取基本信息
    metadata = {
        "id": getattr(node_class, '__node_id__', None),
        "name": getattr(node_class, "NAME", node_class.__name__),
        "description": (node_class.__doc__ or "").strip(),
        "category": getattr(node_class, "CATEGORY", "自定义"),
        "executionMode": getattr(node_class, "EXECUTION_MODE", "sequential"),
        "color": getattr(node_class, "COLOR", "#1890ff"),
    }
    
    # 提取输入参数（保持字典格式）
    input_params = {}
    raw_input_params = getattr(node_class, "INPUT_PARAMS", {})
    if raw_input_params:
        for param_name, param_schema in raw_input_params.items():
            if isinstance(param_schema, ParameterSchema):
                schema = getattr(param_schema, "schema", {})
                input_params[param_name] = {
                    "isStreaming": getattr(param_schema, "is_streaming", False),
                    "schema": schema,  # 字段名到类型的映射
                }
            elif isinstance(param_schema, dict):
                input_params[param_name] = {
                    "isStreaming": param_schema.get("is_streaming", False) or param_schema.get("isStreaming", False),
                    "schema": param_schema.get("schema", {}),
                }
    
    # 提取输出参数（保持字典格式）
    output_params = {}
    raw_output_params = getattr(node_class, "OUTPUT_PARAMS", {})
    if raw_output_params:
        for param_name, param_schema in raw_output_params.items():
            if isinstance(param_schema, ParameterSchema):
                output_params[param_name] = {
                    "isStreaming": getattr(param_schema, "is_streaming", False),
                    "schema": getattr(param_schema, "schema", {}),
                }
            elif isinstance(param_schema, dict):
                output_params[param_name] = {
                    "isStreaming": param_schema.get("is_streaming", False) or param_schema.get("isStreaming", False),
                    "schema": param_schema.get("schema", {}),
                }
    
    metadata["inputs"] = input_params  # 保持字典格式
    metadata["outputs"] = output_params  # 保持字典格式
    metadata["configSchema"] = getattr(node_class, "CONFIG_SCHEMA", {})
    
    return metadata


def get_custom_node_metadata(node_id: str) -> Optional[Dict[str, Any]]:
    """从Python代码中提取节点元数据"""
    if Node is None:
        return None
    
    try:
        # 加载注册表
        registry = load_registry()
        
        # 查找节点
        node_entry = None
        for node in registry.get("custom_nodes", []):
            if node.get("id") == node_id:
                node_entry = node
                break
        
        if not node_entry:
            return None
        
        python_file = node_entry.get("pythonFile")
        if not python_file:
            return None
        
        # 动态导入节点模块
        module_name = f"custom_nodes.{Path(python_file).stem}"
        
        # 清除模块缓存以便重新加载
        if module_name in sys.modules:
            del sys.modules[module_name]
        
        module = importlib.import_module(module_name)
        
        # 查找节点类
        node_class = None
        candidate_classes = []
        
        for name, obj in inspect.getmembers(module, inspect.isclass):
            if (issubclass(obj, Node) and 
                obj != Node and 
                obj.__module__ == module_name):
                candidate_classes.append((name, obj))
                node_id_from_class = getattr(obj, '__node_id__', None)
                # 优先匹配装饰器设置的节点ID
                if node_id_from_class == node_id:
                    node_class = obj
                    print(f"找到节点类: {name} (node_id={node_id_from_class})")
                    break
        
        # 如果还没找到，尝试匹配第一个候选类（通常一个文件只有一个节点类）
        if not node_class and candidate_classes:
            # 如果有多个候选，优先选择类名包含节点ID的
            for name, obj in candidate_classes:
                if node_id.lower() in name.lower() or name.lower().replace('node', '') == node_id.lower().replace('_', ''):
                    node_class = obj
                    break
            
            # 如果还是没找到，使用第一个候选类
            if not node_class:
                name, obj = candidate_classes[0]
                node_class = obj
        
        if not node_class:
            return None
        
        # 提取元数据
        metadata = extract_node_metadata(node_class)
        
        # 如果元数据中没有 id，使用传入的 node_id
        if not metadata.get("id"):
            metadata["id"] = node_id
        
        metadata["pythonFile"] = python_file
        metadata["createdAt"] = node_entry.get("createdAt")
        metadata["updatedAt"] = node_entry.get("updatedAt")
        
        return metadata
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None


def create_custom_node(
    node_id: str,
    name: str,
    description: str,
    category: str,
    execution_mode: str,
    color: str,
    inputs: Dict[str, Dict[str, Any]],  # 改为字典格式
    outputs: Dict[str, Dict[str, Any]],  # 改为字典格式
    config_schema: Dict[str, Any],
    python_code: str
) -> Dict[str, Any]:
    """创建自定义节点"""
    ensure_custom_nodes_dir()
    
    # 加载注册表
    registry = load_registry()
    
    # 检查节点ID是否已存在
    for node in registry.get("custom_nodes", []):
        if node.get("id") == node_id:
            raise ValueError(f"节点ID已存在: {node_id}")
    
    # 生成Python文件名
    python_file = f"{node_id}.py"
    python_path = CUSTOM_NODES_DIR / python_file
    
    # 保存Python代码
    with open(python_path, 'w', encoding='utf-8') as f:
        f.write(python_code)
    
    # 添加到注册表
    now = datetime.utcnow().isoformat() + "Z"
    node_entry = {
        "id": node_id,
        "pythonFile": python_file,
        "createdAt": now,
        "updatedAt": now
    }
    
    registry.setdefault("custom_nodes", []).append(node_entry)
    save_registry(registry)
    
    # 重新加载自定义节点模块
    try:
        import sys
        custom_nodes_module = sys.modules.get("custom_nodes")
        if custom_nodes_module:
            reload_func = getattr(custom_nodes_module, "reload_custom_nodes", None)
            if reload_func:
                reload_func()
    except Exception as e:
        print(f"重新加载自定义节点失败: {e}")
    
    return node_entry


def update_custom_node(
    node_id: str,
    python_code: str
) -> Dict[str, Any]:
    """更新自定义节点代码"""
    ensure_custom_nodes_dir()
    
    # 加载注册表
    registry = load_registry()
    
    # 查找节点
    node_entry = None
    for node in registry.get("custom_nodes", []):
        if node.get("id") == node_id:
            node_entry = node
            break
    
    if not node_entry:
        raise ValueError(f"节点不存在: {node_id}")
    
    python_file = node_entry.get("pythonFile")
    python_path = CUSTOM_NODES_DIR / python_file
    
    # 保存Python代码
    with open(python_path, 'w', encoding='utf-8') as f:
        f.write(python_code)
    
    # 更新注册表
    node_entry["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    save_registry(registry)
    
    # 重新加载自定义节点模块
    try:
        import sys
        custom_nodes_module = sys.modules.get("custom_nodes")
        if custom_nodes_module:
            reload_func = getattr(custom_nodes_module, "reload_custom_nodes", None)
            if reload_func:
                reload_func()
    except Exception as e:
        print(f"重新加载自定义节点失败: {e}")
    
    return node_entry


def update_custom_node_full(
    node_id: str,
    name: str,
    description: str,
    category: str,
    execution_mode: str,
    color: str,
    inputs: Dict[str, Dict[str, Any]],
    outputs: Dict[str, Dict[str, Any]],
    config_schema: Dict[str, Any],
    python_code: str
) -> Dict[str, Any]:
    """更新自定义节点的完整信息（元数据+代码）"""
    ensure_custom_nodes_dir()
    
    # 加载注册表
    registry = load_registry()
    
    # 查找节点
    node_entry = None
    for node in registry.get("custom_nodes", []):
        if node.get("id") == node_id:
            node_entry = node
            break
    
    if not node_entry:
        raise ValueError(f"节点不存在: {node_id}")
    
    python_file = node_entry.get("pythonFile")
    python_path = CUSTOM_NODES_DIR / python_file
    
    # 保存Python代码
    print(f"[update_custom_node_full] 正在保存Python代码到: {python_path}")
    print(f"[update_custom_node_full] 代码长度: {len(python_code)} 字符")
    print(f"[update_custom_node_full] 代码前100字符: {python_code[:100]}")
    
    with open(python_path, 'w', encoding='utf-8') as f:
        f.write(python_code)
    
    # 验证文件是否已写入
    if python_path.exists():
        with open(python_path, 'r', encoding='utf-8') as f:
            saved_content = f.read()
            print(f"[update_custom_node_full] 验证：文件已写入，内容长度: {len(saved_content)} 字符")
            if saved_content != python_code:
                print(f"[update_custom_node_full] 警告：保存的内容与原始内容不匹配！")
    
    # 更新注册表
    node_entry["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    save_registry(registry)
    
    # 重新加载自定义节点模块
    try:
        import sys
        custom_nodes_module = sys.modules.get("custom_nodes")
        if custom_nodes_module:
            reload_func = getattr(custom_nodes_module, "reload_custom_nodes", None)
            if reload_func:
                reload_func()
    except Exception as e:
        print(f"重新加载自定义节点失败: {e}")
    
    return node_entry


def delete_custom_node(node_id: str) -> bool:
    """删除自定义节点"""
    ensure_custom_nodes_dir()
    
    # 加载注册表
    registry = load_registry()
    
    # 查找并删除节点
    node_entry = None
    for i, node in enumerate(registry.get("custom_nodes", [])):
        if node.get("id") == node_id:
            node_entry = node
            registry["custom_nodes"].pop(i)
            break
    
    if not node_entry:
        return False
    
    # 删除Python文件
    python_file = node_entry.get("pythonFile")
    if python_file:
        python_path = CUSTOM_NODES_DIR / python_file
        if python_path.exists():
            python_path.unlink()
    
    # 保存注册表
    save_registry(registry)
    
    return True


def list_custom_nodes() -> List[Dict[str, Any]]:
    """列出所有自定义节点"""
    registry = load_registry()
    nodes = []
    
    for node_entry in registry.get("custom_nodes", []):
        node_id = node_entry.get("id")
        metadata = get_custom_node_metadata(node_id)
        if metadata:
            nodes.append(metadata)
    
    return nodes


def get_node_code(node_id: str) -> Optional[str]:
    """获取节点Python代码"""
    registry = load_registry()
    
    for node_entry in registry.get("custom_nodes", []):
        if node_entry.get("id") == node_id:
            python_file = node_entry.get("pythonFile")
            if python_file:
                python_path = CUSTOM_NODES_DIR / python_file
                if python_path.exists():
                    with open(python_path, 'r', encoding='utf-8') as f:
                        return f.read()
    
    return None

