const MP = {
  socket: null,
  roomCode: '',
  nickname: '',
  playerId: '',
  players: [],
  isMaster: false,
  currentWord: '',
  currentRound: 0,
  totalRounds: 3,
  isGuesserView: false,
  wordSubmitted: false,
  wrongLetters: [],
  correctLetters: [],
  mpKeyHandler: null,

  connect(callback) {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://' + window.location.hostname + ':3000'
      : window.location.origin;

    this.socket = io(serverUrl, { transports: ['websocket', 'polling'] });

    let fired = false;
    this.socket.on('connect', () => {
      this.playerId = this.socket.id;
      document.getElementById('mpError').style.display = 'none';
      if (!fired) { fired = true; if (callback) callback(); }
    });

    this.socket.on('connect_error', () => {
      const err = document.getElementById('mpError');
      err.textContent = 'Cannot connect to server. Make sure the server is running (node backend/server.js).';
      err.style.display = 'block';
    });

    this.socket.on('room-joined', (data) => {
      this.roomCode = data.roomCode;
      this.players = data.players;
      this.renderLobby();
      App.showScreen('mpLobbyScreen');
      document.getElementById('mpError').style.display = 'none';
    });
    this.socket.on('room-error', (msg) => {
      const err = document.getElementById('mpError');
      err.textContent = msg;
      err.style.display = 'block';
    });
    this.socket.on('player-joined', (data) => {
      this.players = data.players;
      this.renderLobby();
    });
    this.socket.on('player-left', (data) => {
      this.players = data.players;
      this.renderLobby();
    });
    this.socket.on('game-starting', () => { this.currentRound = 0; App.showScreen('mpGameScreen'); });
    this.socket.on('round-start', (data) => {
      this.currentRound = data.round;
      this.isMaster = data.masterId === this.playerId;
      this.wordSubmitted = false;
      this.wrongLetters = [];
      this.correctLetters = [];
      document.getElementById('mpGuessNotif').style.display = 'none';
      document.getElementById('mpRoundInfo').textContent = `Round ${data.round} of ${this.totalRounds}`;
      const masterName = this.players.find(p => p.id === data.masterId)?.name || 'Unknown';
      document.getElementById('mpWordMasterLabel').textContent = `👑 ${masterName} is the Word Master`;
      document.getElementById('mpMasterInput').style.display = 'none';
      document.getElementById('mpMasterWaiting').style.display = 'none';
      document.getElementById('mpGuesserArea').style.display = 'block';
      document.getElementById('mpHintBtn').disabled = true;
      document.getElementById('mpHintBtn').textContent = '💡 Hint';
      document.getElementById('mpHintText').textContent = '';
      this.isGuesserView = false;
      this.currentWord = '';
      this.clearHangman();
      this.renderMPKeyboard();
      this.renderMPWordDisplay();
      this.renderMPWrongLetters();
      this.renderScoreDisplay();
      this.setupMPKeyboardListeners();
      if (this.isMaster) this.showMasterInput();
    });
    this.socket.on('word-set', (data) => {
      if (data.wordState) this.currentWord = data.wordState;
      if (data.wrongGuesses) this.wrongLetters = data.wrongGuesses;
      this.renderMPWordDisplay();
      this.renderMPWrongLetters();
      this.renderMPHangman(this.wrongLetters.length);
      this.updateKeyboardState();
      const hintBtn = document.getElementById('mpHintBtn');
      if (data.hintAvailable) {
        hintBtn.disabled = false;
        hintBtn.textContent = '💡 Get Hint';
      }
    });
    this.socket.on('hint-reveal', (data) => {
      document.getElementById('mpHintText').textContent = data.hint;
      document.getElementById('mpHintBtn').disabled = true;
      document.getElementById('mpHintBtn').textContent = '💡 Hint used';
    });
    this.socket.on('master-word-set', () => {
      if (this.isMaster) {
        document.getElementById('mpMasterInput').style.display = 'none';
        document.getElementById('mpMasterWaiting').style.display = 'block';
        document.getElementById('mpMasterWordDisplay').textContent = this.currentWord.split(',').map(s => s.split(':')[0]).join('');
      }
    });
    this.socket.on('guess-result', (data) => {
      const { playerId, letter, wordState, wrongGuesses, gameOver, winnerId, winnerName } = data;
      if (playerId !== this.playerId && letter) {
        const notif = document.getElementById('mpGuessNotif');
        const playerName = this.players.find(p => p.id === playerId)?.name || 'Someone';
        const isCorrect = winnerId !== undefined ? !!winnerId : (data.correct);
        notif.textContent = isCorrect ? `✨ ${playerName} guessed ${letter}!` : `❌ ${playerName} tried ${letter}`;
        notif.className = `guess-notification ${isCorrect ? 'correct-guess' : 'wrong-guess'}`;
        notif.style.display = 'block';
        setTimeout(() => { notif.style.display = 'none'; }, 2500);
      }
      if (wordState !== undefined) this.currentWord = wordState;
      if (wrongGuesses !== undefined) this.wrongLetters = wrongGuesses;
      this.renderMPWordDisplay();
      this.renderMPWrongLetters();
      this.renderMPHangman(this.wrongLetters.length);
      this.updateKeyboardState();
      if (gameOver) {
        if (winnerId === this.playerId) this.showMPWin();
        else if (winnerId) this.showMPLose(winnerName || this.players.find(p => p.id === winnerId)?.name || 'Someone');
      }
    });
    this.socket.on('round-end', (data) => {
      const { winner, word, scores } = data;
      this.players = scores;
      this.renderScoreDisplay();
      const notif = document.getElementById('mpGuessNotif');
      notif.textContent = winner ? `🏆 ${winner} guessed "${word}" and earns 1 point!` : `Nobody guessed it! The word was: ${word}`;
      notif.className = 'guess-notification correct-guess';
      notif.style.display = 'block';
    });
    this.socket.on('game-over', (data) => {
      const { winner, scores } = data;
      this.showMPGameOver(winner, scores);
    });
    this.socket.on('room-closed', () => {
      this.cleanup();
      App.showScreen('mpMenuScreen');
    });
  },

  updateKeyboardState() {
    const keys = document.querySelectorAll('#mpKeyboard .key');
    keys.forEach(k => {
      const letter = k.dataset.letter;
      if (this.wrongLetters.includes(letter.toLowerCase())) {
        k.disabled = true;
        k.classList.add('wrong');
        k.classList.remove('correct');
      } else if (this.isLetterCorrect(letter)) {
        k.disabled = true;
        k.classList.add('correct');
        k.classList.remove('wrong');
      } else {
        k.disabled = false;
        k.classList.remove('correct', 'wrong');
      }
    });
  },

  isLetterCorrect(letter) {
    if (!this.currentWord) return false;
    const parts = this.currentWord.split(',');
    for (const p of parts) {
      const [ch, state] = p.split(':');
      if (ch === letter && state === '1') return true;
    }
    return false;
  },

  renderLobby() {
    const list = document.getElementById('mpPlayerList');
    list.innerHTML = '';
    this.players.forEach(p => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      if (p.id === this.playerId) chip.classList.add('is-you');
      chip.textContent = p.name;
      if (p.isHost) {
        const crown = document.createElement('span');
        crown.className = 'crown';
        crown.textContent = ' 👑';
        chip.appendChild(crown);
      }
      list.appendChild(chip);
    });
    document.getElementById('mpRoomCodeDisplay').textContent = this.roomCode;
    document.getElementById('mpPlayerCount').textContent = this.players.length;

    const isHost = this.players.some(p => p.id === this.playerId && p.isHost);
    const startBtn = document.getElementById('mpStartBtn');
    if (isHost && this.players.length >= 2) {
      startBtn.style.display = 'inline-block';
      startBtn.disabled = false;
    } else if (isHost) {
      startBtn.style.display = 'inline-block';
      startBtn.disabled = true;
    } else {
      startBtn.style.display = 'none';
    }
  },

  startGame() {
    this.socket.emit('start-game', { roomCode: this.roomCode });
  },

  showMasterInput() {
    document.getElementById('mpMasterInput').style.display = 'block';
    document.getElementById('mpMasterWaiting').style.display = 'none';
    document.getElementById('mpGuesserArea').style.display = 'block';
    document.getElementById('mpWordInput').value = '';
    document.getElementById('mpHintInput').value = '';
    document.getElementById('mpWordError').style.display = 'none';
    document.getElementById('mpSubmitWordBtn').disabled = false;
  },

  submitWord() {
    const wordInput = document.getElementById('mpWordInput');
    const hintInput = document.getElementById('mpHintInput');
    const word = wordInput.value.trim().toUpperCase();
    const hint = hintInput.value.trim();
    if (word.length < 2) {
      document.getElementById('mpWordError').textContent = 'Word must be at least 2 letters';
      document.getElementById('mpWordError').style.display = 'block';
      return;
    }
    if (!/^[A-Z]+$/.test(word)) {
      document.getElementById('mpWordError').textContent = 'Only letters allowed';
      document.getElementById('mpWordError').style.display = 'block';
      return;
    }
    document.getElementById('mpWordError').style.display = 'none';
    this.currentWord = word;
    this.wordSubmitted = true;
    document.getElementById('mpSubmitWordBtn').disabled = true;
    this.socket.emit('set-word', { roomCode: this.roomCode, word, hint });
  },

  toggleGuesserView() {
    this.isGuesserView = !this.isGuesserView;
    if (this.isGuesserView) {
      document.getElementById('mpMasterWaiting').style.display = 'none';
      document.getElementById('mpGuesserArea').style.display = 'block';
    } else {
      document.getElementById('mpMasterWaiting').style.display = 'block';
      document.getElementById('mpGuesserArea').style.display = 'none';
    }
  },

  guessLetter(letter) {
    if (this.isMaster && !this.isGuesserView) return;
    this.socket.emit('guess-letter', { roomCode: this.roomCode, letter });
  },

  requestHint() {
    this.socket.emit('request-hint', { roomCode: this.roomCode });
  },

  renderMPWordDisplay() {
    const display = document.getElementById('mpWordDisplay');
    display.innerHTML = '';
    if (!this.currentWord) {
      display.innerHTML = '<span style="color:var(--text-light)">Waiting for word...</span>';
      return;
    }
    const wordArr = this.currentWord.split(',');
    for (let i = 0; i < wordArr.length; i++) {
      const parts = wordArr[i].split(':');
      const ch = parts[0];
      const revealed = parts[1] === '1';
      const box = document.createElement('span');
      box.className = 'letter-box';
      if (revealed && ch !== '_') {
        box.textContent = ch;
        box.classList.add('revealed');
        box.style.animationDelay = (i * 0.06) + 's';
      } else {
        box.textContent = '';
      }
      display.appendChild(box);
    }
  },

  renderMPWrongLetters() {
    const container = document.getElementById('mpWrongLetters');
    container.innerHTML = '<span class="label">Wrong:</span>';
    this.wrongLetters.forEach(l => {
      const span = document.createElement('span');
      span.className = 'wrong-letter';
      span.textContent = l.toUpperCase();
      container.appendChild(span);
    });
  },

  renderMPKeyboard() {
    const kb = document.getElementById('mpKeyboard');
    kb.innerHTML = '';
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const key = document.createElement('button');
      key.className = 'key';
      key.textContent = letter;
      key.dataset.letter = letter;
      key.addEventListener('click', () => { this.guessLetter(letter); });
      kb.appendChild(key);
    }
  },

  setupMPKeyboardListeners() {
    if (this.mpKeyHandler) {
      document.removeEventListener('keydown', this.mpKeyHandler);
    }
    this.mpKeyHandler = (e) => {
      if (this.isMaster && !this.isGuesserView) return;
      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key) && key.length === 1) {
        this.guessLetter(key);
      }
    };
    document.addEventListener('keydown', this.mpKeyHandler);
  },

  renderMPHangman(count) {
    for (let i = 1; i <= 8; i++) {
      const el = document.getElementById('mp-part' + i);
      if (el) {
        if (i <= count) {
          el.classList.add('visible');
        } else {
          el.classList.remove('visible');
        }
      }
    }
  },

  clearHangman() {
    for (let i = 1; i <= 8; i++) {
      const el = document.getElementById('mp-part' + i);
      if (el) el.classList.remove('visible');
    }
  },

  renderScoreDisplay() {
    const container = document.getElementById('mpScoreDisplay');
    container.innerHTML = '';
    this.players.forEach(p => {
      const card = document.createElement('div');
      card.className = 'score-card';
      card.innerHTML = `<div class="name">${p.name}</div><div class="score">${p.score || 0}</div>`;
      container.appendChild(card);
    });
  },

  showMPWin() {
    const modal = document.getElementById('winModal');
    document.getElementById('winWord').textContent = 'You got it!';
    modal.classList.add('active');
    Game.spawnConfetti();
    modal.querySelector('.btn').onclick = () => {
      modal.classList.remove('active');
      Game.clearConfetti();
    };
  },

  showMPLose(winnerName) {
    const modal = document.getElementById('loseModal');
    document.getElementById('loseWord').textContent = `${winnerName} guessed it first!`;
    modal.classList.add('active');
    modal.querySelector('.btn').onclick = () => {
      modal.classList.remove('active');
    };
  },

  showMPGameOver(winner, scores) {
    this.players = scores;
    App.showScreen('mpLobbyScreen');
    document.getElementById('mpLobbyStatus').style.display = 'none';
    const gameOverDiv = document.getElementById('mpGameOver');
    gameOverDiv.style.display = 'block';
    document.getElementById('mpWinnerName').textContent = winner;

    const finalScores = document.getElementById('mpFinalScores');
    finalScores.innerHTML = '';
    [...scores].sort((a, b) => (b.score || 0) - (a.score || 0)).forEach(p => {
      const div = document.createElement('div');
      div.style.cssText = 'padding:8px 0;font-size:1.1rem;font-weight:600';
      div.textContent = `${p.name}: ${p.score || 0} pts`;
      finalScores.appendChild(div);
    });
  },

  cleanup() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.mpKeyHandler) {
      document.removeEventListener('keydown', this.mpKeyHandler);
      this.mpKeyHandler = null;
    }
    document.getElementById('mpGameOver').style.display = 'none';
    document.getElementById('mpLobbyStatus').style.display = 'block';
  }
};
