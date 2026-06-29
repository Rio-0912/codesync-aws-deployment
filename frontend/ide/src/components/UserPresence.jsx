import React from 'react';

const UserPresence = ({ username, color }) => {
  // Extract initials
  const initials = username.substring(0, 2).toUpperCase();

  return (
    <div 
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-[#333] relative group"
      style={{ backgroundColor: color }}
      title={username}
    >
      {initials}
    </div>
  );
};

export default UserPresence;
