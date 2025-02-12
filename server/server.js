// server.js
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

const app = express();
app.use(cors());

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*' // In production, restrict this to your client URL
  }
});

// In-memory store for players' progress
let playersData = [];

// Function to broadcast updated players data to all connected clients
const updatePlayers = () => {
  io.emit('playersUpdate', playersData);
};

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // When a player joins
  socket.on('playerJoined', (data) => {
    console.log(`Player joined: ${data.name}`);
    // Add new player if not already present
    playersData.push({
      id: socket.id,
      name: data.name,
      solvedRooms: [],
      finished: false,
      totalTime: null,
    });
    updatePlayers();
  });

  // When a player solves a room
  socket.on('roomSolved', (data) => {
    console.log(`Room solved by ${data.name}: Room ${data.room}`);
    const player = playersData.find((p) => p.name === data.name);
    if (player) {
      player.solvedRooms.push({ room: data.room, timeTaken: data.timeTaken });
    }
    updatePlayers();
  });

  // When a player finishes the game
  socket.on('gameFinished', (data) => {
    console.log(`Game finished by ${data.name}`);
    const player = playersData.find((p) => p.name === data.name);
    if (player) {
      player.finished = true;
      player.totalTime = data.totalTime;
    }
    updatePlayers();
  });

  // When a client disconnects, remove them from the list
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    playersData = playersData.filter((p) => p.id !== socket.id);
    updatePlayers();
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Socket server is running on port ${PORT}`);
});
