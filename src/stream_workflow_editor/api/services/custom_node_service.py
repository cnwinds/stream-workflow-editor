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
    """确保自定义节点目录存在
    
    注意：不会自动创建 templates 目录。
    如果用户提供了 templates 目录和自定义模板，将优先使用；
    否则使用内置的默认模板。
    """
    custom_nodes_dir = get_custom_nodes_dir()
    custom_nodes_dir.mkdir(parents=True, exist_ok=True)


def load_registry() -> Dict[str, Any]:
    """加载节点注册表，并自动检测和更新变化"""
    ensure_custom_nodes_dir()
    
    registry_file = get_registry_file()
    if not registry_file.exists():
        # 第一次加载，直接扫描所有文件
        logger.info("注册表不存在，将扫描所有节点文件")
        return _scan_and_create_registry()
    
    try:
        with open(registry_file, 'r', encoding='utf-8') as f:
            registry = json.load(f)
    except Exception as e:
        logger.error(f"加载注册表失败: {e}，将重新扫描", exc_info=True)
        return _scan_and_create_registry()
    
    # 检查是否需要更新注册表
    if _check_and_update_registry(registry):
        # 如果有更新，保存注册表
        save_registry(registry)
    
    return registry


def save_registry(registry: Dict[str, Any]):
    """保存节点注册表"""
    ensure_custom_nodes_dir()
    
    registry_file = get_registry_file()
    with open(registry_file, 'w', encoding='utf-8') as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)
    logger.debug(f"已保存注册表: {registry_file}")

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


def _extract_node_id_from_file(py_file: Path) -> Optional[str]:
    """从Python文件中提取节点ID（统一提取逻辑）
    
    提取顺序：
    1. 从代码中提取 @register_node('xxx') 中的值（最可靠）
    2. 加载模块，从 __node_id__ 属性获取
    3. 从类名推断（最后手段）
    
    Returns:
        节点ID，如果无法提取则返回None
    """
    import re
    
    # 方法1: 从代码文件中直接提取 @register_node 装饰器的值
    try:
        with open(py_file, 'r', encoding='utf-8') as f:
            python_code = f.read()
        match = re.search(r"@register_node\(['\"]([^'\"]+)['\"]\)", python_code)
        if match:
            node_id = match.group(1)
            logger.debug(f"从代码文件提取节点ID: {node_id} ({py_file.name})")
            return node_id
    except Exception as e:
        logger.warning(f"无法从代码文件提取节点ID: {e}")
    
    # 方法2: 加载模块，从 __node_id__ 属性获取
    if Node is None:
        return None
    
    try:
        module_name = py_file.stem
        import importlib.util
        
        # 清除模块缓存
        if module_name in sys.modules:
            del sys.modules[module_name]
        
        spec = importlib.util.spec_from_file_location(module_name, py_file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # 查找节点类
        for name, obj in inspect.getmembers(module, inspect.isclass):
            if (issubclass(obj, Node) and obj != Node):
                node_id = getattr(obj, '__node_id__', None)
                if node_id:
                    logger.debug(f"从 __node_id__ 获取节点ID: {node_id} ({py_file.name})")
                    return node_id
                
                # 方法3: 从类名推断（最后手段）
                logger.warning(f"节点类 {name} 没有 __node_id__ 属性，从类名推断节点ID")
                inferred_id = camel_to_snake(name)
                if inferred_id.endswith('_node'):
                    pass  # 已经是正确的格式
                elif inferred_id.endswith('node'):
                    inferred_id = inferred_id.replace('node', '_node')
                else:
                    inferred_id = f"{inferred_id}_node"
                logger.debug(f"从类名推断节点ID: {inferred_id} ({py_file.name})")
                return inferred_id
    except Exception as e:
        logger.warning(f"加载模块提取节点ID失败: {e} ({py_file.name})")
    
    return None


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
                    "schema": schema,  # 可以是字符串（简单类型）或字典（结构体）
                    "description": getattr(param_schema, "description", ""),
                }
            elif isinstance(param_schema, dict):
                                input_params[param_name] = {
                                    "isStreaming": param_schema.get("is_streaming", False) or param_schema.get("isStreaming", False),
                                    "schema": param_schema.get("schema", {}),
                                    "description": param_schema.get("description", ""),
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
                                    "description": getattr(param_schema, "description", ""),
                                }
            elif isinstance(param_schema, dict):
                                output_params[param_name] = {
                                    "isStreaming": param_schema.get("is_streaming", False) or param_schema.get("isStreaming", False),
                                    "schema": param_schema.get("schema", {}),
                                    "description": param_schema.get("description", ""),
                                }
    
    # 提取配置参数（使用 FieldSchema 格式）
    config_params = {}
    raw_config_params = getattr(node_class, "CONFIG_PARAMS", {})
    if raw_config_params:
        # CONFIG_PARAMS 使用 FieldSchema 格式
        # FieldSchema 可以是字符串（简单格式）或字典（详细格式）
        for param_name, field_def in raw_config_params.items():
            if isinstance(field_def, str):
                # 简单格式: "string"
                config_params[param_name] = field_def
            elif isinstance(field_def, dict):
                # 详细格式: {"type": "string", "required": True, "description": "...", "default": "..."}
                config_params[param_name] = field_def
            else:
                # 尝试从 FieldSchema 对象提取
                try:
                    from stream_workflow.core.parameter import FieldSchema
                    if isinstance(field_def, FieldSchema):
                        # 从 FieldSchema 对象提取
                        field_dict = {
                            "type": getattr(field_def, "type", "any"),
                        }
                        if getattr(field_def, "required", False):
                            field_dict["required"] = True
                        if getattr(field_def, "description", ""):
                            field_dict["description"] = getattr(field_def, "description", "")
                        if getattr(field_def, "default", None) is not None:
                            field_dict["default"] = getattr(field_def, "default")
                        config_params[param_name] = field_dict
                    else:
                        # 默认简单格式
                        config_params[param_name] = "any"
                except ImportError:
                    # 如果无法导入 FieldSchema，使用默认值
                    config_params[param_name] = "any"
    
    metadata["inputs"] = input_params  # 保持字典格式
    metadata["outputs"] = output_params  # 保持字典格式
    metadata["configParams"] = config_params  # 使用 FieldSchema 格式
    
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
        
        # 查找节点（通过 id，id 就是 register 名字）
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
        
        # 获取实际的节点ID（从 @register_node 装饰器）
        # id 就是 register 名字，所以直接使用
        actual_node_id = metadata.get("id")
        if not actual_node_id:
            actual_node_id = getattr(node_class, '__node_id__', None)
        
        # 使用实际的节点ID（register 名字），如果没有则使用注册表中的ID
        final_node_id = actual_node_id or node_id
        
        # 注意：这里不更新注册表，注册表的更新应该由专门的函数负责
        # 如果发现ID不一致，应该在调用方处理（如 list_custom_nodes）
        
        # 确保使用正确的节点ID
        metadata["id"] = final_node_id
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
    
    # 从代码中提取 @register_node 中的值作为实际的节点ID
    # 使用 register 名字作为 id，这样 id 和 register 名字保持一致
    actual_node_id = None
    try:
        # 简单正则匹配提取 @register_node('xxx') 中的 xxx
        import re
        match = re.search(r"@register_node\(['\"]([^'\"]+)['\"]\)", python_code)
        if match:
            actual_node_id = match.group(1)
            logger.debug(f"从代码中提取节点ID: {actual_node_id}")
    except Exception as e:
        logger.warning(f"无法从代码提取节点ID: {e}")
    
    # 如果从代码提取失败，尝试加载模块验证（确保装饰器正确执行）
    if not actual_node_id:
        try:
            import importlib
            import importlib.util
            import inspect
            from stream_workflow.core.node import Node
            
            # 清除模块缓存（如果存在）
            module_name = python_path.stem
            if module_name in sys.modules:
                del sys.modules[module_name]
            
            # 加载模块
            spec = importlib.util.spec_from_file_location(module_name, python_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # 查找节点类并获取 __node_id__
            for name, obj in inspect.getmembers(module, inspect.isclass):
                if (issubclass(obj, Node) and obj != Node):
                    actual_node_id = getattr(obj, '__node_id__', None)
                    if actual_node_id:
                        logger.debug(f"从模块加载获取节点ID: {actual_node_id}")
                    break
        except Exception as e:
            logger.warning(f"无法从模块加载获取节点ID: {e}")
    
    # 如果没有提取到 register 名字，使用用户输入的 node_id 作为 fallback
    if not actual_node_id:
        logger.warning(f"无法从 @register_node 提取节点ID，使用用户输入的 node_id: {node_id}")
        actual_node_id = node_id
    
    # 如果 register 名字和用户输入的 node_id 不一致，需要重命名文件
    if actual_node_id != node_id:
        logger.info(f"节点ID不一致：用户输入={node_id}，register名字={actual_node_id}，将使用 register 名字")
        # 删除旧文件
        if python_path.exists():
            python_path.unlink()
        # 使用 register 名字生成新文件名
        python_file = f"{actual_node_id}.py"
        python_path = get_custom_nodes_dir() / python_file
        # 重新保存代码
        with open(python_path, 'w', encoding='utf-8') as f:
            f.write(python_code)
    
    # 检查节点ID是否已存在（使用 register 名字）
    for node in registry.get("custom_nodes", []):
        if node.get("id") == actual_node_id:
            raise ValueError(f"节点ID已存在: {actual_node_id} (来自 @register_node)")
    
    # 添加到注册表
    now = datetime.utcnow().isoformat() + "Z"
    mtime = python_path.stat().st_mtime
    node_entry = {
        "id": actual_node_id,  # 使用 @register_node 中的值作为 id
        "pythonFile": python_file,
        "mtime": mtime,  # 文件修改时间
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
    
    # 查找节点（通过 id，id 就是 register 名字）
    node_entry = None
    for node in registry.get("custom_nodes", []):
        if node.get("id") == node_id:
            node_entry = node
            break
    
    if not node_entry:
        raise ValueError(f"节点不存在: {node_id}")
    
    python_file = node_entry.get("pythonFile")
    python_path = get_custom_nodes_dir() / python_file
    
    # 保存Python代码
    with open(python_path, 'w', encoding='utf-8') as f:
        f.write(python_code)
    
    # 尝试从代码中提取实际的节点ID（register 名字）并更新注册表
    actual_node_id = None
    try:
        import re
        match = re.search(r"@register_node\(['\"]([^'\"]+)['\"]\)", python_code)
        if match:
            actual_node_id = match.group(1)
            # 如果 register 名字和当前 id 不一致，需要更新
            if actual_node_id != node_entry.get("id"):
                # 检查新ID是否已存在
                for node in registry.get("custom_nodes", []):
                    if node.get("id") == actual_node_id and node.get("id") != node_id:
                        raise ValueError(f"节点ID已存在: {actual_node_id}")
                # 更新 id 和文件名
                old_python_file = node_entry.get("pythonFile")
                new_python_file = f"{actual_node_id}.py"
                if old_python_file != new_python_file:
                    # 重命名文件
                    old_path = get_custom_nodes_dir() / old_python_file
                    new_path = get_custom_nodes_dir() / new_python_file
                    if old_path.exists():
                        old_path.rename(new_path)
                    node_entry["pythonFile"] = new_python_file
                node_entry["id"] = actual_node_id
    except Exception as e:
        logger.warning(f"无法从代码提取节点ID: {e}")
    
    # 更新注册表
    node_entry["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    node_entry["mtime"] = python_path.stat().st_mtime  # 更新文件修改时间
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
    
    # 查找节点（通过 id，id 就是 register 名字）
    node_entry = None
    for node in registry.get("custom_nodes", []):
        if node.get("id") == node_id:
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
    
    # 尝试从代码中提取实际的节点ID（register 名字）并更新注册表
    actual_node_id = None
    try:
        import re
        match = re.search(r"@register_node\(['\"]([^'\"]+)['\"]\)", python_code)
        if match:
            actual_node_id = match.group(1)
            # 如果 register 名字和当前 id 不一致，需要更新
            if actual_node_id != node_entry.get("id"):
                # 检查新ID是否已存在
                for node in registry.get("custom_nodes", []):
                    if node.get("id") == actual_node_id and node.get("id") != node_id:
                        raise ValueError(f"节点ID已存在: {actual_node_id}")
                # 更新 id 和文件名
                old_python_file = node_entry.get("pythonFile")
                new_python_file = f"{actual_node_id}.py"
                if old_python_file != new_python_file:
                    # 重命名文件
                    old_path = get_custom_nodes_dir() / old_python_file
                    new_path = get_custom_nodes_dir() / new_python_file
                    if old_path.exists():
                        old_path.rename(new_path)
                    node_entry["pythonFile"] = new_python_file
                node_entry["id"] = actual_node_id
    except Exception as e:
        logger.warning(f"无法从代码提取节点ID: {e}")
    
    # 更新注册表
    node_entry["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    node_entry["mtime"] = python_path.stat().st_mtime  # 更新文件修改时间
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


def update_custom_node_parameters(
    node_id: str,
    inputs: Dict[str, Dict[str, Any]],
    outputs: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    """更新自定义节点的参数定义（只更新参数部分，保留其他代码）
    
    Args:
        node_id: 注册表ID或节点类型
        inputs: 新的输入参数（字典格式）
        outputs: 新的输出参数（字典格式）
    
    Returns:
        更新后的节点信息
    """
    import re
    
    ensure_custom_nodes_dir()
    
    # 加载注册表
    registry = load_registry()
    
    # 查找节点（通过 id，id 就是 register 名字）
    node_entry = None
    for node in registry.get("custom_nodes", []):
        if node.get("id") == node_id:
            node_entry = node
            break
    
    if not node_entry:
        raise ValueError(f"节点不存在: {node_id}")
    
    python_file = node_entry.get("pythonFile")
    python_path = get_custom_nodes_dir() / python_file
    
    if not python_path.exists():
        raise ValueError(f"Python文件不存在: {python_path}")
    
    # 读取当前代码
    with open(python_path, 'r', encoding='utf-8') as f:
        current_code = f.read()
    
    # 生成新的 INPUT_PARAMS 代码
    input_params_lines = []
    for param_name, param in inputs.items():
        is_streaming = param.get('isStreaming', False) or param.get('is_streaming', False)
        schema = param.get('schema', {})
        input_params_lines.append(
            f'        "{param_name}": ParameterSchema(\n'
            f'            is_streaming={str(is_streaming)},\n'
            f'            schema={repr(schema)}\n'
            f'        )'
        )
    new_input_params_code = ',\n'.join(input_params_lines)
    
    # 生成新的 OUTPUT_PARAMS 代码
    output_params_lines = []
    for param_name, param in outputs.items():
        is_streaming = param.get('isStreaming', False) or param.get('is_streaming', False)
        schema = param.get('schema', {})
        output_params_lines.append(
            f'        "{param_name}": ParameterSchema(\n'
            f'            is_streaming={str(is_streaming)},\n'
            f'            schema={repr(schema)}\n'
            f'        )'
        )
    new_output_params_code = ',\n'.join(output_params_lines)
    
    # 更新 INPUT_PARAMS
    # 使用更智能的方法：找到 INPUT_PARAMS = { 的位置，然后找到匹配的 }
    # 需要考虑字符串中的大括号
    input_match = re.search(r'(\s*#\s*输入参数定义\s*\n)?\s*INPUT_PARAMS\s*=\s*\{', current_code)
    if input_match:
        start_pos = input_match.end()
        brace_count = 1
        end_pos = start_pos
        in_string = False
        string_char = ''
        
        # 找到匹配的结束括号，考虑字符串中的大括号
        for i in range(start_pos, len(current_code)):
            char = current_code[i]
            prev_char = current_code[i - 1] if i > 0 else ''
            
            # 处理字符串
            if not in_string and (char == '"' or char == "'"):
                in_string = True
                string_char = char
            elif in_string and char == string_char and prev_char != '\\':
                in_string = False
            
            # 只有在不在字符串中时才计算大括号
            if not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_pos = i
                        break
        
        # 替换整个 INPUT_PARAMS 定义
        before = current_code[:input_match.start()]
        after = current_code[end_pos + 1:]
        current_code = f'{before}    # 输入参数定义\n    INPUT_PARAMS = {{\n{new_input_params_code}\n    }}{after}'
    
    # 更新 OUTPUT_PARAMS
    # 使用相同的方法
    output_match = re.search(r'(\s*#\s*输出参数定义\s*\n)?\s*OUTPUT_PARAMS\s*=\s*\{', current_code)
    if output_match:
        start_pos = output_match.end()
        brace_count = 1
        end_pos = start_pos
        in_string = False
        string_char = ''
        
        # 找到匹配的结束括号，考虑字符串中的大括号
        for i in range(start_pos, len(current_code)):
            char = current_code[i]
            prev_char = current_code[i - 1] if i > 0 else ''
            
            # 处理字符串
            if not in_string and (char == '"' or char == "'"):
                in_string = True
                string_char = char
            elif in_string and char == string_char and prev_char != '\\':
                in_string = False
            
            # 只有在不在字符串中时才计算大括号
            if not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_pos = i
                        break
        
        # 替换整个 OUTPUT_PARAMS 定义
        before = current_code[:output_match.start()]
        after = current_code[end_pos + 1:]
        current_code = f'{before}    # 输出参数定义\n    OUTPUT_PARAMS = {{\n{new_output_params_code}\n    }}{after}'
    
    # 保存更新后的代码
    with open(python_path, 'w', encoding='utf-8') as f:
        f.write(current_code)
    
    # 更新注册表
    node_entry["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    node_entry["mtime"] = python_path.stat().st_mtime  # 更新文件修改时间
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
    
    # 查找并删除节点（通过 id，id 就是 register 名字）
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
    
    registry_updated = False
    for node_entry in registry.get("custom_nodes", []):
        # id 就是 register 名字
        node_id = node_entry.get("id")
        
        metadata = get_custom_node_metadata(node_id)  # 使用 id 查找文件和提取元数据
        if metadata:
            # metadata["id"] 已经是从 __node_id__ 提取的，应该与 @register_node 中的值一致
            # 如果从装饰器获取的节点ID与注册表中的不同，更新注册表
            actual_node_id = metadata.get("id")
            if actual_node_id and actual_node_id != node_id:
                # 检查新ID是否已存在（避免冲突）
                for other_node in registry.get("custom_nodes", []):
                    if other_node.get("id") == actual_node_id and other_node.get("id") != node_id:
                        logger.warning(f"节点ID冲突: {actual_node_id}，跳过更新")
                        # 使用注册表中的ID，不更新
                        metadata["id"] = node_id
                        break
                else:
                    # 需要更新 id 和文件名
                    old_python_file = node_entry.get("pythonFile")
                    new_python_file = f"{actual_node_id}.py"
                    if old_python_file != new_python_file:
                        # 重命名文件
                        old_path = get_custom_nodes_dir() / old_python_file
                        new_path = get_custom_nodes_dir() / new_python_file
                        if old_path.exists() and not new_path.exists():
                            old_path.rename(new_path)
                            node_entry["pythonFile"] = new_python_file
                        elif old_path.exists() and new_path.exists() and old_path != new_path:
                            logger.warning(f"目标文件已存在，无法重命名: {new_path}")
                    node_entry["id"] = actual_node_id
                    registry_updated = True
            
            nodes.append(metadata)
    
    # 如果注册表有更新，保存它（只保存一次）
    if registry_updated:
        save_registry(registry)
    
    return nodes


def _scan_and_create_registry() -> Dict[str, Any]:
    """扫描所有节点文件并创建新的注册表"""
    custom_nodes_dir = get_custom_nodes_dir()
    registry = {"custom_nodes": [], "version": "1.0"}
    
    _auto_scan_nodes(custom_nodes_dir, registry)
    
    if registry.get("custom_nodes"):
        save_registry(registry)
        logger.info(f"已创建注册表，包含 {len(registry['custom_nodes'])} 个节点")
    
    return registry


def _check_and_update_registry(registry: Dict[str, Any]) -> bool:
    """检查并更新注册表（增量更新）
    
    检查：
    1. 是否有新增的节点文件
    2. 已注册的文件是否被修改（通过 mtime 判断）
    3. 已注册的文件是否被删除
    
    Returns:
        bool: 如果注册表有更新返回 True
    """
    custom_nodes_dir = get_custom_nodes_dir()
    if not custom_nodes_dir.exists():
        return False
    
    updated = False
    
    # 1. 收集当前目录中的所有节点文件及其修改时间
    current_files = {}
    for py_file in custom_nodes_dir.glob("*.py"):
        if py_file.name == "__init__.py" or py_file.name.startswith("_"):
            continue
        try:
            mtime = py_file.stat().st_mtime
            current_files[py_file.name] = {
                "path": py_file,
                "mtime": mtime,
                "stem": py_file.stem
            }
        except Exception as e:
            logger.warning(f"无法读取文件 {py_file}: {e}")
            continue
    
    # 2. 检查已注册的文件
    registered_files = set()
    nodes_to_remove = []
    
    for i, node_entry in enumerate(registry.get("custom_nodes", [])):
        python_file = node_entry.get("pythonFile")
        if not python_file:
            continue
        
        registered_files.add(python_file)
        
        # 检查文件是否还存在
        if python_file not in current_files:
            logger.info(f"节点文件已删除: {python_file}")
            nodes_to_remove.append(i)
            updated = True
            continue
        
        # 检查文件是否被修改
        file_info = current_files[python_file]
        registry_mtime = node_entry.get("mtime", 0)
        
        if file_info["mtime"] > registry_mtime:
            # 文件已修改，重新扫描此文件
            logger.info(f"节点文件已修改: {python_file}")
            _update_node_entry(node_entry, file_info["path"])
            node_entry["mtime"] = file_info["mtime"]
            updated = True
    
    # 删除不存在的节点（从后往前删除，避免索引问题）
    for i in reversed(nodes_to_remove):
        registry["custom_nodes"].pop(i)
    
    # 3. 检查是否有新文件
    new_files = set(current_files.keys()) - registered_files
    if new_files:
        logger.info(f"发现 {len(new_files)} 个新节点文件: {new_files}")
        for filename in new_files:
            file_info = current_files[filename]
            node_entry = _create_node_entry_from_file(file_info["path"])
            if node_entry:
                node_entry["mtime"] = file_info["mtime"]
                registry.setdefault("custom_nodes", []).append(node_entry)
                updated = True
    
    return updated


def _create_node_entry_from_file(py_file: Path) -> Optional[Dict[str, Any]]:
    """从Python文件创建节点注册项"""
    try:
        node_id = _extract_node_id_from_file(py_file)
        if not node_id:
            logger.warning(f"无法从文件提取节点ID: {py_file.name}")
            return None
        
        now = datetime.utcnow().isoformat() + "Z"
        return {
            "id": node_id,  # 使用 register 名字作为 id
            "pythonFile": py_file.name,
            "mtime": py_file.stat().st_mtime,
            "createdAt": now,
            "updatedAt": now
        }
    except Exception as e:
        logger.warning(f"解析节点文件 {py_file.name} 失败: {e}", exc_info=True)
        return None


def _update_node_entry(node_entry: Dict[str, Any], py_file: Path):
    """更新节点注册项（当文件被修改时）"""
    try:
        node_id = _extract_node_id_from_file(py_file)
        if not node_id:
            logger.warning(f"无法确定节点ID: {py_file.name}")
            return
        
        # 如果 register 名字和当前 id 不一致，需要更新
        current_id = node_entry.get("id")
        if node_id != current_id:
            # 检查新ID是否已存在（避免冲突）
            registry = load_registry()
            for node in registry.get("custom_nodes", []):
                if node.get("id") == node_id and node.get("id") != current_id:
                    logger.warning(f"节点ID已存在: {node_id}，跳过更新")
                    return
            
            # 更新 id 和文件名
            old_python_file = node_entry.get("pythonFile")
            new_python_file = f"{node_id}.py"
            if old_python_file != new_python_file:
                # 重命名文件
                old_path = get_custom_nodes_dir() / old_python_file
                new_path = get_custom_nodes_dir() / new_python_file
                if old_path.exists() and not new_path.exists():
                    old_path.rename(new_path)
                    node_entry["pythonFile"] = new_python_file
                elif old_path.exists() and new_path.exists() and old_path != new_path:
                    logger.warning(f"目标文件已存在，无法重命名: {new_path}")
            
            node_entry["id"] = node_id
            node_entry["updatedAt"] = datetime.utcnow().isoformat() + "Z"
            logger.info(f"已更新节点ID: {current_id} -> {node_id}")
    except Exception as e:
        logger.warning(f"更新节点 {py_file.name} 失败: {e}", exc_info=True)


def _auto_scan_nodes(custom_nodes_dir: Path, registry: Optional[Dict[str, Any]] = None):
    """自动扫描节点目录并更新注册表"""
    if registry is None:
        registry = load_registry()
    
    if Node is None:
        logger.warning("stream_workflow 未安装，无法扫描节点")
        return
    
    from datetime import datetime
    
    # 检查已存在的节点ID（id 就是 register 名字）
    existing_ids = set()
    for node in registry.get("custom_nodes", []):
        existing_ids.add(node.get("id"))
    
    # 扫描所有 .py 文件
    for py_file in custom_nodes_dir.glob("*.py"):
        if py_file.name == "__init__.py" or py_file.name.startswith("_"):
            continue
        
        try:
            node_id = _extract_node_id_from_file(py_file)
            if not node_id:
                logger.warning(f"无法提取节点ID，跳过文件: {py_file.name}")
                continue
            
            if node_id not in existing_ids:
                # 添加到注册表
                now = datetime.utcnow().isoformat() + "Z"
                mtime = py_file.stat().st_mtime
                node_entry = {
                    "id": node_id,  # 使用 register 名字作为 id
                    "pythonFile": py_file.name,
                    "mtime": mtime,  # 文件修改时间
                    "createdAt": now,
                    "updatedAt": now
                }
                registry.setdefault("custom_nodes", []).append(node_entry)
                existing_ids.add(node_id)
                logger.info(f"发现新节点: {node_id} ({py_file.name})")
        
        except Exception as e:
            logger.warning(f"扫描节点文件 {py_file.name} 失败: {e}", exc_info=True)


def get_node_code(node_id: str) -> Optional[str]:
    """获取节点Python代码
    支持通过注册表ID或节点类型查找
    """
    registry = load_registry()
    
    # 查找节点（通过 id，id 就是 register 名字）
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
    
    python_path = get_custom_nodes_dir() / python_file
    if python_path.exists():
        with open(python_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    return None

