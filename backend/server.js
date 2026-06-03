const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.static(path.join(__dirname, '..')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

const rooms = {};

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getRoom(roomCode) {
  return rooms[roomCode];
}

function broadcastRoomState(roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;
  const players = room.players.map(p => ({
    id: p.id, name: p.name, isHost: p.isHost, score: p.score || 0
  }));
  io.to(roomCode).emit('player-joined', { players });
}

function getMaskedWordState(room) {
  return room.wordState.map(s => {
    const parts = s.split(':');
    const ch = parts[0];
    const revealed = parts[1] === '1';
    return (revealed ? ch : '_') + ':' + parts[1];
  }).join(',');
}

function getCorrectLetters(room) {
  const correct = [];
  for (const s of room.wordState) {
    const ch = s.split(':')[0];
    if (!room.wrongGuesses.includes(ch.toLowerCase()) && room.guessedLetters.includes(ch)) {
      correct.push(ch);
    }
  }
  return correct;
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('create-room', ({ nickname }) => {
    let roomCode;
    do {
      roomCode = generateRoomCode();
    } while (rooms[roomCode]);

    const room = {
      code: roomCode,
      players: [],
      currentRound: 0,
      totalRounds: 3,
      currentMaster: null,
      currentWord: null,
      currentHint: null,
      guessedLetters: [],
      wrongGuesses: [],
      wordState: null,
      roundActive: false
    };

    room.players.push({
      id: socket.id, name: nickname, isHost: true, score: 0
    });

    rooms[roomCode] = room;
    socket.join(roomCode);

    socket.emit('room-joined', {
      roomCode,
      players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, score: p.score }))
    });

    console.log(`Room ${roomCode} created by ${nickname}`);
  });

  socket.on('join-room', ({ nickname, roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) {
      socket.emit('room-error', 'Room not found. Check the code and try again.');
      return;
    }
    if (room.players.length >= 5) {
      socket.emit('room-error', 'Room is full (max 5 players).');
      return;
    }
    if (room.roundActive) {
      socket.emit('room-error', 'Game is already in progress.');
      return;
    }
    room.players.push({ id: socket.id, name: nickname, isHost: false, score: 0 });
    socket.join(roomCode);

    socket.emit('room-joined', {
      roomCode,
      players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, score: p.score }))
    });

    socket.to(roomCode).emit('player-joined', {
      players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, score: p.score }))
    });

    console.log(`${nickname} joined room ${roomCode}`);
  });

  socket.on('start-game', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) return;
    if (room.players.length < 2) return;
    room.currentRound = 0;
    room.roundActive = true;
    io.to(roomCode).emit('game-starting', {});
    startNewRound(roomCode);
  });

  function startNewRound(roomCode) {
    const room = getRoom(roomCode);
    if (!room) return;

    room.currentRound++;
    if (room.currentRound > room.totalRounds) {
      endGame(roomCode);
      return;
    }

    room.currentWord = null;
    room.guessedLetters = [];
    room.wrongGuesses = [];
    room.wordState = null;
    room.roundActive = true;

    const masterIndex = room.currentRound - 1;
    const master = room.players[masterIndex % room.players.length];
    room.currentMaster = master.id;

    io.to(roomCode).emit('round-start', {
      round: room.currentRound,
      totalRounds: room.totalRounds,
      masterId: master.id,
      masterName: master.name,
      players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
    });

    console.log(`Room ${roomCode}: Round ${room.currentRound}, Master is ${master.name}`);
  }

  socket.on('set-word', ({ roomCode, word, hint }) => {
    const room = getRoom(roomCode);
    if (!room) return;
    if (room.currentMaster !== socket.id) return;

    const cleanWord = word.toUpperCase().replace(/[^A-Z]/g, '');
    if (cleanWord.length < 2) return;

    room.currentWord = cleanWord;
    room.currentHint = hint || '';
    room.guessedLetters = [];
    room.wrongGuesses = [];
    room.wordState = cleanWord.split('').map(l => l + ':0');

    socket.emit('master-word-set', {});

    io.to(roomCode).emit('word-set', {
      wordState: getMaskedWordState(room),
      wrongGuesses: [],
      hintAvailable: !!room.currentHint
    });

    console.log(`Room ${roomCode}: Word set to "${cleanWord}"`);
  });

  socket.on('request-hint', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room || !room.currentHint) return;
    socket.emit('hint-reveal', { hint: room.currentHint });
  });

  socket.on('guess-letter', ({ roomCode, letter }) => {
    const room = getRoom(roomCode);
    if (!room || !room.roundActive || !room.currentWord) return;
    if (socket.id === room.currentMaster) return;

    const cleanLetter = letter.toUpperCase();
    if (cleanLetter.length !== 1 || !/^[A-Z]$/.test(cleanLetter)) return;
    if (room.guessedLetters.includes(cleanLetter)) return;

    room.guessedLetters.push(cleanLetter);
    const isCorrect = room.currentWord.includes(cleanLetter);

    if (isCorrect) {
      room.wordState = room.currentWord.split('').map((ch, i) => {
        if (ch === cleanLetter) return ch + ':1';
        return room.wordState[i];
      });
    } else {
      room.wrongGuesses.push(cleanLetter);
    }

    const allRevealed = room.wordState.every(s => s.endsWith(':1'));

    if (allRevealed) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) player.score = (player.score || 0) + 1;

      const wordStr = room.currentWord;
      room.roundActive = false;

      io.to(roomCode).emit('guess-result', {
        playerId: socket.id,
        letter: cleanLetter,
        correct: true,
        wordState: getMaskedWordState(room),
        wrongGuesses: [...room.wrongGuesses],
        gameOver: true,
        winnerId: socket.id,
        winnerName: player ? player.name : 'Unknown'
      });

      setTimeout(() => {
        const updatedScores = room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
        io.to(roomCode).emit('round-end', {
          winner: player ? player.name : 'Unknown',
          word: wordStr,
          scores: updatedScores
        });
        setTimeout(() => startNewRound(roomCode), 3000);
      }, 1500);
      return;
    }

    if (room.wrongGuesses.length >= 8) {
      room.roundActive = false;
      const wordStr = room.currentWord;

      io.to(roomCode).emit('guess-result', {
        playerId: socket.id,
        letter: cleanLetter,
        correct: isCorrect,
        wordState: getMaskedWordState(room),
        wrongGuesses: [...room.wrongGuesses],
        gameOver: true,
        winnerId: null,
        winnerName: null
      });

      setTimeout(() => {
        const updatedScores = room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
        io.to(roomCode).emit('round-end', {
          winner: null,
          word: wordStr,
          scores: updatedScores
        });
        setTimeout(() => startNewRound(roomCode), 3000);
      }, 1500);
      return;
    }

    io.to(roomCode).emit('guess-result', {
      playerId: socket.id,
      letter: cleanLetter,
      correct: isCorrect,
      wordState: getMaskedWordState(room),
      wrongGuesses: [...room.wrongGuesses],
      gameOver: false
    });
  });

  socket.on('guess-full-word', ({ roomCode, word }) => {
    const room = getRoom(roomCode);
    if (!room || !room.roundActive || !room.currentWord) return;
    if (socket.id === room.currentMaster) return;

    const cleanWord = word.toUpperCase().replace(/[^A-Z]/g, '');
    if (!cleanWord || cleanWord.length < 2) return;

    if (cleanWord === room.currentWord) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) player.score = (player.score || 0) + 1;
      room.wordState = room.currentWord.split('').map(l => l + ':1');
      room.roundActive = false;

      io.to(roomCode).emit('guess-result', {
        playerId: socket.id, letter: cleanWord, correct: true,
        wordState: getMaskedWordState(room), wrongGuesses: [...room.wrongGuesses],
        gameOver: true, winnerId: socket.id, winnerName: player ? player.name : 'Unknown'
      });

      setTimeout(() => {
        io.to(roomCode).emit('round-end', {
          winner: player ? player.name : 'Unknown', word: room.currentWord,
          scores: room.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
        });
        setTimeout(() => startNewRound(roomCode), 3000);
      }, 1500);
    } else {
      room.wrongGuesses.push(cleanWord[0] || '?');
      room.guessedLetters.push(cleanWord[0] || '?');

      if (room.wrongGuesses.length >= 8) {
        room.roundActive = false;
        io.to(roomCode).emit('guess-result', {
          playerId: socket.id, letter: cleanWord, correct: false,
          wordState: getMaskedWordState(room), wrongGuesses: [...room.wrongGuesses],
          gameOver: true, winnerId: null, winnerName: null
        });

        setTimeout(() => {
          io.to(roomCode).emit('round-end', {
            winner: null, word: room.currentWord,
            scores: room.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
          });
          setTimeout(() => startNewRound(roomCode), 3000);
        }, 1500);
        return;
      }

      io.to(roomCode).emit('guess-result', {
        playerId: socket.id, letter: cleanWord, correct: false,
        wordState: getMaskedWordState(room), wrongGuesses: [...room.wrongGuesses],
        gameOver: false
      });
    }
  });

  function endGame(roomCode) {
    const room = getRoom(roomCode);
    if (!room) return;
    room.roundActive = false;
    const sorted = [...room.players].sort((a, b) => (b.score || 0) - (a.score || 0));
    const winner = sorted[0];

    io.to(roomCode).emit('game-over', {
      winner: winner ? winner.name : 'Unknown',
      scores: room.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
    });
    console.log(`Room ${roomCode}: Game over. Winner: ${winner ? winner.name : 'None'}`);
  }

  socket.on('leave-room', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    socket.leave(roomCode);
    if (room.players.length === 0) {
      delete rooms[roomCode];
      console.log(`Room ${roomCode} deleted (empty)`);
    } else {
      if (!room.players.some(p => p.isHost)) {
        room.players[0].isHost = true;
      }
      broadcastRoomState(roomCode);
    }
  });

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.players.length === 0) {
          delete rooms[roomCode];
          console.log(`Room ${roomCode} deleted (disconnect)`);
        } else {
          if (!room.players.some(p => p.isHost)) {
            room.players[0].isHost = true;
          }
          io.to(roomCode).emit('player-left', {
            players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, score: p.score }))
          });
        }
        break;
      }
    }
    console.log('Player disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Hangman Party server running on port ${PORT}`);
});
