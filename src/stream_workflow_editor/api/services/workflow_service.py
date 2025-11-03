"""
stream-workflow 引擎服务封装
"""
import sys
from typing import Dict, Any, Optional, List, Tuple
import asyncio
from ..logger import logger

try:
    from stream_workflow.core import WorkflowEngine
    from stream_workflow.core.exceptions import (
        ConfigurationError,
        NodeExecutionError,
        WorkflowException,
    )
except ImportError as e:
    logger.warning(f"无法导入 stream-workflow 引擎: {e}")
    logger.warning("请确保已安装: pip install git+https://github.com/cnwinds/stream-workflow.git@main")
    WorkflowEngine = None
    ConfigurationError = Exception
    NodeExecutionError = Exception
    WorkflowException = Exception


class WorkflowEngineService:
    """工作流引擎服务"""

    def __init__(self):
        self._engines: Dict[str, Any] = {}
        self._executions: Dict[str, Dict[str, Any]] = {}

    def create_engine(self, execution_id: str, config: Dict[str, Any]):
        """创建工作流引擎实例"""
        if WorkflowEngine is None:
            raise RuntimeError("stream-workflow 引擎未安装，请运行: pip install git+https://github.com/cnwinds/stream-workflow.git@main")
        
        try:
            engine = WorkflowEngine()
            engine.load_config_dict(config)
            self._engines[execution_id] = engine
            return engine
        except Exception as e:
            raise ConfigurationError(f"创建工作流引擎失败: {str(e)}")

    async def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        验证工作流配置
        
        Returns:
            (is_valid, errors): 是否有效，错误列表
        """
        errors: List[Dict[str, Any]] = []
        
        try:
            # 基本结构验证
            if "workflow" not in config:
                errors.append({
                    "nodeId": None,
                    "message": "配置缺少 'workflow' 字段",
                    "field": "workflow"
                })
                return False, errors

            workflow = config["workflow"]
            
            # 验证工作流名称
            if not workflow.get("name"):
                errors.append({
                    "nodeId": None,
                    "message": "工作流名称不能为空",
                    "field": "workflow.name"
                })

            # 验证节点
            nodes = workflow.get("nodes", [])
            if not nodes:
                errors.append({
                    "nodeId": None,
                    "message": "工作流至少需要一个节点",
                    "field": "workflow.nodes"
                })

            # 尝试创建引擎来验证配置
            if WorkflowEngine is not None:
                try:
                    engine = WorkflowEngine()
                    engine.load_config_dict(config)
                except ConfigurationError as e:
                    errors.append({
                        "nodeId": None,
                        "message": f"配置错误: {str(e)}",
                        "field": None
                    })
                except Exception as e:
                    errors.append({
                        "nodeId": None,
                        "message": f"配置解析失败: {str(e)}",
                        "field": None
                    })

            # 验证节点 ID 唯一性
            node_ids = set()
            for i, node in enumerate(nodes):
                node_id = node.get("id")
                if not node_id:
                    errors.append({
                        "nodeId": str(i),
                        "message": f"节点 {i+1} 缺少 ID",
                        "field": "id"
                    })
                elif node_id in node_ids:
                    errors.append({
                        "nodeId": node_id,
                        "message": f"节点 ID '{node_id}' 重复",
                        "field": "id"
                    })
                else:
                    node_ids.add(node_id)

                # 验证节点类型
                if not node.get("type"):
                    errors.append({
                        "nodeId": node_id,
                        "message": f"节点 '{node_id}' 缺少类型",
                        "field": "type"
                    })

            # 验证连接
            valid_node_ids = set(node_ids)
            connections = workflow.get("connections", [])
            for conn in connections:
                source = conn.get("source") or conn.get("from", "").split(".")[0]
                target = conn.get("target") or conn.get("to", "").split(".")[0]
                
                if source and source not in valid_node_ids:
                    errors.append({
                        "nodeId": source,
                        "message": f"连接源节点 '{source}' 不存在",
                        "field": "connections.source"
                    })
                if target and target not in valid_node_ids:
                    errors.append({
                        "nodeId": target,
                        "message": f"连接目标节点 '{target}' 不存在",
                        "field": "connections.target"
                    })

            return len(errors) == 0, errors

        except Exception as e:
            errors.append({
                "nodeId": None,
                "message": f"验证过程出错: {str(e)}",
                "field": None
            })
            return False, errors

    async def execute_workflow(
        self,
        execution_id: str,
        config: Dict[str, Any],
        initial_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """执行工作流"""
        try:
            # 创建引擎
            engine = self.create_engine(execution_id, config)

            # 记录执行信息
            execution_info = {
                "id": execution_id,
                "status": "running",
                "config": config,
                "initialData": initial_data,
                "engine": engine,
            }
            self._executions[execution_id] = execution_info

            # 启动工作流（异步执行）
            asyncio.create_task(self._run_workflow(execution_id, engine, initial_data))

            return {
                "id": execution_id,
                "status": "running",
                "message": "工作流已启动",
            }

        except Exception as e:
            if execution_id in self._executions:
                self._executions[execution_id]["status"] = "failed"
                self._executions[execution_id]["error"] = str(e)
            raise WorkflowException(f"执行工作流失败: {str(e)}")

    async def _run_workflow(
        self,
        execution_id: str,
        engine: WorkflowEngine,
        initial_data: Optional[Dict[str, Any]] = None
    ):
        """后台运行工作流"""
        try:
            # 启动工作流
            await engine.start()

            # 执行工作流
            context = await engine.execute(initial_data=initial_data or {})

            # 更新执行状态
            if execution_id in self._executions:
                self._executions[execution_id]["status"] = "completed"
                self._executions[execution_id]["result"] = {
                    "outputs": context.get_all_outputs(),
                    "logs": [log for log in context.get_logs()],
                }

            # 停止工作流
            await engine.stop()

        except Exception as e:
            if execution_id in self._executions:
                self._executions[execution_id]["status"] = "failed"
                self._executions[execution_id]["error"] = str(e)

    async def stop_workflow(self, execution_id: str) -> bool:
        """停止工作流执行"""
        if execution_id not in self._executions:
            return False

        try:
            execution = self._executions[execution_id]
            engine = execution.get("engine")
            
            if engine:
                await engine.stop()
            
            execution["status"] = "stopped"
            return True

        except Exception as e:
            logger.error(f"停止工作流失败: {e}", exc_info=True)
            return False

    def get_execution_status(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """获取执行状态"""
        return self._executions.get(execution_id)

    def get_available_node_types(self) -> List[Dict[str, Any]]:
        """获取可用的节点类型（包括系统节点和自定义节点）"""
        system_node_types = []
        
        # 尝试从 stream-workflow 引擎获取节点类型
        try:
            # 方法1: 尝试通过 inspect 扫描 nodes 模块
            try:
                import inspect
                from stream_workflow import nodes
                from stream_workflow.core.node import Node
                
                node_types = []
                
                # 扫描 nodes 模块中的所有节点类
                for name, obj in inspect.getmembers(nodes, inspect.isclass):
                    # 检查是否是 Node 的子类
                    if (issubclass(obj, Node) and obj != Node):
                        # 尝试获取节点ID（从注册装饰器或类名推断）
                        node_id = getattr(obj, '__node_id__', None)
                        if not node_id:
                            # 从类名推断节点ID
                            node_id = name.lower().replace('node', '').replace('_', '_')
                            if not node_id.endswith('_node'):
                                node_id = f"{node_id}_node"
                        
                        # 获取节点执行模式
                        execution_mode = getattr(obj, "EXECUTION_MODE", "sequential")
                        
                        # 获取节点描述信息
                        node_info = {
                            "id": node_id,
                            "name": getattr(obj, "NAME", name.replace('Node', '').replace('_', ' ')),
                            "description": getattr(obj, "__doc__", ""),
                            "category": getattr(obj, "CATEGORY", "内置"),
                            "executionMode": execution_mode,
                            "color": self._get_color_for_mode(execution_mode),
                        }
                        
                        # 注意：不在节点类型中返回 inputs/outputs，前端会通过 /schema 端点获取详细参数信息
                        
                        system_node_types.append(node_info)
                
                if system_node_types:
                    pass  # 继续处理自定义节点
            except Exception as e:
                logger.debug(f"无法通过 inspect 扫描节点类型: {e}", exc_info=True)
        except Exception as e:
            logger.warning(f"获取系统节点类型失败: {e}", exc_info=True)
            # 使用默认节点类型
            system_node_types = self._get_default_node_types()
        
        # 加载自定义节点
        custom_node_types = []
        try:
            from .custom_node_service import list_custom_nodes
            custom_nodes = list_custom_nodes()
            
            for node in custom_nodes:
                node_id = node.get("id")
                # 跳过没有 id 的节点
                if not node_id:
                    logger.warning(f"跳过没有 id 的自定义节点: {node}")
                    continue
                    
                custom_node_types.append({
                    "id": node_id,
                    "name": node.get("name", node_id),
                    "description": node.get("description", ""),
                    "category": node.get("category", "自定义"),
                    "executionMode": node.get("executionMode", "sequential"),
                    "color": node.get("color", "#1890ff"),
                })
        except Exception as e:
            logger.error(f"加载自定义节点失败: {e}", exc_info=True)
        
        # 合并系统节点和自定义节点
        all_node_types = system_node_types + custom_node_types
        return all_node_types

    def get_node_schema(self, node_type: str) -> Dict[str, Any]:
        """获取节点 schema（支持系统节点和自定义节点）"""
        # 先尝试从自定义节点获取
        try:
            from .custom_node_service import get_custom_node_metadata
            custom_metadata = get_custom_node_metadata(node_type)
            if custom_metadata:
                # inputs和outputs已经是字典格式了，直接使用
                return {
                    "INPUT_PARAMS": custom_metadata.get("inputs", {}),
                    "OUTPUT_PARAMS": custom_metadata.get("outputs", {}),
                    "CONFIG_SCHEMA": custom_metadata.get("configSchema", {}),
                }
        except Exception as e:
            logger.debug(f"从自定义节点获取schema失败 ({node_type}): {e}", exc_info=True)
        
        # 尝试从系统节点获取
        try:
            # 方法1: 尝试直接导入节点类
            try:
                from stream_workflow.core import ParameterSchema
                
                # 尝试从 nodes 模块导入节点类
                # 节点类型格式通常是 "xxx_node"，对应的类名可能是 "XxxNode"
                node_class = None
                
                # 使用 inspect 模块扫描 nodes 模块
                try:
                    import inspect
                    from stream_workflow import nodes
                    from stream_workflow.core.node import Node
                    
                    # 扫描 nodes 模块中的所有节点类
                    for name, obj in inspect.getmembers(nodes, inspect.isclass):
                        if (issubclass(obj, Node) and obj != Node):
                            # 检查是否是目标节点类型
                            class_name_lower = name.lower()
                            node_type_lower = node_type.lower()
                            
                            # 匹配规则：类名去掉 "Node" 后匹配节点类型去掉 "_node"
                            if (class_name_lower.replace('node', '').replace('_', '') == 
                                node_type_lower.replace('_node', '').replace('_', '') or
                                node_type_lower in class_name_lower):
                                node_class = obj
                                break
                
                except Exception as e:
                    logger.debug(f"无法从 nodes 模块导入节点类: {e}", exc_info=True)
                
                if node_class:
                    # 解析 INPUT_PARAMS
                    input_params = {}
                    raw_input_params = getattr(node_class, "INPUT_PARAMS", {})
                    if raw_input_params:
                        for param_name, param_schema in raw_input_params.items():
                            if isinstance(param_schema, ParameterSchema):
                                schema = getattr(param_schema, "schema", {})
                                # 统一格式：只包含isStreaming和schema，key就是参数名
                                input_params[param_name] = {
                                    "isStreaming": getattr(param_schema, "is_streaming", False),
                                    "schema": schema,  # 字段名到类型的映射
                                }
                            elif isinstance(param_schema, dict):
                                # 兼容旧格式，提取isStreaming和schema
                                input_params[param_name] = {
                                    "isStreaming": param_schema.get("is_streaming", False) or param_schema.get("isStreaming", False),
                                    "schema": param_schema.get("schema", {}),
                                }
                            else:
                                input_params[param_name] = {
                                    "isStreaming": False,
                                    "schema": {},
                                }
                    
                    # 解析 OUTPUT_PARAMS
                    output_params = {}
                    raw_output_params = getattr(node_class, "OUTPUT_PARAMS", {})
                    if raw_output_params:
                        for param_name, param_schema in raw_output_params.items():
                            if isinstance(param_schema, ParameterSchema):
                                # 统一格式：只包含isStreaming和schema，key就是参数名
                                output_params[param_name] = {
                                    "isStreaming": getattr(param_schema, "is_streaming", False),
                                    "schema": getattr(param_schema, "schema", {}),
                                }
                            elif isinstance(param_schema, dict):
                                # 兼容旧格式，提取isStreaming和schema
                                output_params[param_name] = {
                                    "isStreaming": param_schema.get("is_streaming", False) or param_schema.get("isStreaming", False),
                                    "schema": param_schema.get("schema", {}),
                                }
                            else:
                                output_params[param_name] = {
                                    "isStreaming": False,
                                    "schema": {},
                                }
                    
                    schema = {
                        "INPUT_PARAMS": input_params,
                        "OUTPUT_PARAMS": output_params,
                        "CONFIG_SCHEMA": getattr(node_class, "CONFIG_SCHEMA", {}),
                    }
                    return schema
            except Exception as e:
                logger.debug(f"无法导入节点类: {e}", exc_info=True)
            
            
            # 如果都无法获取，返回空 schema
            return {
                "INPUT_PARAMS": {},
                "OUTPUT_PARAMS": {},
                "CONFIG_SCHEMA": {},
            }

        except Exception as e:
            logger.error(f"获取节点 schema 失败: {e}", exc_info=True)
            return {
                "INPUT_PARAMS": {},
                "OUTPUT_PARAMS": {},
                "CONFIG_SCHEMA": {},
            }

    def _get_color_for_mode(self, mode: str) -> str:
        """根据执行模式获取颜色"""
        colors = {
            "sequential": "#1890ff",
            "streaming": "#52c41a",
            "hybrid": "#faad14",
        }
        return colors.get(mode, "#1890ff")

    def _get_default_node_types(self) -> List[Dict[str, Any]]:
        """获取默认节点类型（当无法从引擎获取时）"""
        return [
            {
                "id": "start",
                "name": "起始节点",
                "description": "工作流的起始节点",
                "category": "基础",
                "executionMode": "sequential",
                "color": "#1890ff",
            },
            {
                "id": "http",
                "name": "HTTP 请求",
                "description": "发送 HTTP 请求",
                "category": "网络",
                "executionMode": "sequential",
                "color": "#1890ff",
            },
            {
                "id": "transform",
                "name": "数据转换",
                "description": "转换数据格式",
                "category": "数据处理",
                "executionMode": "sequential",
                "color": "#1890ff",
            },
            {
                "id": "condition",
                "name": "条件判断",
                "description": "根据条件分支",
                "category": "流程控制",
                "executionMode": "sequential",
                "color": "#1890ff",
            },
            {
                "id": "merge",
                "name": "合并节点",
                "description": "合并多个输入",
                "category": "流程控制",
                "executionMode": "sequential",
                "color": "#1890ff",
            },
            {
                "id": "output",
                "name": "输出节点",
                "description": "工作流的输出节点",
                "category": "基础",
                "executionMode": "sequential",
                "color": "#1890ff",
            },
        ]


# 全局单例
workflow_service = WorkflowEngineService()

