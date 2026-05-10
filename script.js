// === Game State Variables ===
let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = true;
let gameMode = 'pvp'; // pvp, pvc-basic, pvc-smart
let history = []; // Array of board states
let scores = { X: 0, O: 0, Draw: 0 };
let timerInterval;
let timeLeft = 15;
const TURN_DURATION = 15;

// === Winning Combinations ===
const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

// === DOM Elements ===
const cells = document.querySelectorAll('.cell');
const turnText = document.getElementById('turn-text');
const timerBar = document.getElementById('timer-bar');
const timerText = document.getElementById('timer-text');
const scoreX = document.getElementById('score-x');
const scoreO = document.getElementById('score-o');
const scoreDraw = document.getElementById('score-draw');
const restartBtn = document.getElementById('restart-btn');
const undoBtn = document.getElementById('undo-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const gameModeSelect = document.getElementById('game-mode');
const historyList = document.getElementById('history-list');
const themeSwitch = document.getElementById('theme-switch');
const winningLine = document.getElementById('winning-line');

// === Audio System (Web Audio API) ===
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    initAudio();
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;

    if (type === 'moveX') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, now); // A4
        oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } else if (type === 'moveO') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, now); 
        oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } else if (type === 'win') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(523.25, now); // C5
        setTimeout(() => setFreq(659.25), 100); // E5
        setTimeout(() => setFreq(783.99), 200); // G5
        setTimeout(() => setFreq(1046.50), 300); // C6
        function setFreq(f) { oscillator.frequency.setValueAtTime(f, audioCtx.currentTime); }
        
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.6);
        oscillator.start(now);
        oscillator.stop(now + 0.6);
    } else if (type === 'draw') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, now);
        oscillator.frequency.linearRampToValueAtTime(150, now + 0.4);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.4);
        oscillator.start(now);
        oscillator.stop(now + 0.4);
    }
}

// === Initialization ===
function init() {
    loadTheme();
    setupEventListeners();
    resetGame();
}

function setupEventListeners() {
    cells.forEach(cell => cell.addEventListener('click', handleCellClick));
    restartBtn.addEventListener('click', resetGame);
    undoBtn.addEventListener('click', undoMove);
    resetScoresBtn.addEventListener('click', resetScores);
    gameModeSelect.addEventListener('change', (e) => {
        gameMode = e.target.value;
        resetGame();
    });
    
    themeSwitch.addEventListener('change', (e) => {
        if(e.target.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }
    });
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if(savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeSwitch.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        themeSwitch.checked = false;
    }
}

// === Timer System ===
function startTimer() {
    clearInterval(timerInterval);
    timeLeft = TURN_DURATION;
    updateTimerUI();
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerUI();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // Skip turn
            switchPlayer();
            startTimer();
            if (isAITurn()) {
                setTimeout(makeAIMove, 500);
            }
        }
    }, 1000);
}

function updateTimerUI() {
    timerText.textContent = `${timeLeft}s`;
    const percentage = (timeLeft / TURN_DURATION) * 100;
    timerBar.style.width = `${percentage}%`;
    
    if(timeLeft <= 5) {
        timerBar.style.background = '#ef4444'; // Red warning
    } else {
        timerBar.style.background = 'var(--primary-color)';
    }
}

// === Game Logic ===
function handleCellClick(e) {
    if (!gameActive) return;
    initAudio(); // Initialize audio context on first user interaction
    
    const cell = e.target;
    const index = parseInt(cell.getAttribute('data-index'));

    if (board[index] !== '' || isAITurn()) {
        return;
    }

    makeMove(index, currentPlayer);
}

function makeMove(index, player) {
    // Save history before move
    history.push({
        board: [...board],
        currentPlayer: currentPlayer,
        cellIndex: index
    });
    undoBtn.disabled = false;

    board[index] = player;
    updateBoardUI();
    playSound(`move${player}`);
    addHistoryLog(`Player ${player} played cell ${index + 1}`);

    checkResult();
}

function updateBoardUI() {
    for (let i = 0; i < 9; i++) {
        cells[i].textContent = board[i];
        cells[i].className = 'cell'; // reset
        if (board[i] !== '') {
            cells[i].classList.add(board[i].toLowerCase(), 'occupied');
        }
    }
}

function switchPlayer() {
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    turnText.textContent = `Player ${currentPlayer}'s Turn`;
}

function checkResult() {
    let roundWon = false;
    let winningLineCoords = null;

    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            roundWon = true;
            winningLineCoords = winningConditions[i];
            break;
        }
    }

    if (roundWon) {
        endGame(currentPlayer, winningLineCoords);
        return;
    }

    if (!board.includes('')) {
        endGame('Draw');
        return;
    }

    switchPlayer();
    startTimer();

    if (isAITurn() && gameActive) {
        setTimeout(makeAIMove, 600); // slight delay for realism
    }
}

function endGame(result, lineCoords = null) {
    gameActive = false;
    clearInterval(timerInterval);
    timerBar.style.width = '0%';
    timerText.textContent = '0s';
    undoBtn.disabled = true; // disable undo on game over

    if (result === 'Draw') {
        turnText.textContent = "It's a Draw!";
        scores.Draw++;
        scoreDraw.textContent = scores.Draw;
        playSound('draw');
        addHistoryLog('Game ended in a draw.');
    } else {
        turnText.textContent = `Player ${result} Wins!`;
        scores[result]++;
        if (result === 'X') scoreX.textContent = scores.X;
        else scoreO.textContent = scores.O;
        playSound('win');
        drawWinningLine(lineCoords);
        addHistoryLog(`Player ${result} won the game.`);
    }
}

function drawWinningLine(coords) {
    if (!coords) return;
    
    const [a, b, c] = coords;
    winningLine.style.display = 'block';
    
    // Determine line orientation and position
    // Board is 300x300, cells are ~100x100
    // Padding is 10px, gap is 10px
    const isRow = a === 0 && c === 2 || a === 3 && c === 5 || a === 6 && c === 8;
    const isCol = a === 0 && c === 6 || a === 1 && c === 7 || a === 2 && c === 8;
    const isDiag1 = a === 0 && c === 8;
    const isDiag2 = a === 2 && c === 6;

    const cellSize = 93.33; 
    const gap = 10;
    const offset = 10; // board padding

    if (isRow) {
        const row = Math.floor(a / 3);
        winningLine.style.width = '280px';
        winningLine.style.height = '8px';
        winningLine.style.left = '10px';
        winningLine.style.top = `${offset + (cellSize / 2) + row * (cellSize + gap) - 4}px`;
        winningLine.style.transform = 'none';
    } else if (isCol) {
        const col = a % 3;
        winningLine.style.width = '8px';
        winningLine.style.height = '280px';
        winningLine.style.top = '10px';
        winningLine.style.left = `${offset + (cellSize / 2) + col * (cellSize + gap) - 4}px`;
        winningLine.style.transform = 'none';
    } else if (isDiag1) {
        winningLine.style.width = '380px';
        winningLine.style.height = '8px';
        winningLine.style.top = '146px';
        winningLine.style.left = '-40px';
        winningLine.style.transform = 'rotate(45deg)';
    } else if (isDiag2) {
        winningLine.style.width = '380px';
        winningLine.style.height = '8px';
        winningLine.style.top = '146px';
        winningLine.style.left = '-40px';
        winningLine.style.transform = 'rotate(-45deg)';
    }
}

function resetGame() {
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameActive = true;
    history = [];
    undoBtn.disabled = true;
    turnText.textContent = `Player X's Turn`;
    
    winningLine.style.display = 'none';
    winningLine.style.transform = 'none';
    
    updateBoardUI();
    historyList.innerHTML = '<li class="history-placeholder">No moves yet.</li>';
    
    startTimer();
    
    if (isAITurn()) {
        setTimeout(makeAIMove, 500);
    }
}

function resetScores() {
    scores = { X: 0, O: 0, Draw: 0 };
    scoreX.textContent = '0';
    scoreO.textContent = '0';
    scoreDraw.textContent = '0';
}

function undoMove() {
    if (history.length === 0 || !gameActive) return;
    
    // Pop the last move
    let lastState = history.pop();
    
    // If playing against AI, undo twice (AI move and Player move)
    if (gameMode.startsWith('pvc') && history.length > 0 && lastState.currentPlayer === 'O') {
        lastState = history.pop();
    }
    
    board = [...lastState.board];
    currentPlayer = lastState.currentPlayer;
    gameActive = true;
    
    updateBoardUI();
    turnText.textContent = `Player ${currentPlayer}'s Turn`;
    startTimer();
    
    if(history.length === 0) {
        undoBtn.disabled = true;
    }
    
    // Remove last log
    if (historyList.lastChild) {
        historyList.removeChild(historyList.lastChild);
        if (gameMode.startsWith('pvc') && historyList.lastChild) {
             historyList.removeChild(historyList.lastChild);
        }
    }
    if (historyList.children.length === 0) {
        historyList.innerHTML = '<li class="history-placeholder">No moves yet.</li>';
    }
}

function addHistoryLog(msg) {
    const placeholder = historyList.querySelector('.history-placeholder');
    if (placeholder) placeholder.remove();

    const li = document.createElement('li');
    li.textContent = msg;
    historyList.appendChild(li);
    historyList.scrollTop = historyList.scrollHeight; // Auto-scroll
}

// === AI System ===
function isAITurn() {
    return gameMode.startsWith('pvc') && currentPlayer === 'O';
}

function makeAIMove() {
    if (!gameActive) return;
    
    let moveIndex;
    if (gameMode === 'pvc-smart') {
        moveIndex = getBestMove();
    } else {
        moveIndex = getRandomMove();
    }
    
    makeMove(moveIndex, 'O');
}

function getRandomMove() {
    const emptyIndices = board.map((val, index) => val === '' ? index : null).filter(val => val !== null);
    const randomIndex = Math.floor(Math.random() * emptyIndices.length);
    return emptyIndices[randomIndex];
}

// Minimax Algorithm
function getBestMove() {
    let bestScore = -Infinity;
    let move;
    
    for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
            board[i] = 'O'; // AI is 'O'
            let score = minimax(board, 0, false);
            board[i] = ''; // Undo
            if (score > bestScore) {
                bestScore = score;
                move = i;
            }
        }
    }
    // Fallback just in case
    return move !== undefined ? move : getRandomMove();
}

function minimax(boardState, depth, isMaximizing) {
    let result = checkWinnerForMinimax();
    if (result !== null) {
        if (result === 'O') return 10 - depth;
        if (result === 'X') return depth - 10;
        return 0; // Tie
    }

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (boardState[i] === '') {
                boardState[i] = 'O';
                let score = minimax(boardState, depth + 1, false);
                boardState[i] = '';
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (boardState[i] === '') {
                boardState[i] = 'X';
                let score = minimax(boardState, depth + 1, true);
                boardState[i] = '';
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}

function checkWinnerForMinimax() {
    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    if (!board.includes('')) return 'tie';
    return null;
}

// Start Game
window.onload = init;
