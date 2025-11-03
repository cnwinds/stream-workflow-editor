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
    from stream_workflow.core.node import Node
    from stream_workflow.core import ParameterSchema
except ImportError:
    Node = None
    ParameterSchema = None

from ..config import config
from ..logger import logger


def get_custom_nodes_dir() -> Path:
    """获取自定义节点目录"""
    return config.get_custom_nodes_dir()


def get_registry_file() -> Path:
    """获取注册表文件路径"""
    return config.get_registry_file()


def ensure_custom_nodes_dir():
    """确保自定义节点目录存在"""
    custom_nodes_dir = get_custom_nodes_dir()
    custom_nodes_dir.mkdir(parents=True, exist_ok=True)
    templates_dir = custom_nodes_dir / "templates"
    templates_dir.mkdir(parents=True, exist_ok=True)


def load_registry() -> Dict[str, Any]:
    """加载节点注册表"""
    ensure_custom_nodes_dir()
    
    registry_file = get_registry_file()
    if not registry_file.exists():
        return {"custom_nodes": []}
    
    try:
        with open(registry_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"加载注册表失败: {e}", exc_info=True)
        return {"custom_nodes": []}


def save_registry(registry: Dict[str, Any]):
    """保存节点注册表"""
    ensure_custom_nodes_dir()
    
    registry_file = get_registry_file()
    with open(registry_file, 'w', encoding='utf-8') as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)


def camel_to_snake(name: str) -> str:
    """将驼峰命名转换为下划线命名
    
    例如: OpeningAgentNode -> opening_agent_node
    """
    import re
    # 在大写字母前插入下划线（除了第一个字母）
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    # 处理连续大写字母（如 HTTPRequest -> HTTP_Request）
    s2 = re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1)
    return s2.lower()


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
    """从Python代码中提取节点元数据
    
    Args:
        node_id: 注册表ID（用于查找注册表条目和文件）或节点类型
    """
    if Node is None:
        return None
    
    try:
        # 加载注册表
        registry = load_registry()
        
        # 查找节点（支持通过注册表ID或节点类型查找）
        node_entry = None
        for node in registry.get("custom_nodes", []):
            # 匹配注册表ID
            if node.get("id") == node_id:
                node_entry = node
                break
            # 匹配节点类型
            if node.get("type") == node_id:
                node_entry = node
                break
        
        if not node_entry:
            return None
        
        python_file = node_entry.get("pythonFile")
        if not python_file:
            return None
        
        # 动态导入节点模块
        # 由于自定义节点目录已添加到 sys.path，可以直接通过文件名导入
        module_name = Path(python_file).stem
        
        # 清除模块缓存以便重新加载
        if module_name in sys.modules:
            del sys.modules[module_name]
        
        try:
            module = importlib.import_module(module_name)
        except ImportError:
            # 如果直接导入失败，尝试使用完整路径
            custom_nodes_dir = get_custom_nodes_dir()
            python_path = custom_nodes_dir / python_file
            if python_path.exists():
                import importlib.util as importlib_util
                spec = importlib_util.spec_from_file_location(module_name, python_path)
                module = importlib_util.module_from_spec(spec)
                spec.loader.exec_module(module)
            else:
                raise
        
        # 查找节点类
        node_class = None
        candidate_classes = []
        
        for name, obj in inspect.getmembers(module, inspect.isclass):
            # 检查是否是 Node 的子类，并且模块名匹配（支持动态路径）
            if (issubclass(obj, Node) and obj != Node):
                # 检查模块名是否匹配（可能是 module_name 或 custom_nodes.module_name）
                obj_module = obj.__module__
                if obj_module == module_name or obj_module.endswith(f'.{module_name}'):
                    candidate_classes.append((name, obj))
                    node_id_from_class = getattr(obj, '__node_id__', None)
                    # 优先匹配装饰器设置的节点ID
                    if node_id_from_class == node_id:
                        node_class = obj
                        logger.debug(f"找到节点类: {name} (node_id={node_id_from_class})")
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
        
        # 获取实际的节点类型（从装饰器获取）
        actual_node_type = getattr(node_class, '__node_id__', None)
        if not actual_node_type:
            # 如果没有装饰器，从类名推断节点ID（驼峰命名转下划线命名）
            for name, obj in inspect.getmembers(module, inspect.isclass):
                if obj == node_class:
                    # 将驼峰命名转换为下划线命名，例如 OpeningAgentNode -> opening_agent_node
                    inferred_id = camel_to_snake(name)
                    # 移除末尾的 'node'（如果存在）
                    if inferred_id.endswith('_node'):
                        inferred_id = inferred_id  # 已经是正确的格式
                    elif inferred_id.endswith('node'):
                        inferred_id = inferred_id.replace('node', '_node')
                    else:
                        inferred_id = f"{inferred_id}_node"
                    actual_node_type = inferred_id
                    break
        
        # 使用实际的节点类型作为 id（用于工作流配置）
        # 优先级：1. 从装饰器获取的 actual_node_type（最准确）
        #         2. 注册表中的 type（可能过时或不准确）
        #         3. 注册表ID（fallback）
        registry_type = node_entry.get("type")
        final_node_type = actual_node_type or registry_type or node_id
        
        # 如果从装饰器获取的节点类型与注册表中的不同，更新注册表
        if actual_node_type and actual_node_type != registry_type:
            node_entry["type"] = actual_node_type
            save_registry(registry)
        if final_node_type:
            metadata["id"] = final_node_type
        
        # 保存注册表ID（用于节点管理）和实际节点类型
        metadata["registryId"] = node_id  # 注册表ID（用于管理）
        metadata["type"] = final_node_type  # 实际节点类型（用于工作流配置）
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
    python_path = get_custom_nodes_dir() / python_file
    
    # 保存Python代码
    with open(python_path, 'w', encoding='utf-8') as f:
        f.write(python_code)
    
    # 尝试从生成的代码中提取实际的节点类型（从 @register_node 装饰器）
    # 这里先保存，实际类型会在第一次加载时更新
    actual_type = None
    try:
        # 简单正则匹配提取 @register_node('xxx') 中的 xxx
        import re
        match = re.search(r"@register_node\(['\"]([^'\"]+)['\"]\)", python_code)
        if match:
            actual_type = match.group(1)
    except Exception:
        pass
    
    # 添加到注册表
    now = datetime.utcnow().isoformat() + "Z"
    node_entry = {
        "id": node_id,  # 注册表唯一标识（用于文件管理）
        "type": actual_type,  # 实际节点类型（从 @register_node 获取，用于工作流配置）
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
        logger.warning(f"重新加载自定义节点失败: {e}", exc_info=True)
    
    return node_entry


def update_custom_node(
    node_id: str,
    python_code: str
) -> Dict[str, Any]:
    """更新自定义节点代码"""
    ensure_custom_nodes_dir()
    
    # 加载注册表
    registry = load_registry()
    
    # 查找节点（支持通过注册表ID或节点类型查找）
    node_entry = None
    for node in registry.get("custom_nodes", []):
        if node.get("id") == node_id or node.get("type") == node_id:
            node_entry = node
            break
    
    if not node_entry:
        raise ValueError(f"节点不存在: {node_id}")
    
    python_file = node_entry.get("pythonFile")
    python_path = get_custom_nodes_dir() / python_file
    
    # 保存Python代码
    with open(python_path, 'w', encoding='utf-8') as f:
        f.write(python_code)
    
    # 尝试从代码中提取实际的节点类型并更新注册表
    actual_type = None
    try:
        import re
        match = re.search(r"@register_node\(['\"]([^'\"]+)['\"]\)", python_code)
        if match:
            actual_type = match.group(1)
            node_entry["type"] = actual_type
    except Exception:
        pass
    
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
        logger.warning(f"重新加载自定义节点失败: {e}", exc_info=True)
    
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
    
    # 查找节点（支持通过注册表ID或节点类型查找）
    node_entry = None
    for node in registry.get("custom_nodes", []):
        if node.get("id") == node_id or node.get("type") == node_id:
            node_entry = node
            break
    
    if not node_entry:
        raise ValueError(f"节点不存在: {node_id}")
    
    python_file = node_entry.get("pythonFile")
    python_path = get_custom_nodes_dir() / python_file
    
    # 保存Python代码
    logger.debug(f"正在保存Python代码到: {python_path}")
    logger.debug(f"代码长度: {len(python_code)} 字符")
    
    with open(python_path, 'w', encoding='utf-8') as f:
        f.write(python_code)
    
    # 验证文件是否已写入
    if python_path.exists():
        with open(python_path, 'r', encoding='utf-8') as f:
            saved_content = f.read()
            logger.debug(f"验证：文件已写入，内容长度: {len(saved_content)} 字符")
            if saved_content != python_code:
                logger.warning("保存的内容与原始内容不匹配！")
    
    # 尝试从代码中提取实际的节点类型并更新注册表
    actual_type = None
    try:
        import re
        match = re.search(r"@register_node\(['\"]([^'\"]+)['\"]\)", python_code)
        if match:
            actual_type = match.group(1)
            node_entry["type"] = actual_type
    except Exception:
        pass
    
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
        logger.warning(f"重新加载自定义节点失败: {e}", exc_info=True)
    
    return node_entry


def delete_custom_node(node_id: str) -> bool:
    """删除自定义节点
    
    Args:
        node_id: 注册表ID或节点类型
    """
    ensure_custom_nodes_dir()
    
    # 加载注册表
    registry = load_registry()
    
    # 查找并删除节点（支持通过注册表ID或节点类型查找）
    node_entry = None
    for i, node in enumerate(registry.get("custom_nodes", [])):
        if node.get("id") == node_id or node.get("type") == node_id:
            node_entry = node
            registry["custom_nodes"].pop(i)
            break
    
    if not node_entry:
        return False
    
    # 删除Python文件
    python_file = node_entry.get("pythonFile")
    if python_file:
        python_path = get_custom_nodes_dir() / python_file
        if python_path.exists():
            python_path.unlink()
    
    # 保存注册表
    save_registry(registry)
    
    return True


def list_custom_nodes() -> List[Dict[str, Any]]:
    """列出所有自定义节点"""
    registry = load_registry()
    nodes = []
    
    # 如果注册表为空，尝试自动扫描节点文件
    if not registry.get("custom_nodes"):
        # 自动扫描目录中的节点文件
        custom_nodes_dir = get_custom_nodes_dir()
        if custom_nodes_dir.exists():
            logger.info(f"注册表为空，正在扫描节点目录: {custom_nodes_dir}")
            _auto_scan_nodes(custom_nodes_dir)
            # 重新加载注册表
            registry = load_registry()
    
    registry_updated = False
    for node_entry in registry.get("custom_nodes", []):
        # 使用注册表ID查找文件
        registry_id = node_entry.get("id")
        node_type = node_entry.get("type")  # 注册表中的节点类型（可能过时或不准确）
        
        metadata = get_custom_node_metadata(registry_id)  # 使用注册表ID查找文件和提取元数据
        if metadata:
            # 优先级：从装饰器获取的节点ID（metadata["id"]）最准确
            # metadata["id"] 已经是从 __node_id__ 提取的，应该与 @register_node 中的值一致
            # 这样可以确保使用 @register_node 装饰器中指定的正确节点ID
            final_node_id = metadata.get("id") or node_type or registry_id
            if final_node_id:
                metadata["id"] = final_node_id
                metadata["type"] = final_node_id
            
            # 如果从装饰器获取的节点ID与注册表中的不同，更新注册表
            if metadata.get("id") and metadata["id"] != node_type:
                node_entry["type"] = metadata["id"]
                registry_updated = True
            
            # 保存注册表ID以便管理操作
            metadata["registryId"] = registry_id
            nodes.append(metadata)
    
    # 如果注册表有更新，保存它
    if registry_updated:
        save_registry(registry)
    
    return nodes


def _auto_scan_nodes(custom_nodes_dir: Path):
    """自动扫描节点目录并创建注册表"""
    try:
        from stream_workflow.core.node import Node
    except ImportError:
        logger.warning("stream_workflow 未安装，无法扫描节点")
        return
    
    import importlib
    import importlib.util
    import inspect
    from datetime import datetime
    
    registry = load_registry()
    # 检查已存在的节点类型（使用 type 字段，如果没有则使用 id）
    existing_types = set()
    existing_registry_ids = set()
    for node in registry.get("custom_nodes", []):
        existing_registry_ids.add(node.get("id"))
        node_type = node.get("type") or node.get("id")
        existing_types.add(node_type)
    
    # 扫描所有 .py 文件
    for py_file in custom_nodes_dir.glob("*.py"):
        if py_file.name == "__init__.py" or py_file.name.startswith("_"):
            continue
        
        # 检查文件名是否已在注册表中
        registry_id = py_file.stem
        if registry_id in existing_registry_ids:
            continue  # 已存在，跳过
        
        try:
            # 尝试导入模块获取节点ID
            module_name = py_file.stem
            spec = importlib.util.spec_from_file_location(module_name, py_file)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # 查找节点类
            node_type = None
            for name, obj in inspect.getmembers(module, inspect.isclass):
                if (issubclass(obj, Node) and obj != Node):
                    # 获取节点类型（从装饰器获取）
                    node_type = getattr(obj, '__node_id__', None)
                    if not node_type:
                        # 从类名推断节点ID（驼峰命名转下划线命名）
                        node_type = camel_to_snake(name)
                        # 移除末尾的 'node'（如果存在）并确保以 _node 结尾
                        if node_type.endswith('_node'):
                            pass  # 已经是正确的格式
                        elif node_type.endswith('node'):
                            node_type = node_type.replace('node', '_node')
                        else:
                            node_type = f"{node_type}_node"
                    break
            
            if node_type and node_type not in existing_types:
                # 添加到注册表
                now = datetime.utcnow().isoformat() + "Z"
                node_entry = {
                    "id": registry_id,  # 注册表唯一标识（用于文件管理）
                    "type": node_type,  # 实际节点类型（从 @register_node 获取，用于工作流配置）
                    "pythonFile": py_file.name,
                    "createdAt": now,
                    "updatedAt": now
                }
                registry.setdefault("custom_nodes", []).append(node_entry)
                existing_types.add(node_type)
                existing_registry_ids.add(registry_id)
                logger.info(f"发现新节点: {node_type} ({py_file.name}, registry_id={registry_id})")
        
        except Exception as e:
            logger.warning(f"扫描节点文件 {py_file.name} 失败: {e}", exc_info=True)
    
    # 保存注册表
    if registry.get("custom_nodes"):
        save_registry(registry)
        logger.info(f"已自动创建注册表，包含 {len(registry['custom_nodes'])} 个节点")


def get_node_code(node_id: str) -> Optional[str]:
    """获取节点Python代码
    支持通过注册表ID或节点类型查找
    """
    registry = load_registry()
    
    # 查找节点（支持通过注册表ID或节点类型查找）
    node_entry = None
    for node in registry.get("custom_nodes", []):
        # 匹配注册表ID
        if node.get("id") == node_id:
            node_entry = node
            break
        # 匹配节点类型
        if node.get("type") == node_id:
            node_entry = node
            break
    
    if not node_entry:
        return None
    
    python_file = node_entry.get("pythonFile")
    if not python_file:
        return None
    
    python_path = get_custom_nodes_dir() / python_file
    if python_path.exists():
        with open(python_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    return None

