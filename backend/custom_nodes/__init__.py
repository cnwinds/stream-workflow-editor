"""
自定义节点模块
动态加载所有自定义节点并注册到工作流引擎
"""
import os
import importlib
import inspect
from pathlib import Path

# 确保能导入 Node 基类
try:
    from workflow_engine.core.node import Node
except ImportError:
    Node = None

# 存储已加载的节点类
_loaded_nodes = {}


def load_custom_nodes():
    """动态加载所有自定义节点"""
    global _loaded_nodes
    _loaded_nodes = {}
    
    if Node is None:
        print("警告: workflow_engine 未安装，无法加载自定义节点")
        return _loaded_nodes
    
    # 获取当前目录
    custom_nodes_dir = Path(__file__).parent
    
    # 扫描目录中的所有 .py 文件
    for py_file in custom_nodes_dir.glob("*.py"):
        # 跳过 __init__.py 和模板文件
        if py_file.name == "__init__.py" or py_file.name.startswith("_"):
            continue
        
        try:
            # 动态导入模块
            module_name = f"custom_nodes.{py_file.stem}"
            module = importlib.import_module(module_name)
            
            # 查找节点类
            for name, obj in inspect.getmembers(module, inspect.isclass):
                if (issubclass(obj, Node) and 
                    obj != Node and 
                    obj.__module__ == module_name):
                    # 获取节点ID（从装饰器或类属性）
                    node_id = getattr(obj, '__node_id__', None)
                    if not node_id:
                        # 尝试从类名推断
                        node_id = name.lower().replace('node', '').replace('_', '_')
                    
                    _loaded_nodes[node_id] = obj
        
        except Exception as e:
            print(f"加载节点文件 {py_file.name} 失败: {e}")
            import traceback
            traceback.print_exc()
    
    return _loaded_nodes


def get_custom_node_class(node_id: str):
    """获取自定义节点类"""
    if not _loaded_nodes:
        load_custom_nodes()
    return _loaded_nodes.get(node_id)


def reload_custom_nodes():
    """重新加载所有自定义节点"""
    global _loaded_nodes
    _loaded_nodes = {}
    return load_custom_nodes()


# 启动时自动加载
if Node is not None:
    load_custom_nodes()


