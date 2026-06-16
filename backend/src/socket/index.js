const prisma = require('../db');
const { getSSHClient } = require('../ssh');
const REPOS_BASE_PATH = process.env.REPOS_BASE_PATH || '/repos';

const COLORS = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#33FFF3', '#FFB833'];

module.exports = (io) => {
  io.on('connection', (socket) => {

    socket.on('join_room', async ({ roomCode, username }) => {
      try {
        const room = await prisma.room.findUnique({ where: { code: roomCode } });
        if (!room) return;

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.username = username;

        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        socket.color = color;

        await prisma.roomSession.create({
          data: {
            roomId: room.id,
            username,
            color
          }
        });

        const activeSessions = await prisma.roomSession.findMany({
          where: { roomId: room.id, leftAt: null }
        });

        const users = activeSessions.map(s => ({ username: s.username, color: s.color }));

        socket.emit('room_joined', { users, language: room.language });

        socket.to(roomCode).emit('user_joined', { username, color });
      } catch (err) {
        console.error('Error joining room:', err);
      }
    });

    socket.on('open_file', async ({ roomCode, filePath }) => {
      try {
        const room = await prisma.room.findUnique({ where: { code: roomCode } });
        if (!room) return;

        const snapshot = await prisma.fileSnapshot.findUnique({
          where: { roomId_filePath: { roomId: room.id, filePath } }
        });

        if (snapshot && snapshot.content) {
          socket.emit('file_content', { filePath, content: snapshot.content });
        } else {
          const repoPath = `${REPOS_BASE_PATH}/${roomCode}/${filePath}`;
          const ssh = await getSSHClient();
          const result = await ssh.execCommand(`cat ${repoPath}`);
          ssh.dispose();

          if (result.code === 0) {
            socket.emit('file_content', { filePath, content: result.stdout });
          }
        }
      } catch (err) {
        console.error('Error opening file:', err);
      }
    });

    socket.on('code_change', async ({ roomCode, filePath, content }) => {
      try {
        const room = await prisma.room.findUnique({ where: { code: roomCode } });
        if (!room) return;

        await prisma.fileSnapshot.upsert({
          where: { roomId_filePath: { roomId: room.id, filePath } },
          update: { content, updatedAt: new Date() },
          create: { roomId: room.id, filePath, content }
        });

        const repoPath = `${REPOS_BASE_PATH}/${roomCode}/${filePath}`;
        const ssh = await getSSHClient();
        const contentBase64 = Buffer.from(content).toString('base64');
        await ssh.execCommand(`echo "${contentBase64}" | base64 -d > ${repoPath}`);
        ssh.dispose();

        socket.to(roomCode).emit('code_update', { filePath, content });
      } catch (err) {
        console.error('Error handling code change:', err);
      }
    });

    socket.on('cursor_move', ({ roomCode, position }) => {
      socket.to(roomCode).emit('cursor_update', { username: socket.username, color: socket.color, position });
    });

    socket.on('language_change', async ({ roomCode, language }) => {
      try {
        await prisma.room.update({
          where: { code: roomCode },
          data: { language }
        });
        io.to(roomCode).emit('language_update', { language });
      } catch (err) {
        console.error('Error changing language:', err);
      }
    });

    socket.on('run_command', async ({ roomCode, command }) => {
      try {
        const repoPath = `${REPOS_BASE_PATH}/${roomCode}`;
        const ssh = await getSSHClient();
        
        socket.emit('terminal_started'); // Signal frontend that stream started

        await ssh.execCommand(command, { 
          cwd: repoPath,
          onStdout(chunk) {
            socket.emit('terminal_output', { stdout: chunk.toString('utf8') });
          },
          onStderr(chunk) {
            socket.emit('terminal_output', { stderr: chunk.toString('utf8') });
          }
        });
        
        socket.emit('terminal_output', { stdout: '\n[Process completed]\n' });
        ssh.dispose();
      } catch (err) {
        socket.emit('terminal_output', {
          stdout: '',
          stderr: `\nError: ${err.message}\n`
        });
      }
    });

    socket.on('cancel_command', async ({ roomCode }) => {
      try {
        const ssh = await getSSHClient();
        // Force kill any processes whose command line contains the room's path
        await ssh.execCommand(`pkill -9 -f "${REPOS_BASE_PATH}/${roomCode}" || true`);
        ssh.dispose();
        io.to(roomCode).emit('terminal_output', { stderr: '\n[Command cancelled by user]\n' });
      } catch (err) {
        console.error('Error canceling command:', err);
      }
    });

    const handleDisconnect = async () => {
      if (socket.roomCode && socket.username) {
        try {
          const room = await prisma.room.findUnique({ where: { code: socket.roomCode } });
          if (room) {
            await prisma.roomSession.updateMany({
              where: { roomId: room.id, username: socket.username, leftAt: null },
              data: { leftAt: new Date() }
            });
          }
          io.to(socket.roomCode).emit('user_left', { username: socket.username });
        } catch (err) {
          console.error('Error handling disconnect:', err);
        }
      }
    };

    socket.on('leave_room', handleDisconnect);
    socket.on('disconnect', handleDisconnect);
  });
};
