@echo off
REM 发布脚本 (Windows)
REM 使用方法: 编辑 VERSION 变量后运行 release.bat

setlocal enabledelayedexpansion

REM ========================================
REM 配置: 修改这里的版本号
REM ========================================
set VERSION=0.2.3
REM ========================================

echo ========================================
echo 准备发布 stream-workflow-editor v%VERSION%
echo ========================================
echo.

REM 1. 确认当前分支
echo 步骤 1: 检查当前分支...
for /f %%i in ('git branch --show-current') do set BRANCH=%%i
echo 当前分支: %BRANCH%
if not "%BRANCH%"=="main" (
    echo 警告: 不在 main 分支上！
    set /p CONTINUE="是否继续？(y/N) "
    if /i not "!CONTINUE!"=="y" exit /b 1
)
echo.

REM 2. 检查是否有未提交的更改
echo 步骤 2: 检查工作目录...
git status --porcelain > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f %%i in ('git status --porcelain ^| find /c /v ""') do set CHANGES=%%i
    if !CHANGES! GTR 0 (
        echo 发现未提交的更改：
        git status --short
        echo.
        set /p COMMIT="是否提交这些更改？(y/N) "
        if /i "!COMMIT!"=="y" (
            git add .
            set /p COMMIT_MSG="请输入提交信息: "
            git commit -m "!COMMIT_MSG!"
        ) else (
            echo 请先处理未提交的更改
            exit /b 1
        )
    )
)
echo.

REM 3. 推送到远程
echo 步骤 3: 推送到远程仓库...
git push origin %BRANCH%
if %ERRORLEVEL% NEQ 0 (
    echo 推送失败！
    exit /b 1
)
echo.

REM 4. 创建标签
echo 步骤 4: 创建版本标签...
git rev-parse v%VERSION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo 标签 v%VERSION% 已存在
    set /p DELETE_TAG="是否删除并重新创建？(y/N) "
    if /i "!DELETE_TAG!"=="y" (
        git tag -d v%VERSION%
        git push origin :refs/tags/v%VERSION%
    ) else (
        echo 跳过标签创建
        goto :end
    )
)

git tag -a v%VERSION% -m "Release v%VERSION%"
echo 标签创建成功: v%VERSION%
echo.

REM 5. 推送标签
echo 步骤 5: 推送标签到远程...
git push origin v%VERSION%
if %ERRORLEVEL% NEQ 0 (
    echo 推送标签失败！
    exit /b 1
)
echo.

:end
echo ========================================
echo 发布完成！
echo ========================================
echo.
echo 下一步：
echo 1. 访问 GitHub 创建 Release
echo    https://github.com/cnwinds/stream-workflow-editor/releases/new?tag=v%VERSION%
echo.
echo 2. 用户可以通过以下方式安装：
echo    pip install git+https://github.com/cnwinds/stream-workflow-editor.git@v%VERSION%
echo.

pause

