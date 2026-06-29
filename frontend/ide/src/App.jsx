import React, { useEffect, useState } from 'react';
import { useSocket } from './hooks/useSocket';
import { useAutoSave } from './hooks/useAutoSave';
import FileTree from './components/FileTree';
import EditorTabs from './components/EditorTabs';
import MonacoEditorComponent from './components/MonacoEditor';
import Toolbar from './components/Toolbar';
import HeartsAnimation from './components/HeartsAnimation';
import TerminalPanel from './components/TerminalPanel';

function App() {
  const [roomCode, setRoomCode] = useState('');
  const [username, setUsername] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');

  const [users, setUsers] = useState([]);
  const [fileTree, setFileTree] = useState([]);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [activeContent, setActiveContent] = useState('');
  const [remoteCursors, setRemoteCursors] = useState({});
  const [showHearts, setShowHearts] = useState(false);
  const [contentChanged, setContentChanged] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const user = params.get('user') || 'Guest' + Math.floor(Math.random() * 1000);

    if (room) {
      setRoomCode(room);
      setUsername(user);
    }
  }, []);

  const { socket, connected } = useSocket(roomCode, username);

  useAutoSave(socket, roomCode, activeFile, activeContent, contentChanged);

  useEffect(() => {
    if (!socket) return;

    socket.on('room_joined', (data) => {
      setUsers(data.users);
      fetch(`/api/rooms/${roomCode}/files`)
        .then(res => res.json())
        .then(tree => setFileTree(tree))
        .catch(console.error);
    });

    socket.on('user_joined', (data) => {
      setUsers(prev => [...prev.filter(u => u.username !== data.username), data]);
      setShowHearts(true);
      setTimeout(() => setShowHearts(false), 2000);
    });

    socket.on('user_left', (data) => {
      setUsers(prev => prev.filter(u => u.username !== data.username));
      setRemoteCursors(prev => {
        const next = { ...prev };
        delete next[data.username];
        return next;
      });
    });

    socket.on('file_content', (data) => {
      const { filePath, content } = data;
      setOpenFiles(prev => {
        if (!prev.find(f => f.path === filePath)) {
          const newFiles = [...prev, { path: filePath, content }];
          if (newFiles.length > 10) newFiles.shift();
          return newFiles;
        }
        return prev;
      });
      setActiveFile(filePath);
      setActiveContent(content);
      setContentChanged(false);
    });

    socket.on('code_update', (data) => {
      const { filePath, content } = data;
      setOpenFiles(prev => prev.map(f => f.path === filePath ? { ...f, content } : f));
      if (activeFile === filePath) {
        setActiveContent(content);
        setContentChanged(false);
      }
    });

    socket.on('cursor_update', (data) => {
      setRemoteCursors(prev => ({
        ...prev,
        [data.username]: {
          color: data.color,
          position: data.position
        }
      }));
    });

    return () => {
      socket.off('room_joined');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('file_content');
      socket.off('code_update');
      socket.off('cursor_update');
    };
  }, [socket, activeFile, roomCode]);

  const handleFileClick = (filePath) => {
    const existing = openFiles.find(f => f.path === filePath);
    if (existing) {
      setActiveFile(filePath);
      setActiveContent(existing.content);
      setContentChanged(false);
    } else {
      socket.emit('open_file', { roomCode, filePath });
    }
  };

  const handleCloseTab = (filePath) => {
    const newFiles = openFiles.filter(f => f.path !== filePath);
    setOpenFiles(newFiles);
    if (activeFile === filePath) {
      if (newFiles.length > 0) {
        setActiveFile(newFiles[newFiles.length - 1].path);
        setActiveContent(newFiles[newFiles.length - 1].content);
        setContentChanged(false);
      } else {
        setActiveFile(null);
        setActiveContent('');
      }
    }
  };

  const handleCodeChange = (newContent) => {
    setActiveContent(newContent);
    setContentChanged(true);
    setOpenFiles(prev => prev.map(f => f.path === activeFile ? { ...f, content: newContent } : f));
  };

  const handleCursorChange = (position) => {
    if (socket && roomCode) {
      socket.emit('cursor_move', { roomCode, position });
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (joinCode && joinName) {
      window.location.href = `${window.location.origin}${window.location.pathname}?room=${joinCode}&user=${encodeURIComponent(joinName)}`;
    }
  };

  if (!roomCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1e1e] text-white">
        <div className="bg-[#2d2d2d] p-8 rounded-lg shadow-xl w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-2">Join a Room</h1>
          <p className="text-gray-400 text-center mb-6">Enter a room code to join a collaborative session</p>
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Room Code</label>
              <input
                type="text"
                required
                className="w-full bg-[#1e1e1e] border border-gray-600 rounded p-2 focus:outline-none focus:border-blue-500 font-mono text-lg tracking-widest text-center uppercase"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Your Name</label>
              <input
                type="text"
                required
                className="w-full bg-[#1e1e1e] border border-gray-600 rounded p-2 focus:outline-none focus:border-blue-500"
                value={joinName}
                onChange={e => setJoinName(e.target.value)}
                placeholder="e.g. Bob"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded transition-colors"
            >
              Join Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-[#cccccc]">
      {showHearts && <HeartsAnimation />}

      <Toolbar
        roomCode={roomCode}
        users={users}
        connected={connected}
        onToggleTerminal={() => setShowTerminal(prev => !prev)}
      />

      <div className="flex flex-1 overflow-hidden border-t border-[#333]">
        <div className="w-64 flex-shrink-0 border-r border-[#333] overflow-y-auto bg-[#252526]">
          <div className="px-4 py-2 uppercase text-xs font-semibold text-gray-400 tracking-wider">Explorer</div>
          <FileTree
            tree={fileTree}
            onFileClick={handleFileClick}
            activeFile={activeFile}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {openFiles.length > 0 ? (
            <>
              <EditorTabs
                files={openFiles}
                activeFile={activeFile}
                onTabClick={(path) => {
                  const f = openFiles.find(x => x.path === path);
                  setActiveFile(path);
                  setActiveContent(f.content);
                  setContentChanged(false);
                }}
                onTabClose={handleCloseTab}
              />
              <div className="flex-1 relative">
                <MonacoEditorComponent
                  filePath={activeFile}
                  content={activeContent}
                  onChange={handleCodeChange}
                  onCursorChange={handleCursorChange}
                  remoteCursors={remoteCursors}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-6xl mb-4 opacity-20">CodeSync</div>
                <p>Select a file from the explorer to begin</p>
              </div>
            </div>
          )}

          <TerminalPanel
            roomCode={roomCode}
            socket={socket}
            visible={showTerminal}
            onClose={() => setShowTerminal(false)}
          />
        </div>
      </div>

      <div className="h-6 bg-[#007acc] text-white flex items-center px-3 text-xs justify-between">
        <div className="flex items-center space-x-4">
          <span>{connected ? '● Connected' : '○ Disconnected'}</span>
          <span>{users.length} user{users.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>{contentChanged ? '● Unsaved' : '✓ Saved'}</span>
          <span>Room: {roomCode}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
