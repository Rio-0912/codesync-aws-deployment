import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';

const getLanguageFromPath = (path) => {
  if (!path) return 'plaintext';
  const ext = path.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx': return 'javascript';
    case 'ts':
    case 'tsx': return 'typescript';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'json': return 'json';
    case 'py': return 'python';
    case 'java': return 'java';
    case 'c':
    case 'cpp': return 'cpp';
    case 'md': return 'markdown';
    default: return 'plaintext';
  }
};

const MonacoEditorComponent = ({ filePath, content, onChange, onCursorChange, remoteCursors }) => {
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition((e) => {
      onCursorChange({
        lineNumber: e.position.lineNumber,
        column: e.position.column
      });
    });
  };

  useEffect(() => {
    if (!editorRef.current || !remoteCursors) return;

    // Inject styles for cursors dynamically
    const styleId = 'dynamic-cursors';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    let css = '';
    const newDecorations = [];

    Object.entries(remoteCursors).forEach(([username, cursor], index) => {
      const className = `cursor-${username.replace(/[^a-zA-Z0-9]/g, '')}`;
      
      css += `
        .${className} {
          border-left: 2px solid ${cursor.color};
          position: relative;
        }
        .${className}::after {
          content: '${username}';
          position: absolute;
          top: -16px;
          left: 0;
          background-color: ${cursor.color};
          color: white;
          font-size: 10px;
          padding: 1px 4px;
          border-radius: 2px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 100;
        }
      `;

      newDecorations.push({
        range: new monaco.Range(
          cursor.position.lineNumber,
          cursor.position.column,
          cursor.position.lineNumber,
          cursor.position.column
        ),
        options: { className }
      });
    });

    styleEl.innerHTML = css;

    if (editorRef.current.getModel()) {
      decorationsRef.current = editorRef.current.deltaDecorations(
        decorationsRef.current,
        newDecorations
      );
    }

  }, [remoteCursors]);

  return (
    <Editor
      height="100%"
      language={getLanguageFromPath(filePath)}
      value={content}
      theme="vs-dark"
      onChange={onChange}
      onMount={handleEditorDidMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: 'on',
        automaticLayout: true,
        scrollBeyondLastLine: false,
      }}
    />
  );
};

export default MonacoEditorComponent;
