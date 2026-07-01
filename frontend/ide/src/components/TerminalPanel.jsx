import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';

const TerminalPanel = ({ roomCode, socket, visible, onClose }) => {
  const [output, setOutput] = useState([
    { type: 'info', text: `🖥️  Terminal connected to room ${roomCode}` },
    { type: 'info', text: 'Type commands and press Enter. Commands run on the remote server.' },
  ]);
  const [command, setCommand] = useState('');
  const [running, setRunning] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output]);

  useEffect(() => {
    if (!socket) return;

    socket.on('terminal_started', () => {
      setRunning(true);
    });

    socket.on('terminal_output', (data) => {
      if (data.stdout) {
        setOutput(prev => [...prev, { type: 'stdout', text: data.stdout }]);
      }
      if (data.stderr) {
        setOutput(prev => [...prev, { type: 'stderr', text: data.stderr }]);
      }
      if (data.stdout?.includes('[Process completed]') || data.stderr?.includes('[Command cancelled by user]')) {
        setRunning(false);
      }
    });

    return () => {
      socket.off('terminal_started');
      socket.off('terminal_output');
    };
  }, [socket]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!command.trim() || !socket) return;

    setOutput(prev => [...prev, { type: 'cmd', text: `$ ${command}` }]);
    setRunning(true);

    socket.emit('run_command', { roomCode, command: command.trim() });
    setCommand('');
  };

  const handleCancel = () => {
    if (socket && running) {
      socket.emit('cancel_command', { roomCode });
    }
  };

  if (!visible) return null;

  return (
    <div className="h-64 bg-[#1a1a1a] border-t border-[#333] flex flex-col">
      <div className="h-8 bg-[#2d2d2d] flex items-center justify-between px-3 text-xs text-gray-400 border-b border-[#333]">
        <div className="flex items-center space-x-2">
          <span className="text-white font-medium">TERMINAL</span>
          <span className="text-gray-500">room: {roomCode}</span>
        </div>
        <div className="flex items-center space-x-3">
          {running && (
            <button onClick={handleCancel} className="text-red-400 hover:text-red-300 font-medium">
              Cancel (Ctrl+C)
            </button>
          )}
          <button onClick={onClose} className="hover:text-white">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-mono text-sm space-y-1">
        {output.map((line, i) => (
          <div
            key={i}
            className={
              line.type === 'cmd' ? 'text-green-400' :
              line.type === 'stderr' ? 'text-red-400' :
              line.type === 'info' ? 'text-blue-400' :
              'text-gray-300'
            }
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          >
            {line.text}
          </div>
        ))}
        {running && <div className="text-yellow-400 animate-pulse mt-2">Running...</div>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex items-center border-t border-[#333]">
        <span className="text-green-400 text-sm font-mono px-3">$</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          className="flex-1 bg-transparent text-white text-sm font-mono py-2 pr-3 outline-none"
          placeholder="Type a command..."
          disabled={running}
          autoFocus
        />
      </form>
    </div>
  );
};

export default TerminalPanel;
