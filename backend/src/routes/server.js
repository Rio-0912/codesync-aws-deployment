const express = require('express');
const { getSSHClient } = require('../ssh');
const router = express.Router();

const REPOS_BASE_PATH = process.env.REPOS_BASE_PATH || '/repos';
const FRONTEND_IP = process.env.FRONTEND_PUBLIC_IP || process.env.FRONTEND_HOST;

router.post('/:code/start-server', async (req, res) => {
  const { code } = req.params;
  const repoPath = `${REPOS_BASE_PATH}/${code}`;

  try {
    const ssh = await getSSHClient();
    
    // Kill existing process on port 3000
    await ssh.execCommand(`fuser -k 3000/tcp || true`);
    
    // Install pnpm if not exists, then install dependencies and start server
    const cmd = `cd ${repoPath} && if ! command -v pnpm &> /dev/null; then npm install -g pnpm; fi && pnpm install --silent && nohup pnpm start > next.log 2>&1 &`;
    await ssh.execCommand(cmd);
    
    // Wait briefly for server to potentially start listening
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    ssh.dispose();

    // The actual frontend IP accessed by user will be derived by client, but we provide a hint
    res.json({ url: `http://${FRONTEND_IP}:3000`, status: 'running' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
