"""
工作流管理 API
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter()

# 临时存储（生产环境应使用数据库）
workflows_store: dict[str, dict] = {}


class WorkflowConfig(BaseModel):
    workflow: dict


class WorkflowResponse(BaseModel):
    id: str
    name: str
    config: dict


@router.get("", response_model=List[WorkflowResponse])
async def get_workflows():
    """获取工作流列表"""
    return [
        WorkflowResponse(id=k, name=v.get("workflow", {}).get("name", ""), config=v)
        for k, v in workflows_store.items()
    ]


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str):
    """获取单个工作流"""
    if workflow_id not in workflows_store:
        raise HTTPException(status_code=404, detail="工作流不存在")
    return WorkflowResponse(
        id=workflow_id,
        name=workflows_store[workflow_id].get("workflow", {}).get("name", ""),
        config=workflows_store[workflow_id],
    )


@router.post("", response_model=WorkflowResponse)
async def save_workflow(config: WorkflowConfig):
    """创建或更新工作流"""
    workflow_name = config.workflow.get("name", "未命名工作流")
    # 使用工作流名称作为 ID（实际应用中应使用 UUID）
    workflow_id = workflow_name.replace(" ", "_").lower()
    
    workflows_store[workflow_id] = config.workflow
    
    return WorkflowResponse(
        id=workflow_id,
        name=workflow_name,
        config=config.workflow,
    )


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str):
    """删除工作流"""
    if workflow_id not in workflows_store:
        raise HTTPException(status_code=404, detail="工作流不存在")
    del workflows_store[workflow_id]
    return {"message": "删除成功"}


