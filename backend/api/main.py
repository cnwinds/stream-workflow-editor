"""
FastAPI 后端服务入口
为 stream-workflow 提供 REST API 接口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from api.routes import workflow, validate, execute, nodes

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


@app.get("/")
async def root():
    return {"message": "Stream Workflow API", "version": "0.1.0"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)

