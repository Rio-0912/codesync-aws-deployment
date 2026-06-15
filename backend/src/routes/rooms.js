const express = require('express');
const crypto = require('crypto');
const prisma = require('../db');
const { getSSHClient } = require('../ssh');
const router = express.Router();

const REPOS_BASE_PATH = process.env.REPOS_BASE_PATH || '/repos';

const generateRoomCode = () => {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
};

const buildFileTree = (listing, basePath) => {
  const root = [];
  const lines = listing.split('\n').filter(l => l.trim());
  
  lines.forEach(line => {
    const relativePath = line.replace(basePath + '/', '');
    if (relativePath.includes('.git/') || relativePath.includes('node_modules/') || relativePath.includes('.next/') || relativePath.includes('dist/') || relativePath.includes('build/')) return;
    
    const parts = relativePath.split('/');
    let currentLevel = root;
    
    parts.forEach((part, index) => {
      let existingNode = currentLevel.find(n => n.name === part);
      
      if (!existingNode) {
        existingNode = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          type: index === parts.length - 1 ? 'file' : 'dir',
        };
        if (existingNode.type === 'dir') {
          existingNode.children = [];
        }
        currentLevel.push(existingNode);
      }
      
      if (existingNode.type === 'dir') {
        currentLevel = existingNode.children;
      }
    });
  });
  
  return root;
};

router.post('/', async (req, res) => {
  const { repoUrl, username } = req.body;
  if (!repoUrl || !username) {
    return res.status(400).json({ error: 'repoUrl and username are required' });
  }

  const roomCode = generateRoomCode();
  const repoPath = `${REPOS_BASE_PATH}/${roomCode}`;

  try {
    const ssh = await getSSHClient();
    
    // Create repos base path just in case
    await ssh.execCommand(`sudo mkdir -p ${REPOS_BASE_PATH} && sudo chown -R ubuntu:ubuntu ${REPOS_BASE_PATH}`);
    
    // Clone repo
    const cloneResult = await ssh.execCommand(`git clone ${repoUrl} ${repoPath}`);
    if (cloneResult.code !== 0 && cloneResult.stderr.includes('fatal')) {
      ssh.dispose();
      return res.status(400).json({ error: 'Failed to clone repository. Make sure it is public.', details: cloneResult.stderr });
    }

    // Get file listing
    const listResult = await ssh.execCommand(`find ${repoPath} -type f | sort`);
    const fileTree = buildFileTree(listResult.stdout, repoPath);
    
    ssh.dispose();

    await prisma.room.create({
      data: {
        code: roomCode,
        repoUrl,
      }
    });

    res.json({ roomCode, fileTree });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const room = await prisma.room.findUnique({
      where: { code },
      include: {
        sessions: {
          where: { leftAt: null }
        }
      }
    });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:code/files', async (req, res) => {
  const { code } = req.params;
  const repoPath = `${REPOS_BASE_PATH}/${code}`;
  try {
    const ssh = await getSSHClient();
    const listResult = await ssh.execCommand(`find ${repoPath} -type f | sort`);
    const fileTree = buildFileTree(listResult.stdout, repoPath);
    ssh.dispose();
    
    res.json(fileTree);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:code/file', async (req, res) => {
  const { code } = req.params;
  const { path: filePath } = req.query;
  const repoPath = `${REPOS_BASE_PATH}/${code}/${filePath}`;

  try {
    const ssh = await getSSHClient();
    const result = await ssh.execCommand(`cat ${repoPath}`);
    ssh.dispose();
    
    if (result.code !== 0) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    res.json({ content: result.stdout });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:code/file', async (req, res) => {
  const { code } = req.params;
  const { filePath, content } = req.body;
  const repoPath = `${REPOS_BASE_PATH}/${code}/${filePath}`;

  try {
    const room = await prisma.room.findUnique({ where: { code } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Save to DB
    await prisma.fileSnapshot.upsert({
      where: {
        roomId_filePath: {
          roomId: room.id,
          filePath
        }
      },
      update: { content, updatedAt: new Date() },
      create: { roomId: room.id, filePath, content }
    });

    // Save to disk
    const ssh = await getSSHClient();
    // Use base64 to avoid issues with special characters in echo
    const contentBase64 = Buffer.from(content).toString('base64');
    await ssh.execCommand(`echo "${contentBase64}" | base64 -d > ${repoPath}`);
    ssh.dispose();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
