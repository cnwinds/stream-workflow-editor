"""
自定义节点模块
动态加载所有自定义节点并注册到工作流引擎
"""
import os
import sys
import importlib
import inspect
import importlib.util
from pathlib import Path

# 导入日志记录器
try:
    from stream_workflow_editor.api.logger import logger
except ImportError:
    # 如果无法导入，创建一个简单的 logger
    import logging
    logger = logging.getLogger(__name__)

# 确保能导入 Node 基类
try:
    from stream_workflow.core.node import Node
except ImportError:
    Node = None

# 存储已加载的节点类
_loaded_nodes = {}


def load_custom_nodes(custom_nodes_dir: Path = None):
    """
    动态加载所有自定义节点
    
    Args:
        custom_nodes_dir: 自定义节点目录路径（可选，如果不提供则从配置管理器获取）
    """
    global _loaded_nodes
    _loaded_nodes = {}
    
    if Node is None:
        logger.warning("stream_workflow 未安装，无法加载自定义节点")
        return _loaded_nodes
    
    # 获取自定义节点目录
    if custom_nodes_dir is None:
        try:
            from stream_workflow_editor.api.config import config
            custom_nodes_dir = config.get_custom_nodes_dir()
        except Exception:
            # 如果配置未初始化，尝试使用当前文件所在目录
            custom_nodes_dir = Path(__file__).parent
    
    if not custom_nodes_dir.exists():
        logger.warning(f"自定义节点目录不存在: {custom_nodes_dir}")
        return _loaded_nodes
    
    # 扫描目录中的所有 .py 文件
    for py_file in custom_nodes_dir.glob("*.py"):
        # 跳过 __init__.py 和模板文件
        if py_file.name == "__init__.py" or py_file.name.startswith("_"):
            continue
        
        try:
            # 动态导入模块
            # 由于自定义节点目录已添加到 sys.path，可以直接通过文件名导入
            module_name = py_file.stem
            
            # 清除模块缓存以便重新加载
            if module_name in sys.modules:
                del sys.modules[module_name]
            
            try:
                module = importlib.import_module(module_name)
            except ImportError:
                # 如果直接导入失败，使用文件路径导入
                spec = importlib.util.spec_from_file_location(module_name, py_file)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
            
            # 查找节点类
            for name, obj in inspect.getmembers(module, inspect.isclass):
                if (issubclass(obj, Node) and obj != Node):
                    # 检查模块名匹配（支持动态路径）
                    obj_module = obj.__module__
                    if obj_module == module_name or obj_module.endswith(f'.{module_name}'):
                        # 获取节点ID（从装饰器或类属性）
                        node_id = getattr(obj, '__node_id__', None)
                        if not node_id:
                            # 尝试从类名推断（与系统节点规则保持一致）
                            node_id = name.lower().replace('node', '').replace('_', '_')
                            # 如果节点ID不是以 _node 结尾，自动添加（与系统节点保持一致）
                            if node_id and not node_id.endswith('_node'):
                                node_id = f"{node_id}_node"
                        
                        _loaded_nodes[node_id] = obj
        
        except Exception as e:
            logger.error(f"加载节点文件 {py_file.name} 失败: {e}", exc_info=True)
    
    return _loaded_nodes


def get_custom_node_class(node_id: str):
    """获取自定义节点类"""
    if not _loaded_nodes:
        load_custom_nodes()
    return _loaded_nodes.get(node_id)


def reload_custom_nodes(custom_nodes_dir: Path = None):
    """重新加载所有自定义节点"""
    global _loaded_nodes
    _loaded_nodes = {}
    return load_custom_nodes(custom_nodes_dir)


# 启动时自动加载（如果配置已初始化）
if Node is not None:
    try:
        from stream_workflow_editor.api.config import config
        if config.is_initialized():
            load_custom_nodes()
    except Exception:
        # 如果配置未初始化，使用默认路径（向后兼容）
        pass


