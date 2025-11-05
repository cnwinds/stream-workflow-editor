import React from 'react'
import './ConnectionContextMenu.css'

interface ConnectionContextMenuProps {
  x: number
  y: number
  onSelect: () => void
  onClose: () => void
}

const ConnectionContextMenu: React.FC<ConnectionContextMenuProps> = ({
  x,
  y,
  onSelect,
  onClose,
}) => {
  React.useEffect(() => {
    const handleClickOutside = () => {
      onClose()
    }
    
    // 延迟添加事件监听，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
    
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [onClose])

  return (
    <div
      className="connection-context-menu"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 1000,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="connection-context-menu-item"
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
          onClose()
        }}
      >
        创建输入参数并连接
      </div>
    </div>
  )
}

export default ConnectionContextMenu

