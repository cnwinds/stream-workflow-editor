"""
FastAPI 后端服务入口
为 stream-workflow 提供 REST API 接口
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import uvicorn

from .routes import workflow, validate, execute, nodes, files
from .config import config

app = FastAPI(
    title="Stream Workflow API",
    description="流式工作流引擎 API",
    version="0.1.0",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(workflow.router, prefix="/api/workflows", tags=["工作流管理"])
app.include_router(validate.router, prefix="/api", tags=["配置验证"])
app.include_router(execute.router, prefix="/api/execute", tags=["执行控制"])
app.include_router(nodes.router, prefix="/api/nodes", tags=["节点信息"])
app.include_router(files.router, prefix="/api/files", tags=["文件管理"])

@app.get("/")
async def root(request: Request):
    """根路径：如果是浏览器请求返回前端，否则返回 API 信息"""
    # 检查是否有静态文件（生产模式）
    static_dir = Path(__file__).parent.parent / "static"
    if static_dir.exists() and (static_dir / "index.html").exists():
        # 生产模式：返回前端首页
        index_path = static_dir / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
    
    # 开发模式：返回 API 信息
    return {"message": "Stream Workflow API", "version": "0.1.0"}

# 静态文件服务（生产模式）
static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists() and (static_dir / "index.html").exists():
    # 挂载静态资源目录
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    # SPA 路由：所有非 API 路由返回 index.html（必须放在最后）
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """服务前端应用（SPA 路由）"""
        # 忽略 API 路由（应该已经被上面的路由处理了）
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        
        # 忽略静态资源（已经被 mount 处理了）
        if full_path.startswith("assets/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        
        # 其他路由返回 index.html（SPA 路由）
        index_path = static_dir / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        return JSONResponse({"detail": "Not Found"}, status_code=404)


@app.get("/api/health")
async def health():
    """健康检查端点"""
    health_info = {
        "status": "ok",
        "custom_nodes_dir": None,
        "workflow_files_dir": None,
    }
    
    try:
        if config.is_initialized():
            health_info["custom_nodes_dir"] = str(config.get_custom_nodes_dir())
            # 获取工作流文件目录
            from .services.file_service import get_yaml_directory
            health_info["workflow_files_dir"] = str(get_yaml_directory())
    except Exception:
        pass
    
    return health_info


if __name__ == "__main__":
    # 如果直接运行 main.py，使用默认配置初始化
    if not config.is_initialized():
        config.initialize()
    
    import uvicorn
    uvicorn.run(
        "stream_workflow_editor.api.main:app",
        host=config.get_host(),
        port=config.get_port(),
        reload=True
    )

