const express = require('express');
const router = express.Router();
const prisma = require('../db');

router.post('/', async (req, res) => {
  const { roomCode } = req.body;
  if (!roomCode) {
    return res.status(400).json({ error: 'roomCode is required' });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: roomCode } });
    if (!room || !room.repoUrl) {
      return res.status(400).json({ error: 'Room not found or no GitHub URL attached' });
    }

    const authHeader = 'Basic ' + Buffer.from('root:root').toString('base64');
    
    // Use the Groovy script endpoint to trigger the build with parameters.
    // This is more robust than buildWithParameters which can have mapping issues.
    const script = `
def job = Jenkins.instance.getItem('codesync-build')
def params = [
    new hudson.model.StringParameterValue('REPO_URL', '${room.repoUrl}'),
    new hudson.model.StringParameterValue('BRANCH', 'master'),
    new hudson.model.StringParameterValue('ROOM_CODE', '${roomCode}')
]
job.scheduleBuild2(0, new hudson.model.ParametersAction(params))
println 'Build Triggered'
`;

    const jenkinsUrl = process.env.JENKINS_URL || 'http://jenkins-service:8080';
    const response = await fetch(`${jenkinsUrl}/scriptText`, { 
      method: 'POST',
      headers: { 
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `script=${encodeURIComponent(script)}`
    });
    
    if (response.ok) {
      res.json({ message: 'Deployment triggered successfully', status: response.status });
    } else {
      const text = await response.text();
      console.error(`Jenkins API failed with status ${response.status}: ${text}`);
      res.status(500).json({ error: 'Failed to trigger Jenkins', details: text });
    }

  } catch (error) {
    console.error('Deploy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
