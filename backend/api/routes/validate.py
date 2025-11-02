"""
配置验证 API
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from api.services.workflow_service import workflow_service

router = APIRouter()


class ValidationError(BaseModel):
    nodeId: Optional[str] = None
    message: str
    field: Optional[str] = None


class ValidationRequest(BaseModel):
    workflow: dict


class ValidationResponse(BaseModel):
    valid: bool
    errors: Optional[List[ValidationError]] = None


@router.post("/validate", response_model=ValidationResponse)
async def validate_workflow(request: ValidationRequest):
    """验证工作流配置"""
    try:
        # 构建完整的配置字典
        config = {"workflow": request.workflow}
        
        # 使用 stream-workflow 引擎验证
        is_valid, errors = await workflow_service.validate_config(config)
        
        # 转换为 API 响应格式
        validation_errors = [
            ValidationError(
                nodeId=err.get("nodeId"),
                message=err.get("message", ""),
                field=err.get("field")
            )
            for err in errors
        ]
        
        return ValidationResponse(
            valid=is_valid,
            errors=validation_errors if validation_errors else None,
        )
    except Exception as e:
        # 如果验证过程出错，返回错误
        return ValidationResponse(
            valid=False,
            errors=[ValidationError(message=f"验证失败: {str(e)}")],
        )
