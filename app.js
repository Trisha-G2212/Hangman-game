const App = {
  currentScreen: 'menuScreen',

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    this.currentScreen = screenId;
  },

  goToMenu() {
    if (this.currentScreen.startsWith('mp')) {
      this.leaveRoom();
    }
    Game.clearConfetti();
    this.showScreen('menuScreen');
  },

  startSinglePlayer() {
    Game.reset();
    this.showScreen('singleScreen');
  },

  showMultiplayerMenu() {
    this.showScreen('mpMenuScreen');
    document.getElementById('mpError').style.display = 'none';
  },

  createRoom() {
    const nickname = document.getElementById('nicknameInput').value.trim();
    if (!nickname) {
      document.getElementById('mpError').textContent = 'Please enter a nickname';
      document.getElementById('mpError').style.display = 'block';
      return;
    }
    document.getElementById('mpError').style.display = 'none';
    MP.nickname = nickname;
    MP.connect(() => { MP.socket.emit('create-room', { nickname }); });
  },

  joinRoom() {
    const nickname = document.getElementById('nicknameInput').value.trim();
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!nickname) {
      document.getElementById('mpError').textContent = 'Please enter a nickname';
      document.getElementById('mpError').style.display = 'block';
      return;
    }
    if (!roomCode) {
      document.getElementById('mpError').textContent = 'Please enter a room code';
      document.getElementById('mpError').style.display = 'block';
      return;
    }
    document.getElementById('mpError').style.display = 'none';
    MP.nickname = nickname;
    MP.connect(() => { MP.socket.emit('join-room', { nickname, roomCode }); });
  },

  leaveRoom() {
    if (MP.socket && MP.roomCode) {
      MP.socket.emit('leave-room', { roomCode: MP.roomCode });
    }
    MP.cleanup();
    this.showScreen('menuScreen');
  }
};

// Global keyboard handler for single player
document.addEventListener('keydown', (e) => {
  if (App.currentScreen === 'singleScreen') {
    Game.handleKeydown(e);
  }
});




