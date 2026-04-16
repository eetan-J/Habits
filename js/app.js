/* ================================================================
   Habits — App Logic
   ================================================================ */

'use strict';

// ── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'habits_v1';

const EMOJIS = [
  '🏃','💪','🧘','🚴','🏊','⚽','🎾',
  '🥗','💧','🍎','☕','🥦','🍵','🥤',
  '📚','✍️','🎨','🎵','💻','📖','🗒️',
  '😴','🌅','🧹','🌿','🐾','💊','🫀',
  '🙏','❤️','🌟','✨','🎯','🔥','⚡',
];

const COLOURS = [
  { id: 'blue',   hex: '#007AFF' },
  { id: 'green',  hex: '#34C759' },
  { id: 'red',    hex: '#FF3B30' },
  { id: 'orange', hex: '#FF9500' },
  { id: 'pink',   hex: '#FF2D55' },
  { id: 'purple', hex: '#AF52DE' },
  { id: 'teal',   hex: '#5AC8FA' },
  { id: 'indigo', hex: '#5856D6' },
  { id: 'yellow', hex: '#FFCC00' },
];

// ── State ──────────────────────────────────────────────────────

let habits     = [];      // Array<Habit>
let activeTab  = 'today'; // 'today' | 'habits' | 'stats'
let editingId  = null;    // null | string — id of habit being edited
let deletingId = null;    // null | string — id of habit pending delete

// selected values in the modal
let modalEmoji  = EMOJIS[0];
let modalColour = COLOURS[0].hex;

// ── Helpers ────────────────────────────────────────────────────

/** Returns today's date as 'YYYY-MM-DD' */
function today() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Returns number of consecutive days (ending today) that have been completed */
function calcStreak(completedDates) {
  if (!completedDates || completedDates.length === 0) return 0;
  const sorted = [...new Set(completedDates)].sort().reverse();
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const dateStr of sorted) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((cursor - d) / 86_400_000);
    if (diff === 0 || diff === streak) {
      streak++;
      cursor = d;
    } else {
      break;
    }
  }
  return streak;
}

/** Total completions across all time */
function totalCompletions(habit) {
  return (habit.completedDates || []).length;
}

/** Completion rate over last 7 days */
function weeklyRate(habit) {
  const dates = habit.completedDates || [];
  const now = new Date();
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (dates.includes(ds)) count++;
  }
  return Math.round((count / 7) * 100);
}

// ── Persistence ────────────────────────────────────────────────

function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    habits = raw ? JSON.parse(raw) : [];
  } catch {
    habits = [];
  }
}

function saveHabits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

// ── DOM References ─────────────────────────────────────────────

const $ = id => document.getElementById(id);

const dom = {
  navTitle:         $('navTitle'),
  navRightBtn:      $('navRightBtn'),

  tabToday:         $('tabToday'),
  tabHabits:        $('tabHabits'),
  tabStats:         $('tabStats'),

  todayWeekday:     $('todayWeekday'),
  todayDate:        $('todayDate'),

  progressRingFill: $('progressRingFill'),
  progressNum:      $('progressNum'),
  progressTotal:    $('progressTotal'),
  progressTitle:    $('progressTitle'),
  progressSub:      $('progressSub'),

  todayHabitList:   $('todayHabitList'),
  todayEmpty:       $('todayEmpty'),

  allHabitList:     $('allHabitList'),
  habitsEmpty:      $('habitsEmpty'),

  statsGrid:        $('statsGrid'),
  streakList:       $('streakList'),
  statsEmpty:       $('statsEmpty'),

  // Modal — Habit
  habitModal:       $('habitModal'),
  habitModalTitle:  $('habitModalTitle'),
  habitModalSave:   $('habitModalSave'),
  habitModalCancel: $('habitModalCancel'),
  habitNameInput:   $('habitNameInput'),
  emojiGrid:        $('emojiGrid'),
  colorPicker:      $('colorPicker'),

  // Modal — Delete
  deleteModal:      $('deleteModal'),
  deleteHabitName:  $('deleteHabitName'),
  deleteCancelBtn:  $('deleteCancelBtn'),
  deleteConfirmBtn: $('deleteConfirmBtn'),
};

// ── Render: Today Tab ──────────────────────────────────────────

function renderToday() {
  const t = today();
  const d = new Date();

  dom.todayWeekday.textContent = d.toLocaleDateString('en-US', { weekday: 'long' });
  dom.todayDate.textContent    = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  const total   = habits.length;
  const done    = habits.filter(h => (h.completedDates || []).includes(t)).length;
  const pct     = total > 0 ? done / total : 0;
  const circumference = 2 * Math.PI * 42; // r=42, but SVG r=42, circumference ~264

  dom.progressRingFill.style.strokeDashoffset = circumference * (1 - pct);
  dom.progressRingFill.style.stroke = pct === 1 ? '#34C759' : pct > 0.5 ? '#007AFF' : '#34C759';
  dom.progressNum.textContent  = done;
  dom.progressTotal.textContent = `/${total}`;

  if (total === 0) {
    dom.progressTitle.textContent = 'No habits yet';
    dom.progressSub.textContent   = 'Add your first habit to begin!';
  } else if (done === total) {
    dom.progressTitle.textContent = 'All done! 🎉';
    dom.progressSub.textContent   = 'Amazing work today!';
  } else {
    const left = total - done;
    dom.progressTitle.textContent = `${left} remaining`;
    dom.progressSub.textContent   = done === 0
      ? 'Let\'s get started!'
      : `${done} completed so far`;
  }

  // List
  dom.todayHabitList.innerHTML = '';
  if (habits.length === 0) {
    dom.todayEmpty.style.display = '';
    dom.todayHabitList.style.display = 'none';
    return;
  }
  dom.todayEmpty.style.display = 'none';
  dom.todayHabitList.style.display = '';

  habits.forEach(habit => {
    const isDone = (habit.completedDates || []).includes(t);
    const streak = calcStreak(habit.completedDates || []);

    const li = document.createElement('li');
    li.className = 'habit-item' + (isDone ? ' done' : '');
    li.dataset.id = habit.id;
    li.setAttribute('role', 'checkbox');
    li.setAttribute('aria-checked', isDone ? 'true' : 'false');
    li.setAttribute('tabindex', '0');

    li.innerHTML = `
      <div class="habit-item__icon" style="background:${habit.colour}22;">
        <span>${habit.emoji}</span>
      </div>
      <div class="habit-item__info">
        <p class="habit-item__name">${escHtml(habit.name)}</p>
        <p class="habit-item__streak">
          ${streak > 0 ? `🔥 ${streak} day streak` : '⭐ Start your streak!'}
        </p>
      </div>
      <div class="habit-item__check" style="${isDone ? `background:${habit.colour};border-color:${habit.colour};` : `border-color:${habit.colour}88;`}">
        <svg class="check-svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;

    li.addEventListener('click',  () => toggleHabit(habit.id));
    li.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') toggleHabit(habit.id); });
    dom.todayHabitList.appendChild(li);
  });
}

// ── Render: Habits Tab ─────────────────────────────────────────

function renderHabits() {
  dom.allHabitList.innerHTML = '';
  if (habits.length === 0) {
    dom.habitsEmpty.style.display = '';
    dom.allHabitList.style.display = 'none';
    return;
  }
  dom.habitsEmpty.style.display = 'none';
  dom.allHabitList.style.display = '';

  habits.forEach(habit => {
    const streak = calcStreak(habit.completedDates || []);
    const total  = totalCompletions(habit);

    const li = document.createElement('li');
    li.className = 'habit-item';
    li.dataset.id = habit.id;

    li.innerHTML = `
      <div class="habit-item__icon" style="background:${habit.colour}22;">
        <span>${habit.emoji}</span>
      </div>
      <div class="habit-item__info">
        <p class="habit-item__name">${escHtml(habit.name)}</p>
        <p class="habit-item__streak">${total} total · ${streak > 0 ? `🔥 ${streak} day streak` : 'No streak'}</p>
      </div>
      <div class="habit-item__actions">
        <button class="action-btn action-btn--edit" data-action="edit" aria-label="Edit ${escHtml(habit.name)}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="action-btn action-btn--delete" data-action="delete" aria-label="Delete ${escHtml(habit.name)}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 5h10M6 5V3h4v2M7 8v4M9 8v4M4 5l1 8h6l1-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;

    li.querySelector('[data-action="edit"]').addEventListener('click',   () => openEditHabit(habit.id));
    li.querySelector('[data-action="delete"]').addEventListener('click', () => openDeleteConfirm(habit.id));
    dom.allHabitList.appendChild(li);
  });
}

// ── Render: Stats Tab ──────────────────────────────────────────

function renderStats() {
  if (habits.length === 0) {
    dom.statsGrid.innerHTML  = '';
    dom.streakList.innerHTML = '';
    dom.statsEmpty.style.display = '';
    return;
  }
  dom.statsEmpty.style.display = 'none';

  const t     = today();
  const todayDone = habits.filter(h => (h.completedDates || []).includes(t)).length;
  const allDone   = habits.reduce((s, h) => s + totalCompletions(h), 0);
  const bestStreak = habits.reduce((best, h) => Math.max(best, calcStreak(h.completedDates || [])), 0);
  const avgWeekly  = habits.length
    ? Math.round(habits.reduce((s, h) => s + weeklyRate(h), 0) / habits.length)
    : 0;

  dom.statsGrid.innerHTML = `
    <div class="stat-card">
      <p class="stat-card__label">Today</p>
      <p class="stat-card__value" style="color:var(--c-green)">${todayDone}<span style="font-size:16px;color:var(--text-secondary)">/${habits.length}</span></p>
      <p class="stat-card__unit">completed</p>
    </div>
    <div class="stat-card">
      <p class="stat-card__label">Total</p>
      <p class="stat-card__value" style="color:var(--c-blue)">${allDone}</p>
      <p class="stat-card__unit">all time</p>
    </div>
    <div class="stat-card">
      <p class="stat-card__label">Best Streak</p>
      <p class="stat-card__value" style="color:var(--c-orange)">${bestStreak}</p>
      <p class="stat-card__unit">days</p>
    </div>
    <div class="stat-card">
      <p class="stat-card__label">7-Day Rate</p>
      <p class="stat-card__value" style="color:var(--c-purple)">${avgWeekly}<span style="font-size:16px;color:var(--text-secondary)">%</span></p>
      <p class="stat-card__unit">avg completion</p>
    </div>
  `;

  // Streak list — sorted by streak desc
  const sorted = [...habits].sort((a, b) =>
    calcStreak(b.completedDates || []) - calcStreak(a.completedDates || [])
  );

  dom.streakList.innerHTML = '';
  sorted.forEach(habit => {
    const streak = calcStreak(habit.completedDates || []);
    const rate   = weeklyRate(habit);

    const li = document.createElement('li');
    li.className = 'streak-item';
    li.innerHTML = `
      <div class="streak-item__icon" style="background:${habit.colour}22;">${habit.emoji}</div>
      <div class="streak-item__info">
        <p class="streak-item__name">${escHtml(habit.name)}</p>
        <p class="streak-item__sub">${rate}% this week · ${totalCompletions(habit)} total</p>
      </div>
      <div class="streak-badge">
        <span>${streak > 0 ? '🔥' : '💤'}</span>
        <span>${streak}</span>
      </div>
    `;
    dom.streakList.appendChild(li);
  });
}

// ── Toggle Habit ───────────────────────────────────────────────

function toggleHabit(id) {
  const habit = habits.find(h => h.id === id);
  if (!habit) return;

  const t   = today();
  const idx = (habit.completedDates || []).indexOf(t);

  if (!habit.completedDates) habit.completedDates = [];

  if (idx === -1) {
    habit.completedDates.push(t);
    // Bounce animation
    const el = dom.todayHabitList.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.classList.add('completing');
      setTimeout(() => el.classList.remove('completing'), 300);
    }
  } else {
    habit.completedDates.splice(idx, 1);
  }

  saveHabits();
  renderToday();
}

// ── Habit Modal ────────────────────────────────────────────────

function buildModalPickers() {
  // Emoji grid
  dom.emojiGrid.innerHTML = '';
  EMOJIS.forEach(em => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn' + (em === modalEmoji ? ' selected' : '');
    btn.type      = 'button';
    btn.textContent = em;
    btn.setAttribute('aria-label', em);
    btn.addEventListener('click', () => {
      modalEmoji = em;
      dom.emojiGrid.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    dom.emojiGrid.appendChild(btn);
  });

  // Color picker
  dom.colorPicker.innerHTML = '';
  COLOURS.forEach(c => {
    const sw = document.createElement('button');
    sw.className = 'color-swatch' + (c.hex === modalColour ? ' selected' : '');
    sw.type      = 'button';
    sw.style.background = c.hex;
    sw.setAttribute('aria-label', c.id);
    sw.addEventListener('click', () => {
      modalColour = c.hex;
      dom.colorPicker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
    dom.colorPicker.appendChild(sw);
  });
}

function openAddHabit() {
  editingId    = null;
  modalEmoji   = EMOJIS[Math.floor(Math.random() * 8)];
  modalColour  = COLOURS[Math.floor(Math.random() * COLOURS.length)].hex;

  dom.habitModalTitle.textContent  = 'New Habit';
  dom.habitModalSave.textContent   = 'Add';
  dom.habitNameInput.value         = '';

  buildModalPickers();
  openModal(dom.habitModal);
  setTimeout(() => dom.habitNameInput.focus(), 350);
}

function openEditHabit(id) {
  const habit = habits.find(h => h.id === id);
  if (!habit) return;

  editingId   = id;
  modalEmoji  = habit.emoji;
  modalColour = habit.colour;

  dom.habitModalTitle.textContent  = 'Edit Habit';
  dom.habitModalSave.textContent   = 'Save';
  dom.habitNameInput.value         = habit.name;

  buildModalPickers();
  openModal(dom.habitModal);
  setTimeout(() => dom.habitNameInput.focus(), 350);
}

function saveHabitFromModal() {
  const name = dom.habitNameInput.value.trim();
  if (!name) {
    dom.habitNameInput.focus();
    dom.habitNameInput.style.boxShadow = '0 0 0 3px rgba(255,59,48,0.3)';
    setTimeout(() => { dom.habitNameInput.style.boxShadow = ''; }, 1200);
    return;
  }

  if (editingId) {
    const habit = habits.find(h => h.id === editingId);
    if (habit) {
      habit.name   = name;
      habit.emoji  = modalEmoji;
      habit.colour = modalColour;
    }
  } else {
    habits.push({
      id:             uid(),
      name,
      emoji:          modalEmoji,
      colour:         modalColour,
      createdAt:      new Date().toISOString(),
      completedDates: [],
    });
  }

  saveHabits();
  closeModal(dom.habitModal);
  renderAll();
}

// ── Delete Modal ───────────────────────────────────────────────

function openDeleteConfirm(id) {
  const habit = habits.find(h => h.id === id);
  if (!habit) return;
  deletingId = id;
  dom.deleteHabitName.textContent = habit.name;
  openModal(dom.deleteModal);
}

function confirmDelete() {
  if (!deletingId) return;
  habits = habits.filter(h => h.id !== deletingId);
  deletingId = null;
  saveHabits();
  closeModal(dom.deleteModal);
  renderAll();
}

// ── Modal Helpers ──────────────────────────────────────────────

function openModal(overlay) {
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(overlay) {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// Close sheet by tapping backdrop
[dom.habitModal, dom.deleteModal].forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay);
  });
});

// ── Tab Switching ──────────────────────────────────────────────

const TABS = {
  today:  { pane: dom.tabToday,  title: 'Today',  showAdd: true  },
  habits: { pane: dom.tabHabits, title: 'Habits', showAdd: true  },
  stats:  { pane: dom.tabStats,  title: 'Stats',  showAdd: false },
};

function switchTab(name) {
  if (!TABS[name]) return;
  activeTab = name;

  // Update panes
  Object.values(TABS).forEach(({ pane }) => pane.classList.remove('active'));
  TABS[name].pane.classList.add('active');

  // Update tab bar
  document.querySelectorAll('.tab-bar__item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });

  // Nav bar
  dom.navTitle.textContent          = TABS[name].title;
  dom.navRightBtn.style.display     = TABS[name].showAdd ? '' : 'none';

  renderCurrentTab();
}

function renderCurrentTab() {
  if (activeTab === 'today')  renderToday();
  if (activeTab === 'habits') renderHabits();
  if (activeTab === 'stats')  renderStats();
}

function renderAll() {
  renderToday();
  renderHabits();
  renderStats();
}

// ── Security: escape HTML ──────────────────────────────────────

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Event Listeners ────────────────────────────────────────────

// Tab bar clicks
document.querySelectorAll('.tab-bar__item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Nav right button (Add)
dom.navRightBtn.addEventListener('click', openAddHabit);

// Modal — Habit
dom.habitModalCancel.addEventListener('click', () => closeModal(dom.habitModal));
dom.habitModalSave.addEventListener('click',   saveHabitFromModal);
dom.habitNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveHabitFromModal();
});

// Modal — Delete
dom.deleteCancelBtn.addEventListener('click',  () => closeModal(dom.deleteModal));
dom.deleteConfirmBtn.addEventListener('click', confirmDelete);

// Close modals on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (dom.habitModal.classList.contains('open'))  closeModal(dom.habitModal);
    if (dom.deleteModal.classList.contains('open')) closeModal(dom.deleteModal);
  }
});

// ── Boot ───────────────────────────────────────────────────────

loadHabits();
switchTab('today');
