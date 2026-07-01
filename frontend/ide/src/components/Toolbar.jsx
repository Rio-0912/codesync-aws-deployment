import React, { useState } from 'react';
import { Play, Copy, ExternalLink, Activity, Check, Terminal } from 'lucide-react';
import { startServer } from '../api';
import UserPresence from './UserPresence';

const Toolbar = ({ roomCode, users, connected, onToggleTerminal }) => {
  const [serverStatus, setServerStatus] = useState('idle');
  const [serverUrl, setServerUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyJoinLink = () => {
    const link = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard.writeText(link);
  };

  const handleStartServer = async () => {
    try {
      setServerStatus('starting');
      setServerError('');
      const data = await startServer(roomCode);
      setServerUrl(data.url);
      setServerStatus('running');
    } catch (err) {
      console.error(err);
      setServerError(err.response?.data?.error || 'Failed to start server');
      setServerStatus('error');
    }
  };

  const jenkinsUrl = `http://${window.location.hostname}:30080`;

  return (
    <div className="h-12 bg-[#333] flex items-center px-4 justify-between select-none">
      <div className="flex items-center space-x-4">
        <div
          onClick={handleCopyCode}
          className="bg-[#1e1e1e] hover:bg-[#444] text-gray-300 px-3 py-1 rounded cursor-pointer flex items-center space-x-2 text-sm border border-[#555] transition-colors"
          title="Click to copy room code"
        >
          <span className="font-mono text-blue-400">{roomCode}</span>
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </div>

        <div
          onClick={handleCopyJoinLink}
          className="bg-[#1e1e1e] hover:bg-[#444] text-gray-300 px-3 py-1 rounded cursor-pointer flex items-center space-x-2 text-sm border border-[#555] transition-colors"
          title="Copy join link for collaborators"
        >
          <span className="text-xs">📎 Join Link</span>
        </div>

        <div className="flex -space-x-2 overflow-hidden">
          {users.map((user, i) => (
            <UserPresence key={i} username={user.username} color={user.color} />
          ))}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {serverStatus === 'running' && serverUrl && (
          <a
            href={serverUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center text-sm text-green-400 hover:text-green-300 mr-2"
          >
            Server running <ExternalLink size={14} className="ml-1" />
          </a>
        )}

        {serverStatus === 'error' && serverError && (
          <span className="text-red-400 text-xs mr-2">{serverError}</span>
        )}

        <button
          onClick={onToggleTerminal}
          className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm font-medium transition-colors bg-[#555] hover:bg-[#666] text-white"
          title="Toggle Terminal"
        >
          <Terminal size={16} />
          <span>Terminal</span>
        </button>

        <button
          onClick={handleStartServer}
          disabled={serverStatus === 'starting'}
          className={`flex items-center space-x-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            serverStatus === 'starting'
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : serverStatus === 'error'
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-green-600 hover:bg-green-500 text-white'
          }`}
        >
          {serverStatus === 'starting' ? <Activity size={16} className="animate-pulse" /> : <Play size={16} />}
          <span>{serverStatus === 'starting' ? 'Starting...' : serverStatus === 'error' ? 'Retry Start' : 'Start Server'}</span>
        </button>

        <button
          onClick={async () => {
            try {
              alert('Deploying to Jenkins! Build started. App will soon be available at port 4567.');
              await fetch('/api/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomCode })
              });
            } catch(e) {
              console.error(e);
              alert('Failed to trigger deploy');
            }
          }}
          className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
        >
          <ExternalLink size={16} />
          <span>Deploy to Jenkins</span>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
