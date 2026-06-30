import React from 'react';
import { X } from 'lucide-react';

const EditorTabs = ({ files, activeFile, onTabClick, onTabClose }) => {
  return (
    <div className="flex bg-[#252526] overflow-x-auto select-none no-scrollbar">
      {files.map(file => {
        const isActive = activeFile === file.path;
        const filename = file.path.split('/').pop();
        
        return (
          <div 
            key={file.path}
            onClick={() => onTabClick(file.path)}
            className={`flex items-center h-9 px-3 border-r border-[#1e1e1e] cursor-pointer min-w-fit max-w-[200px] group ${
              isActive 
                ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]' 
                : 'bg-[#2d2d2d] text-gray-400 hover:bg-[#2b2b2b]'
            }`}
          >
            <span className="truncate mr-2 text-sm">{filename}</span>
            <div 
              className={`p-0.5 rounded-md hover:bg-[#444] ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(file.path);
              }}
            >
              <X size={14} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default EditorTabs;
