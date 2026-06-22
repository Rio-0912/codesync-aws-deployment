import React, { useState } from 'react';
import { createRoom } from '../api';
import { motion, AnimatePresence } from 'framer-motion';

const LandingPage = () => {
  const [username, setUsername] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHearts, setShowHearts] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [activeTab, setActiveTab] = useState('create');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await createRoom(username, repoUrl);
      setShowHearts(true);

      setTimeout(() => {
        const idePort = '30002';
        const hostname = window.location.hostname;
        window.location.href = `http://${hostname}:${idePort}?room=${data.roomCode}&user=${encodeURIComponent(username)}`;
      }, 1500);

    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred while creating the session.');
      setLoading(false);
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (joinCode && joinName) {
      const idePort = '30002';
      const hostname = window.location.hostname;
      window.location.href = `http://${hostname}:${idePort}?room=${joinCode}&user=${encodeURIComponent(joinName)}`;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1e1e1e] text-white overflow-hidden relative">
      <AnimatePresence>
        {showHearts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none flex items-center justify-center text-6xl"
          >
            💖 🚀 ✨
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-[#2d2d2d] p-8 rounded-lg shadow-xl w-full max-w-md z-10">
        <h1 className="text-3xl font-bold text-center mb-2">CodeSync</h1>
        <p className="text-gray-400 text-center mb-6">Real-time collaborative code editor</p>

        <div className="flex mb-6 bg-[#1e1e1e] rounded-lg overflow-hidden">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === 'create' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Create Room
          </button>
          <button
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === 'join' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Join Room
          </button>
        </div>

        {error && <div className="bg-red-500/20 border border-red-500 text-red-100 p-3 rounded mb-4">{error}</div>}

        {activeTab === 'create' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                required
                className="w-full bg-[#1e1e1e] border border-gray-600 rounded p-2 focus:outline-none focus:border-blue-500"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. Alex"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Public GitHub Repo URL</label>
              <input
                type="url"
                required
                className="w-full bg-[#1e1e1e] border border-gray-600 rounded p-2 focus:outline-none focus:border-blue-500"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
            >
              {loading ? 'Setting up repository...' : 'Start My Session'}
            </button>
          </form>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default LandingPage;
