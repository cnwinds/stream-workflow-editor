"""
日志配置模块
提供统一的日志记录功能
"""
import logging
import sys
from pathlib import Path
from typing import Optional


def setup_logger(
    name: str = "stream_workflow_editor",
    level: Optional[int] = None,
    log_file: Optional[Path] = None
) -> logging.Logger:
    """
    设置并返回日志记录器
    
    Args:
        name: 日志记录器名称
        level: 日志级别（默认从环境变量 LOG_LEVEL 读取，或使用 INFO）
        log_file: 日志文件路径（可选，如果指定则同时输出到文件）
    
    Returns:
        配置好的日志记录器
    """
    import os
    
    logger = logging.getLogger(name)
    
    # 如果已经配置过，直接返回
    if logger.handlers:
        return logger
    
    # 设置日志级别
    if level is None:
        level_str = os.getenv("LOG_LEVEL", "INFO").upper()
        level = getattr(logging, level_str, logging.INFO)
    
    logger.setLevel(level)
    
    # 日志格式
    formatter = logging.Formatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 文件处理器（如果指定）
    if log_file:
        log_file = Path(log_file)
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    # 防止日志传播到父记录器
    logger.propagate = False
    
    return logger


# 创建默认日志记录器
logger = setup_logger()

