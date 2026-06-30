import React, { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';

const FileTreeNode = ({ node, onFileClick, activeFile, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isDir = node.type === 'dir';
  const isActive = activeFile === node.path;

  const handleClick = () => {
    if (isDir) {
      setIsOpen(!isOpen);
    } else {
      onFileClick(node.path);
    }
  };

  return (
    <div>
      <div 
        className={`flex items-center py-1 px-2 cursor-pointer select-none text-sm hover:bg-[#2a2d2e] ${isActive ? 'bg-[#37373d] text-white' : 'text-[#cccccc]'}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isDir ? (
          isOpen ? <ChevronDown size={14} className="mr-1" /> : <ChevronRight size={14} className="mr-1" />
        ) : (
          <File size={14} className="mr-1 ml-4 text-[#519aba]" />
        )}
        <span className="truncate">{node.name}</span>
      </div>
      
      {isDir && isOpen && node.children && (
        <div>
          {node.children.map((child, i) => (
            <FileTreeNode 
              key={i} 
              node={child} 
              onFileClick={onFileClick} 
              activeFile={activeFile}
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree = ({ tree, onFileClick, activeFile }) => {
  if (!tree || tree.length === 0) {
    return <div className="p-4 text-gray-500 text-sm">No files found. Wait for clone or check repo URL.</div>;
  }

  // Sort: directories first, then files
  const sortedTree = [...tree].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'dir' ? -1 : 1;
  });

  return (
    <div className="py-2">
      {sortedTree.map((node, i) => (
        <FileTreeNode 
          key={i} 
          node={node} 
          onFileClick={onFileClick} 
          activeFile={activeFile} 
        />
      ))}
    </div>
  );
};

export default FileTree;
