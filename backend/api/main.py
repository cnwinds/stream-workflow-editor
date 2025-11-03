"""
FastAPI 后端服务入口
为 stream-workflow 提供 REST API 接口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from api.routes import workflow, validate, execute, nodes, files
from api.config import config

app = FastAPI(
    title="Stream Workflow API",
    description="流式工作流引擎 API",
    version="0.1.0",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
async def root():
    return {"message": "Stream Workflow API", "version": "0.1.0"}


@app.get("/api/health")
async def health():
    """健康检查端点"""
    health_info = {
        "status": "ok",
        "custom_nodes_dir": None,
    }
    
    try:
        if config.is_initialized():
            health_info["custom_nodes_dir"] = str(config.get_custom_nodes_dir())
    except Exception:
        pass
    
    return health_info


if __name__ == "__main__":
    # 如果直接运行 main.py，使用默认配置初始化
    if not config.is_initialized():
        config.initialize()
    
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host=config.get_host(),
        port=config.get_port(),
        reload=True
    )

