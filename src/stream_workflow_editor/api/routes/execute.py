"""
执行控制 API
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
from datetime import datetime
from ..services.workflow_service import workflow_service

router = APIRouter()


class ExecuteRequest(BaseModel):
    config: Dict[str, Any]
    initialData: Optional[Dict[str, Any]] = None


class ExecutionStatus(BaseModel):
    id: str
    status: str  # pending, running, completed, failed, stopped
    message: Optional[str] = None
    createdAt: str
    updatedAt: str


@router.post("", response_model=ExecutionStatus)
async def execute_workflow(request: ExecuteRequest):
    """执行工作流"""
    execution_id = str(uuid.uuid4())
    created_at = datetime.now().isoformat()
    
    try:
        # 使用 stream-workflow 引擎执行
        result = await workflow_service.execute_workflow(
            execution_id=execution_id,
            config=request.config,
            initial_data=request.initialData
        )
        
        execution_info = workflow_service.get_execution_status(execution_id)
        
        return ExecutionStatus(
            id=execution_id,
            status=execution_info.get("status", "running") if execution_info else "running",
            message=result.get("message"),
            createdAt=created_at,
            updatedAt=datetime.now().isoformat(),
        )
    except Exception as e:
        # 如果执行失败，返回错误状态
        return ExecutionStatus(
            id=execution_id,
            status="failed",
            message=f"执行失败: {str(e)}",
            createdAt=created_at,
            updatedAt=datetime.now().isoformat(),
        )


@router.get("/{execution_id}/status", response_model=ExecutionStatus)
async def get_execution_status(execution_id: str):
    """查询执行状态"""
    execution_info = workflow_service.get_execution_status(execution_id)
    
    if not execution_info:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    
    # 获取最新的执行时间
    updated_at = execution_info.get("updatedAt", datetime.now().isoformat())
    if "createdAt" not in execution_info:
        execution_info["createdAt"] = datetime.now().isoformat()
    
    return ExecutionStatus(
        id=execution_info["id"],
        status=execution_info.get("status", "unknown"),
        message=execution_info.get("error") or execution_info.get("message"),
        createdAt=execution_info.get("createdAt", datetime.now().isoformat()),
        updatedAt=updated_at,
    )


@router.post("/{execution_id}/stop")
async def stop_execution(execution_id: str):
    """停止执行"""
    success = await workflow_service.stop_workflow(execution_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    
    execution_info = workflow_service.get_execution_status(execution_id)
    
    return {
        "message": "执行已停止",
        "execution_id": execution_id,
        "status": execution_info.get("status", "stopped") if execution_info else "stopped",
    }

