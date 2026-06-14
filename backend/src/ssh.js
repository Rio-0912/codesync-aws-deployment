const { NodeSSH } = require('node-ssh');
require('dotenv').config();

const getSSHClient = async () => {
  const ssh = new NodeSSH();
  await ssh.connect({
    host: process.env.FRONTEND_HOST,
    username: process.env.FRONTEND_SSH_USER,
    privateKey: Buffer.from(process.env.SSH_PRIVATE_KEY || '', 'base64').toString('ascii'),
  });
  return ssh;
};

module.exports = { getSSHClient };
