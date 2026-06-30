import { useEffect, useRef } from 'react';

export const useAutoSave = (socket, roomCode, activeFile, fileContent, contentChanged) => {
  const lastSavedContent = useRef(fileContent);

  useEffect(() => {
    if (!socket || !roomCode || !activeFile || !contentChanged) return;

    const saveInterval = setInterval(() => {
      if (lastSavedContent.current !== fileContent) {
        socket.emit('code_change', {
          roomCode,
          filePath: activeFile,
          content: fileContent
        });
        lastSavedContent.current = fileContent;
      }
    }, 5000);

    return () => clearInterval(saveInterval);
  }, [socket, roomCode, activeFile, fileContent, contentChanged]);
};
