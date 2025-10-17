// Math Quest main script
//
// This file wires up all interactive systems described in the project brief.
// It maintains a persistent state in localStorage, renders UI components,
// handles user input, runs the mini‑game and updates the progress ring.

(function () {
  // Configuration
  const XP_PER_LEVEL = 100;
  const STORAGE_KEY = 'mathquest:save:v1';
  const THEME_KEY = 'mathquest:theme';
  const SOUND_KEY = 'mathquest:sound';

  // Default state
  const defaultState = {
    level: 1,
    xp: 0,
    coins: 0,
    questsCompleted: 0,
    streak: 1,
    lastSeen: null,
    bestScore: 0,
    inventory: [],
    lastQuiz: null
  };

  let state;
  let audioCtx;
  let slideTimer;
  let currentSlide = 0;
  let slides = [];

  // Sample data for players, quests, achievements and shop
  const samplePlayers = [
    { name: 'Ada', level: 12, xp: 1240 },
    { name: 'Ben', level: 10, xp: 985 },
    { name: 'Chloe', level: 8, xp: 812 },
    { name: 'Dan', level: 7, xp: 710 },
    { name: 'Eli', level: 6, xp: 622 },
    { name: 'Fay', level: 5, xp: 540 },
    { name: 'Gia', level: 4, xp: 380 },
    { name: 'Hugo', level: 3, xp: 245 },
    { name: 'Ivy', level: 2, xp: 130 }
  ];

  const quests = [];
  // Populate quests with randomised tasks
  ['easy','daily','skill','challenge','boss'].forEach((type, idx) => {
    for (let i = 1; i <= 8; i++) {
      const base = idx * 8 + i;
      quests.push({
        id: base,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Quest ${i}`,
        type: type,
        xp: 20 + idx * 10,
        coins: 5 + idx * 5,
        minLevel: idx + 1,
        completed: false
      });
    }
  });

  const achievements = [
    { id: 1, icon: '🔥', name: 'First Streak', condition: s => s.streak >= 3 },
    { id: 2, icon: '💪', name: 'Quest Novice', condition: s => s.questsCompleted >= 5 },
    { id: 3, icon: '🎓', name: 'Quiz Master', condition: s => s.lastQuiz !== null },
    { id: 4, icon: '🏆', name: 'Top 3', condition: () => getUserRank() <= 3 },
    { id: 5, icon: '🚀', name: 'Level 5', condition: s => s.level >= 5 },
    { id: 6, icon: '💎', name: 'Rich', condition: s => s.coins >= 100 },
    { id: 7, icon: '🎯', name: 'High Score 100', condition: s => s.bestScore >= 100 },
    { id: 8, icon: '🏅', name: 'Completer', condition: s => s.questsCompleted >= 20 },
    { id: 9, icon: '🎮', name: 'Gamer', condition: s => s.bestScore >= 50 },
    { id: 10, icon: '🧠', name: 'Learner', condition: s => s.xp >= 500 },
    { id: 11, icon: '⭐', name: 'Shiny', condition: s => s.inventory.length >= 1 },
    { id: 12, icon: '🪙', name: 'Shopper', condition: s => s.inventory.length >= 3 }
  ];

  const shopItems = [
    { id: 1, emoji: '🎩', name: 'Top Hat', rarity: 'common', cost: 10 },
    { id: 2, emoji: '😎', name: 'Sunglasses', rarity: 'uncommon', cost: 20 },
    { id: 3, emoji: '🦄', name: 'Unicorn Horn', rarity: 'rare', cost: 50 },
    { id: 4, emoji: '🐉', name: 'Dragon Pet', rarity: 'legendary', cost: 100 },
    { id: 5, emoji: '🧊', name: 'Ice Cape', rarity: 'epic', cost: 70 },
    { id: 6, emoji: '💼', name: 'Briefcase', rarity: 'common', cost: 15 }
  ];

  // Daily quiz questions
  const quizBank = [
    {
      question: 'What is 7 × 8?',
      options: ['54', '56', '58'],
      answer: 1
    },
    {
      question: 'Solve: 5² + 4² = ?',
      options: ['41', '25', '9'],
      answer: 0
    },
    {
      question: 'Which number is prime?',
      options: ['15', '21', '17'],
      answer: 2
    },
    {
      question: 'Find the derivative of x²',
      options: ['2x', 'x', 'x²'],
      answer: 0
    }
  ];

  // Slideshow data (10 scenes)
  slides = [
    { city: 'Dubai', car: 'Lamborghini&nbsp;Urus', img: 'assets/urus.jpg' },
    { city: 'Hong&nbsp;Kong', car: 'Nissan&nbsp;GT‑R', img: 'assets/gtr-r35.jpg' },
    { city: 'Los&nbsp;Angeles', car: 'Ferrari&nbsp;488', img: 'assets/ferrari.jpg' },
    { city: 'Tokyo', car: 'Toyota&nbsp;Supra', img: 'assets/supra.jpg' },
    { city: 'Miami', car: 'McLaren&nbsp;720S', img: 'assets/mclaren.jpg' },
    { city: 'London', car: 'Rolls‑Royce&nbsp;Cullinan', img: 'assets/cullinan.jpg' },
    { city: 'New&nbsp;York', car: 'Tesla&nbsp;Model&nbsp;S', img: 'assets/tesla.jpg' },
    { city: 'Paris', car: 'Bugatti&nbsp;Chiron', img: 'assets/bugatti.jpg' },
    { city: 'Singapore', car: 'Porsche&nbsp;911', img: 'assets/porsche.jpg' },
    { city: 'Toronto', car: 'Audi&nbsp;R8', img: 'assets/audi.jpg' }
  ];

  // Utility functions
  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      state = Object.assign({}, defaultState, stored || {});
    } catch (e) {
      state = { ...defaultState };
    }
    // Check streak
    const today = new Date().toISOString().slice(0, 10);
    if (!state.lastSeen) {
      state.lastSeen = today;
      state.streak = 1;
    } else {
      const last = state.lastSeen;
      if (last !== today) {
        const diff = (new Date(today) - new Date(last)) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          state.streak = (state.streak || 0) + 1;
        } else if (diff > 1) {
          state.streak = 1;
        }
        state.lastSeen = today;
      }
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadTheme() {
    const theme = localStorage.getItem(THEME_KEY);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    updateThemeIcon();
  }

  function saveTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
  }

  function loadSound() {
    const sound = localStorage.getItem(SOUND_KEY);
    state.sound = sound !== 'off';
    updateSoundIcon();
  }

  function saveSound() {
    localStorage.setItem(SOUND_KEY, state.sound ? 'on' : 'off');
  }

  function updateThemeIcon() {
    const btn = document.getElementById('themeToggle');
    const isLight = document.documentElement.classList.contains('light');
    btn.textContent = isLight ? '🌞' : '🌗';
  }

  function updateSoundIcon() {
    const btn = document.getElementById('soundToggle');
    btn.textContent = state.sound ? '🔊' : '🔇';
  }

  function beep(freq = 440, duration = 0.1, vol = 0.1) {
    if (!state.sound) return;
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = freq;
    gainNode.gain.value = vol;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  }

  // Ranking helper
  function getUserRank() {
    const players = [...samplePlayers, { name: 'You', level: state.level, xp: state.xp }];
    players.sort((a, b) => b.xp - a.xp);
    return players.findIndex(p => p.name === 'You') + 1;
  }

  // Render functions
  function renderProfile() {
    document.getElementById('profileLevel').textContent = `Lv ${state.level}`;
    document.getElementById('profileXP').textContent = `${state.xp} XP`;
    document.getElementById('profileCoins').textContent = `${state.coins} 💰`;
  }

  function renderProgressRing() {
    const circle = document.querySelector('.ring-progress');
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    const withinLevel = state.xp % XP_PER_LEVEL;
    const offset = circumference - (withinLevel / XP_PER_LEVEL) * circumference;
    circle.style.strokeDashoffset = offset;
    document.getElementById('levelNumber').textContent = state.level;
    document.getElementById('levelFooter').textContent = `Next at ${XP_PER_LEVEL * state.level} XP`;
  }

  function renderPoints() {
    const total = state.xp + state.coins;
    document.getElementById('pointsTotal').textContent = total;
  }

  function renderStreak() {
    document.getElementById('streakCount').textContent = `${state.streak} 🔥`;
  }

  function renderRank() {
    const rank = getUserRank();
    document.getElementById('rankIndex').textContent = `#${rank}`;
  }

  function renderHeroXP() {
    const withinLevel = state.xp % XP_PER_LEVEL;
    const percent = (withinLevel / XP_PER_LEVEL) * 100;
    document.getElementById('heroXPBar').style.width = `${percent}%`;
  }

  function renderTopPlayers() {
    const players = [...samplePlayers, { name: 'You', level: state.level, xp: state.xp }];
    players.sort((a, b) => b.xp - a.xp);
    const chips = players.map((p, i) => {
      return `<span class="player-chip"><span class="rank">#${i + 1}</span> ${p.name}</span>`;
    });
    // Duplicate for seamless scrolling
    const track = document.getElementById('topPlayersTrack');
    track.innerHTML = chips.concat(chips).join('');
  }

  function renderLeaderboard() {
    const players = [...samplePlayers, { name: 'You', level: state.level, xp: state.xp }];
    players.sort((a, b) => b.xp - a.xp);
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '';
    players.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${idx + 1}</td><td>${p.name}</td><td>${p.level}</td><td>${p.xp}</td>`;
      tbody.appendChild(tr);
    });
  }

  function renderAchievements() {
    const container = document.getElementById('achievementsGrid');
    container.innerHTML = '';
    achievements.forEach(ach => {
      const unlocked = ach.condition(state);
      const div = document.createElement('div');
      div.className = 'achievement' + (unlocked ? '' : ' locked');
      div.innerHTML = `<div class="icon">${ach.icon}</div><div class="name">${ach.name}</div>`;
      container.appendChild(div);
    });
  }

  function renderShop() {
    const grid = document.getElementById('shopGrid');
    grid.innerHTML = '';
    shopItems.forEach(item => {
      const owned = state.inventory.includes(item.id);
      const card = document.createElement('div');
      card.className = 'shop-item';
      const btn = document.createElement('button');
      btn.textContent = owned ? 'Owned' : `Buy (${item.cost}💰)`;
      if (owned) {
        btn.classList.add('owned');
      }
      btn.addEventListener('click', () => {
        if (owned) return;
        if (state.coins >= item.cost) {
          state.coins -= item.cost;
          state.inventory.push(item.id);
          saveState();
          beep(660, 0.1);
          updateAll();
        } else {
          alert('Not enough coins!');
        }
      });
      card.innerHTML = `<div class="emoji">${item.emoji}</div><div class="name">${item.name}</div><div class="rarity">${item.rarity}</div>`;
      card.appendChild(btn);
      grid.appendChild(card);
    });
  }

  // Quest rendering & pagination
  let currentQuestPage = 1;
  const QUESTS_PER_PAGE = 8;

  function filterQuests() {
    const term = document.getElementById('questSearch').value.toLowerCase();
    const type = document.getElementById('questFilter').value;
    return quests.filter(q => {
      if (type !== 'all' && q.type !== type) return false;
      if (term && !q.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }

  function renderQuestBoard() {
    const list = document.getElementById('questList');
    list.innerHTML = '';
    const filtered = filterQuests();
    const totalPages = Math.ceil(filtered.length / QUESTS_PER_PAGE) || 1;
    if (currentQuestPage > totalPages) currentQuestPage = totalPages;
    const start = (currentQuestPage - 1) * QUESTS_PER_PAGE;
    const pageQuests = filtered.slice(start, start + QUESTS_PER_PAGE);
    pageQuests.forEach(q => {
      const card = document.createElement('div');
      card.className = 'quest-card';
      card.innerHTML = `<h4>${q.title}</h4><div>Type: ${q.type}</div><div>XP: ${q.xp} / Coins: ${q.coins}</div>`;
      const actions = document.createElement('div');
      actions.className = 'quest-actions';
      const infoBtn = document.createElement('button');
      infoBtn.textContent = 'Info';
      infoBtn.addEventListener('click', () => {
        alert(`${q.title}\nType: ${q.type}\nRequires Level ${q.minLevel}\nReward: ${q.xp} XP, ${q.coins} coins`);
      });
      const completeBtn = document.createElement('button');
      const canComplete = state.level >= q.minLevel && !q.completed;
      completeBtn.textContent = q.completed ? 'Done' : `+${q.xp} XP`;
      completeBtn.className = canComplete ? 'primary' : 'disabled';
      if (canComplete) {
        completeBtn.addEventListener('click', () => {
          q.completed = true;
          state.xp += q.xp;
          state.coins += q.coins;
          state.questsCompleted += 1;
          levelCheck();
          saveState();
          beep(880, 0.1);
          updateAll();
        });
      }
      actions.appendChild(infoBtn);
      actions.appendChild(completeBtn);
      card.appendChild(actions);
      list.appendChild(card);
    });
    // Pagination
    const pagination = document.getElementById('questPagination');
    pagination.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      if (i === currentQuestPage) btn.classList.add('active');
      btn.addEventListener('click', () => {
        currentQuestPage = i;
        renderQuestBoard();
      });
      pagination.appendChild(btn);
    }
  }

  // Level up check
  function levelCheck() {
    const newLevel = Math.floor(state.xp / XP_PER_LEVEL) + 1;
    if (newLevel > state.level) {
      state.level = newLevel;
      // Reward beep
      beep(660, 0.2);
    }
  }

  // Quiz system
  let currentQuiz = null;

  function openQuiz() {
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastQuiz === today) {
      alert('You already completed today\'s quiz!');
      return;
    }
    currentQuiz = quizBank[Math.floor(Math.random() * quizBank.length)];
    const dialog = document.getElementById('quizDialog');
    dialog.querySelector('#quizQuestion').textContent = currentQuiz.question;
    const optionsDiv = dialog.querySelector('#quizOptions');
    optionsDiv.innerHTML = '';
    currentQuiz.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        const correct = idx === currentQuiz.answer;
        const rewardXP = correct ? 40 : 10;
        state.xp += rewardXP;
        state.coins += correct ? 5 : 1;
        state.lastQuiz = today;
        levelCheck();
        saveState();
        beep(correct ? 880 : 440, 0.2);
        updateAll();
        alert(correct ? 'Correct! +40 XP' : 'Nice try! +10 XP');
        dialog.close();
      });
      optionsDiv.appendChild(btn);
    });
    dialog.showModal();
  }

  // Builder system
  const carOptions = [
    { src: 'assets/urus.jpg', alt: 'Lamborghini Urus' },
    { src: 'assets/gtr-r35.jpg', alt: 'Nissan GT‑R' },
    { src: 'assets/ferrari.jpg', alt: 'Ferrari 488' },
    { src: 'assets/supra.jpg', alt: 'Toyota Supra' },
    { src: 'assets/mclaren.jpg', alt: 'McLaren 720S' },
    { src: 'assets/cullinan.jpg', alt: 'Rolls‑Royce Cullinan' },
    { src: 'assets/tesla.jpg', alt: 'Tesla Model S' },
    { src: 'assets/bugatti.jpg', alt: 'Bugatti Chiron' },
    { src: 'assets/porsche.jpg', alt: 'Porsche 911' },
    { src: 'assets/audi.jpg', alt: 'Audi R8' }
  ];
  function openBuilder(preset) {
    const dialog = document.getElementById('builderDialog');
    // If preset passed, set the car accordingly
    if (preset) {
      document.getElementById('builderCar').src = preset.src;
      document.getElementById('builderCar').alt = preset.alt;
    }
    dialog.showModal();
  }
  function randomizeBuilder() {
    const option = carOptions[Math.floor(Math.random() * carOptions.length)];
    document.getElementById('builderCar').src = option.src;
    document.getElementById('builderCar').alt = option.alt;
  }
  function saveBuilderScene() {
    state.xp += 30;
    state.coins += 10;
    levelCheck();
    saveState();
    beep(990, 0.2);
    updateAll();
    alert('Scene saved! +30 XP');
    document.getElementById('builderDialog').close();
  }

  // Parallax cards events
  function attachParallax() {
    document.querySelectorAll('.scene-card').forEach(card => {
      const layers = card.querySelectorAll('.layer');
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        layers.forEach((layer, idx) => {
          const depth = (idx + 1) * 10;
          layer.style.transform = `translate(${ -x * depth }px, ${ -y * depth }px)`;
        });
      });
      card.addEventListener('mouseleave', () => {
        layers.forEach(layer => {
          layer.style.transform = '';
        });
      });
      // When clicked, open builder with that scene
      card.addEventListener('click', () => {
        const midLayer = card.querySelector('.mid');
        const bgImage = midLayer.style.backgroundImage;
        // Extract file name between url(" and ")
        const match = bgImage.match(/url\("?([^\")]+)\"?\)/);
        const src = match ? match[1] : '';
        const alt = card.querySelector('.card-title').textContent;
        openBuilder({ src, alt });
      });
    });
  }

  // Slideshow functions
  function renderSlideshow() {
    const container = document.getElementById('slideshow');
    container.innerHTML = '';
    slides.forEach((slide, idx) => {
      const div = document.createElement('div');
      div.className = 'slide';
      div.style.backgroundImage = `url('${slide.img}')`;
      if (idx === currentSlide) div.classList.add('active');
      container.appendChild(div);
    });
    updateSlideCaption();
  }

  function updateSlideCaption() {
    const slide = slides[currentSlide];
    const caption = `${slide.city.replace(/&nbsp;/g, ' ')} — ${slide.car.replace(/&nbsp;/g, ' ')} at modern house`;
    document.getElementById('slideCaption').innerHTML = caption;
  }

  function showSlide(index) {
    const container = document.getElementById('slideshow');
    const items = container.children;
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;
    currentSlide = index;
    Array.from(items).forEach((item, idx) => {
      item.classList.toggle('active', idx === currentSlide);
    });
    updateSlideCaption();
  }

  function nextSlide() {
    showSlide(currentSlide + 1);
  }
  function prevSlide() {
    showSlide(currentSlide - 1);
  }

  function startSlideshow() {
    clearInterval(slideTimer);
    slideTimer = setInterval(() => {
      nextSlide();
    }, 5000);
  }

  // Mini‑game: Orb Catcher
  let gameInterval;
  let gameTimer;
  let gameTimeLeft;
  let gameScore;
  let lastClickTime;
  function startGame() {
    // Reset
    clearInterval(gameInterval);
    clearInterval(gameTimer);
    const area = document.getElementById('gameArea');
    area.innerHTML = '';
    gameScore = 0;
    gameTimeLeft = 30;
    lastClickTime = null;
    document.getElementById('gameScore').textContent = gameScore;
    document.getElementById('gameTime').textContent = gameTimeLeft;
    // Spawn orbs every ~600ms
    gameInterval = setInterval(spawnOrb, 600);
    // Timer countdown
    gameTimer = setInterval(() => {
      gameTimeLeft--;
      document.getElementById('gameTime').textContent = gameTimeLeft;
      if (gameTimeLeft <= 0) {
        endGame();
      }
    }, 1000);
  }

  function spawnOrb() {
    const area = document.getElementById('gameArea');
    const orb = document.createElement('button');
    orb.className = 'orb-btn';
    const size = 40;
    const x = Math.random() * (area.clientWidth - size);
    const y = Math.random() * (area.clientHeight - size);
    orb.style.left = `${x}px`;
    orb.style.top = `${y}px`;
    orb.addEventListener('click', () => {
      // Calculate timing bonus
      const now = Date.now();
      let bonus = 1;
      if (lastClickTime) {
        const diff = now - lastClickTime;
        if (diff < 200) bonus = 5;
        else if (diff < 350) bonus = 3;
        else if (diff < 500) bonus = 2;
      }
      lastClickTime = now;
      gameScore += 10 * bonus;
      document.getElementById('gameScore').textContent = gameScore;
      beep(880 + bonus * 40, 0.05, 0.05);
      area.removeChild(orb);
    });
    area.appendChild(orb);
    // Remove after lifetime
    setTimeout(() => {
      if (area.contains(orb)) {
        area.removeChild(orb);
      }
    }, 2400);
  }

  function endGame() {
    clearInterval(gameInterval);
    clearInterval(gameTimer);
    // award XP
    const xpEarned = Math.floor(gameScore / 6);
    if (xpEarned > 0) {
      state.xp += xpEarned;
      state.coins += Math.floor(xpEarned / 2);
      if (gameScore > state.bestScore) state.bestScore = gameScore;
      levelCheck();
      saveState();
      beep(990, 0.3);
      updateAll();
    }
    alert(`Game over! Score: ${gameScore}, XP earned: ${xpEarned}`);
  }

  // Event listeners and initialisation
  function init() {
    loadState();
    loadTheme();
    loadSound();
    renderProfile();
    renderProgressRing();
    renderPoints();
    renderStreak();
    renderRank();
    renderHeroXP();
    renderTopPlayers();
    renderLeaderboard();
    renderAchievements();
    renderShop();
    renderQuestBoard();
    attachParallax();
    renderSlideshow();
    startSlideshow();
    document.getElementById('pointsTotal');
    // Listeners
    document.getElementById('themeToggle').addEventListener('click', () => {
      const isLight = document.documentElement.classList.toggle('light');
      saveTheme(isLight ? 'light' : 'dark');
      updateThemeIcon();
    });
    document.getElementById('soundToggle').addEventListener('click', () => {
      state.sound = !state.sound;
      saveSound();
      updateSoundIcon();
    });
    document.getElementById('startQuizBtn').addEventListener('click', openQuiz);
    document.getElementById('closeQuizBtn').addEventListener('click', () => {
      document.getElementById('quizDialog').close();
    });
    document.getElementById('openBuilderBtn').addEventListener('click', () => openBuilder());
    document.getElementById('randomizeSceneBtn').addEventListener('click', randomizeBuilder);
    document.getElementById('saveSceneBtn').addEventListener('click', saveBuilderScene);
    document.getElementById('closeBuilderBtn').addEventListener('click', () => {
      document.getElementById('builderDialog').close();
    });
    document.getElementById('prevSlideBtn').addEventListener('click', () => {
      prevSlide();
      startSlideshow();
    });
    document.getElementById('nextSlideBtn').addEventListener('click', () => {
      nextSlide();
      startSlideshow();
    });
    document.getElementById('buildSceneBtn').addEventListener('click', () => {
      const slide = slides[currentSlide];
      openBuilder({ src: slide.img, alt: `${slide.city} ${slide.car}` });
    });
    document.getElementById('questSearch').addEventListener('input', () => {
      currentQuestPage = 1;
      renderQuestBoard();
    });
    document.getElementById('questFilter').addEventListener('change', () => {
      currentQuestPage = 1;
      renderQuestBoard();
    });
    document.getElementById('startGameBtn').addEventListener('click', startGame);
    // Keyboard navigation for slideshow
    document.addEventListener('keydown', e => {
      if (document.querySelector('dialog[open]')) return; // disable in modals
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') {
        nextSlide();
        startSlideshow();
      } else if (e.key === 'ArrowLeft') {
        prevSlide();
        startSlideshow();
      }
    });
  }

  function updateAll() {
    renderProfile();
    renderProgressRing();
    renderPoints();
    renderStreak();
    renderRank();
    renderHeroXP();
    renderTopPlayers();
    renderLeaderboard();
    renderAchievements();
    renderShop();
    renderQuestBoard();
  }

  document.addEventListener('DOMContentLoaded', init);
})();