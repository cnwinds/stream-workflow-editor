"""
节点信息 API
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ..services.workflow_service import workflow_service
from ..logger import logger
from ..services.custom_node_service import (
    create_custom_node,
    update_custom_node,
    update_custom_node_full,
    update_custom_node_parameters,
    delete_custom_node,
    list_custom_nodes,
    get_node_code,
    get_custom_node_metadata
)
from ..services.node_generator import generate_node_code, validate_node_definition

router = APIRouter()


class NodeType(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    category: str
    icon: Optional[str] = None
    executionMode: str  # sequential, streaming, hybrid
    color: Optional[str] = None
    # inputs 和 outputs 不在节点类型中返回，前端通过 /schema 端点获取详细参数信息
    configSchema: Optional[Dict[str, Any]] = None


class NodeSchema(BaseModel):
    INPUT_PARAMS: Optional[Dict[str, Any]] = None
    OUTPUT_PARAMS: Optional[Dict[str, Any]] = None
    CONFIG_SCHEMA: Optional[Dict[str, Any]] = None


@router.get("/types", response_model=List[NodeType])
async def get_node_types():
    """获取所有节点类型"""
    try:
        # 从 stream-workflow 引擎获取节点类型
        node_types = workflow_service.get_available_node_types()
        
        # 转换为 API 响应格式
        return [NodeType(**node_type) for node_type in node_types]
    except Exception as e:
        # 如果获取失败，返回默认节点类型
        logger.warning(f"获取节点类型失败，使用默认类型: {e}", exc_info=True)
        default_types = workflow_service._get_default_node_types()
        return [NodeType(**node_type) for node_type in default_types]


@router.get("/{node_type}/schema", response_model=NodeSchema)
async def get_node_schema(node_type: str):
    """获取节点参数 schema"""
    try:
        # 从 stream-workflow 引擎获取节点 schema
        schema = workflow_service.get_node_schema(node_type)
        return NodeSchema(**schema)
    except Exception as e:
        logger.warning(f"获取节点 schema 失败: {e}", exc_info=True)
        return NodeSchema(
            INPUT_PARAMS={},
            OUTPUT_PARAMS={},
            CONFIG_SCHEMA={},
        )


# 自定义节点相关API
class CreateNodeRequest(BaseModel):
    nodeId: str
    name: str
    description: str = ""  # 允许为空，默认为空字符串
    category: str
    executionMode: str
    color: str
    inputs: Dict[str, Dict[str, Any]]  # 改为字典结构，key是输入名称，value包含isStreaming和schema
    outputs: Dict[str, Dict[str, Any]]  # 改为字典结构，key是输出名称，value包含isStreaming和schema
    configSchema: Dict[str, Any]
    pythonCode: Optional[str] = None


class UpdateNodeCodeRequest(BaseModel):
    pythonCode: str


@router.post("/custom", status_code=201)
async def create_custom_node_endpoint(request: CreateNodeRequest):
    """创建自定义节点"""
    try:
        # 验证节点定义
        is_valid, error_msg = validate_node_definition(
            request.nodeId,
            request.inputs,
            request.outputs
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # 转换inputs和outputs为列表格式（向后兼容代码生成器）
        inputs_list = [
            {
                'name': name,
                'isStreaming': param.get('isStreaming', False),
                'schema': param.get('schema', {})
            }
            for name, param in request.inputs.items()
        ]
        outputs_list = [
            {
                'name': name,
                'isStreaming': param.get('isStreaming', False),
                'schema': param.get('schema', {})
            }
            for name, param in request.outputs.items()
        ]
        
        # 如果提供了Python代码，使用提供的代码；否则生成代码
        if request.pythonCode:
            python_code = request.pythonCode
        else:
            python_code = generate_node_code(
                node_id=request.nodeId,
                name=request.name,
                description=request.description,
                category=request.category,
                execution_mode=request.executionMode,
                color=request.color,
                inputs=inputs_list,
                outputs=outputs_list,
                config_schema=request.configSchema
            )
        
        # 创建节点（保存为字典格式）
        node_entry = create_custom_node(
            node_id=request.nodeId,
            name=request.name,
            description=request.description,
            category=request.category,
            execution_mode=request.executionMode,
            color=request.color,
            inputs=request.inputs,  # 保存为字典格式
            outputs=request.outputs,  # 保存为字典格式
            config_schema=request.configSchema,
            python_code=python_code
        )
        
        return {"message": "节点创建成功", "node": node_entry}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"创建自定义节点失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建节点失败: {str(e)}")


@router.get("/custom")
async def list_custom_nodes_endpoint():
    """获取所有自定义节点"""
    try:
        nodes = list_custom_nodes()
        return {"nodes": nodes}
    except Exception as e:
        logger.error(f"获取自定义节点列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取节点列表失败: {str(e)}")


@router.get("/custom/{node_id}")
async def get_custom_node_endpoint(node_id: str):
    """获取自定义节点信息"""
    try:
        metadata = get_custom_node_metadata(node_id)
        if not metadata:
            raise HTTPException(status_code=404, detail=f"节点不存在: {node_id}")
        return metadata
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取自定义节点信息失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取节点信息失败: {str(e)}")


@router.put("/custom/{node_id}")
async def update_custom_node_endpoint(node_id: str, request: UpdateNodeCodeRequest):
    """更新自定义节点代码"""
    try:
        node_entry = update_custom_node(node_id, request.pythonCode)
        return {"message": "节点更新成功", "node": node_entry}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"更新自定义节点失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新节点失败: {str(e)}")


@router.delete("/custom/{node_id}")
async def delete_custom_node_endpoint(node_id: str):
    """删除自定义节点"""
    try:
        success = delete_custom_node(node_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"节点不存在: {node_id}")
        return {"message": "节点删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除自定义节点失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除节点失败: {str(e)}")


@router.get("/custom/{node_id}/code")
async def get_node_code_endpoint(node_id: str):
    """获取节点Python代码"""
    try:
        code = get_node_code(node_id)
        if code is None:
            raise HTTPException(status_code=404, detail=f"节点不存在: {node_id}")
        return {"code": code}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取节点代码失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取节点代码失败: {str(e)}")


@router.put("/custom/{node_id}/code")
async def update_node_code_endpoint(node_id: str, request: UpdateNodeCodeRequest):
    """更新节点Python代码（与 PUT /custom/{node_id} 相同）"""
    return await update_custom_node_endpoint(node_id, request)


class UpdateNodeParametersRequest(BaseModel):
    """更新节点参数请求"""
    inputs: Dict[str, Dict[str, Any]]
    outputs: Dict[str, Dict[str, Any]]


@router.put("/custom/{node_id}/parameters")
async def update_custom_node_parameters_endpoint(
    node_id: str,
    request: UpdateNodeParametersRequest
):
    """更新自定义节点的参数定义（只更新参数部分，保留其他代码）"""
    try:
        # 验证节点定义
        is_valid, error_msg = validate_node_definition(
            node_id,
            request.inputs,
            request.outputs
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # 更新节点参数
        node_entry = update_custom_node_parameters(
            node_id=node_id,
            inputs=request.inputs,
            outputs=request.outputs
        )
        
        logger.info(f"节点 {node_id} 的参数定义更新成功")
        return {"message": "参数定义更新成功", "node": node_entry}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"更新节点参数失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新节点参数失败: {str(e)}")


@router.put("/custom/{node_id}/full")
async def update_custom_node_full_endpoint(node_id: str, request: CreateNodeRequest):
    """更新自定义节点的完整信息（元数据+代码）"""
    try:
        # 验证节点定义
        is_valid, error_msg = validate_node_definition(
            request.nodeId,
            request.inputs,
            request.outputs
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # 如果节点ID不匹配，不允许更新
        if request.nodeId != node_id:
            raise HTTPException(status_code=400, detail="节点ID不匹配")
        
        # 转换inputs和outputs为列表格式（向后兼容代码生成器）
        inputs_list = [
            {
                'name': name,
                'isStreaming': param.get('isStreaming', False),
                'schema': param.get('schema', {})
            }
            for name, param in request.inputs.items()
        ]
        outputs_list = [
            {
                'name': name,
                'isStreaming': param.get('isStreaming', False),
                'schema': param.get('schema', {})
            }
            for name, param in request.outputs.items()
        ]
        
        # 如果提供了Python代码，使用提供的代码；否则生成代码
        # 编辑模式下，优先使用用户提供的代码
        if request.pythonCode and request.pythonCode.strip():
            python_code = request.pythonCode
            logger.debug(f"使用提供的Python代码，长度: {len(python_code)}")
        else:
            # 如果没有提供代码，生成新代码
            logger.debug("生成新的Python代码")
            python_code = generate_node_code(
                node_id=request.nodeId,
                name=request.name,
                description=request.description,
                category=request.category,
                execution_mode=request.executionMode,
                color=request.color,
                inputs=inputs_list,
                outputs=outputs_list,
                config_schema=request.configSchema
            )
        
        # 更新节点（保存为字典格式）
        node_entry = update_custom_node_full(
            node_id=node_id,
            name=request.name,
            description=request.description,
            category=request.category,
            execution_mode=request.executionMode,
            color=request.color,
            inputs=request.inputs,  # 保存为字典格式
            outputs=request.outputs,  # 保存为字典格式
            config_schema=request.configSchema,
            python_code=python_code
        )
        
        logger.info(f"节点 {node_id} 更新成功，Python文件已保存")
        return {"message": "节点更新成功", "node": node_entry}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"更新自定义节点失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新节点失败: {str(e)}")

