const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const setupSocket = require('./socket');
const roomsRouter = require('./routes/rooms');
const serverRouter = require('./routes/server');
const deployRouter = require('./routes/deploy');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.use('/api/rooms', roomsRouter);
app.use('/api/rooms', serverRouter);
app.use('/api/deploy', deployRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

setupSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
