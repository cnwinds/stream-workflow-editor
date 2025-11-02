"""
文件管理 API
管理服务器根目录下的YAML配置文件
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel

from api.services import file_service

router = APIRouter()


class FileInfo(BaseModel):
    """文件信息"""
    filename: str
    size: int
    modified: float


class CreateFileRequest(BaseModel):
    """创建文件请求"""
    filename: str
    content: dict


class UpdateFileRequest(BaseModel):
    """更新文件请求"""
    content: dict
    overwrite: bool = True


class RenameFileRequest(BaseModel):
    """重命名文件请求"""
    new_name: str


@router.get("", response_model=List[FileInfo])
async def list_files():
    """获取文件列表"""
    try:
        files = file_service.list_yaml_files()
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文件列表失败: {str(e)}")


@router.get("/{filename}", response_model=dict)
async def read_file(filename: str):
    """读取文件内容"""
    try:
        content = file_service.read_yaml_file(filename)
        return content
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取文件失败: {str(e)}")


@router.post("", response_model=FileInfo)
async def create_file(request: CreateFileRequest):
    """创建新文件"""
    try:
        # 检查文件是否已存在
        if file_service.file_exists(request.filename):
            raise HTTPException(
                status_code=409,
                detail=f"文件已存在: {request.filename}，请使用PUT方法更新或设置overwrite=true"
            )
        
        result = file_service.save_yaml_file(request.filename, request.content, overwrite=False)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建文件失败: {str(e)}")


@router.put("/{filename}", response_model=FileInfo)
async def update_file(filename: str, request: UpdateFileRequest):
    """更新文件内容（覆盖保存）"""
    try:
        result = file_service.save_yaml_file(filename, request.content, overwrite=request.overwrite)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新文件失败: {str(e)}")


@router.delete("/{filename}")
async def delete_file(filename: str):
    """删除文件"""
    try:
        file_service.delete_yaml_file(filename)
        return {"message": "文件删除成功", "filename": filename}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除文件失败: {str(e)}")


@router.post("/{filename}/rename", response_model=FileInfo)
async def rename_file(filename: str, request: RenameFileRequest):
    """重命名文件"""
    try:
        result = file_service.rename_yaml_file(filename, request.new_name)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重命名文件失败: {str(e)}")

