/* ============================================================
   HABITS // APP LOGIC
   ============================================================ */

'use strict';

// ── Constants ─────────────────────────────────────────────────
const STORAGE_KEY = 'habits_v1';
const DAYS_IN_WEEK = 7;
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_LABELS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// ── State ──────────────────────────────────────────────────────
let habits = [];       // [{ id, name, color, checks: { "YYYY-MM-DD": true } }]
let deleteTargetId = null;

// ── Utilities ──────────────────────────────────────────────────
function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function today() {
  return new Date();
}

/** Return the 7 dates of the current week (Sun → Sat). */
function currentWeekDates() {
  const now = today();
  const day = now.getDay(); // 0 = Sunday
  const dates = [];
  for (let i = 0; i < DAYS_IN_WEEK; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - day + i);
    dates.push(d);
  }
  return dates;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Persistence ────────────────────────────────────────────────
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  } catch (_) { /* storage unavailable */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) habits = JSON.parse(raw);
  } catch (_) {
    habits = [];
  }
  if (!Array.isArray(habits)) habits = [];
}

// ── Streak Calculation ─────────────────────────────────────────
/**
 * Number of consecutive days (ending today) on which every habit was completed.
 */
function calcStreak() {
  if (!habits.length) return 0;
  let streak = 0;
  const base = today();
  for (let offset = 0; offset < 365; offset++) {
    const d = new Date(base);
    d.setDate(base.getDate() - offset);
    const key = dateKey(d);
    const allDone = habits.every(h => h.checks[key]);
    if (!allDone) break;
    streak++;
  }
  return streak;
}

// ── DOM Helpers ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

// ── Header ─────────────────────────────────────────────────────
function renderHeader() {
  const now = today();
  const dateStr = `${DAY_LABELS[now.getDay()]}  ${String(now.getDate()).padStart(2,'0')} ${MONTH_LABELS[now.getMonth()]} ${now.getFullYear()}`;
  $('dateDisplay').textContent = dateStr;

  const streak = calcStreak();
  const badge = $('streakBadge');
  if (streak > 0) {
    badge.textContent = `▲ ${streak}D STREAK`;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ── Week Header Row ────────────────────────────────────────────
function renderWeekHeader(weekDates) {
  const container = $('weekHeader');
  container.innerHTML = '';

  const labelEl = el('span', 'week-label', 'HABIT');
  container.appendChild(labelEl);

  const todayKey = dateKey(today());
  weekDates.forEach(d => {
    const isToday = dateKey(d) === todayKey;
    const span = el('span', 'day-label' + (isToday ? ' is-today' : ''), DAY_LABELS[d.getDay()]);
    container.appendChild(span);
  });
}

// ── Habits List ────────────────────────────────────────────────
function renderHabits(weekDates) {
  const list = $('habitsList');
  const empty = $('emptyState');

  // Remove all habit rows (keep empty state node)
  Array.from(list.querySelectorAll('.habit-row')).forEach(r => r.remove());

  if (!habits.length) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  const todayKey = dateKey(today());
  const nowTime = today().getTime();

  habits.forEach(habit => {
    const row = el('div', 'habit-row');
    row.setAttribute('role', 'listitem');

    // Name cell
    const nameWrap = el('div', 'habit-name-wrap');

    const indicator = el('span', 'habit-indicator');
    indicator.style.backgroundColor = habit.color;
    indicator.style.boxShadow = `0 0 6px ${habit.color}88`;
    nameWrap.appendChild(indicator);

    const name = el('span', 'habit-name', habit.name);
    name.title = habit.name;
    nameWrap.appendChild(name);

    const delBtn = el('button', 'habit-delete', '✕');
    delBtn.setAttribute('aria-label', `Delete ${habit.name}`);
    delBtn.addEventListener('click', () => openDeleteModal(habit.id, habit.name));
    nameWrap.appendChild(delBtn);

    row.appendChild(nameWrap);

    // LED dots for each day
    weekDates.forEach(d => {
      const key = dateKey(d);
      const isToday = key === todayKey;

      // Determine if date is in the future (after end of today)
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const isFuture = dayEnd.getTime() > nowTime && !isToday;

      const checked = !!habit.checks[key];

      const dot = el('div', 'led-dot');
      if (checked) dot.classList.add('is-checked');
      if (isToday) dot.classList.add('is-today');
      if (isFuture) dot.classList.add('is-future');

      dot.style.setProperty('--dot-color', habit.color);

      const inner = el('div', 'led-dot-inner');
      dot.appendChild(inner);

      if (!isFuture) {
        dot.setAttribute('role', 'checkbox');
        dot.setAttribute('aria-checked', checked ? 'true' : 'false');
        dot.setAttribute('aria-label', `${habit.name} on ${DAY_LABELS[d.getDay()]}`);
        dot.setAttribute('tabindex', '0');

        const toggle = () => toggleCheck(habit.id, key);
        dot.addEventListener('click', toggle);
        dot.addEventListener('keydown', e => {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
        });
      }

      row.appendChild(dot);
    });

    list.appendChild(row);
  });
}

// ── Progress Bar ───────────────────────────────────────────────
function renderProgress() {
  const todayKey = dateKey(today());
  const total = habits.length;
  const done = habits.filter(h => h.checks[todayKey]).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  $('progressCount').textContent = `${done} / ${total}`;

  const fill = $('progressFill');
  fill.style.width = pct + '%';

  const bar = $('progressBar');
  bar.setAttribute('aria-valuenow', pct);

  // Color shift: green → amber → red inverse
  if (pct === 100) {
    fill.style.background = 'var(--led-green)';
    fill.style.boxShadow = 'var(--glow-green)';
  } else if (pct >= 50) {
    fill.style.background = 'var(--led-amber)';
    fill.style.boxShadow = 'var(--glow-amber)';
  } else {
    fill.style.background = 'var(--led-green)';
    fill.style.boxShadow = 'var(--glow-green)';
  }

  // LED segment dividers
  const ledsEl = $('progressLeds');
  ledsEl.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    ledsEl.appendChild(el('div', 'progress-led'));
  }
}

// ── Full Render ────────────────────────────────────────────────
function render() {
  const weekDates = currentWeekDates();
  renderHeader();
  renderWeekHeader(weekDates);
  renderHabits(weekDates);
  renderProgress();
}

// ── Mutations ──────────────────────────────────────────────────
function addHabit(name, color) {
  habits.push({ id: generateId(), name: name.trim().toUpperCase(), color, checks: {} });
  saveState();
  render();
}

function toggleCheck(habitId, key) {
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return;
  habit.checks[key] = !habit.checks[key];
  saveState();
  render();
}

function deleteHabit(id) {
  habits = habits.filter(h => h.id !== id);
  saveState();
  render();
}

// ── Delete Modal ───────────────────────────────────────────────
function openDeleteModal(id, name) {
  deleteTargetId = id;
  $('modalBody').textContent = `"${name}" AND ALL ITS DATA WILL BE PERMANENTLY REMOVED.`;
  $('modalOverlay').removeAttribute('hidden');
  $('modalConfirm').focus();
}

function closeDeleteModal() {
  deleteTargetId = null;
  $('modalOverlay').setAttribute('hidden', '');
}

// ── Event Listeners ────────────────────────────────────────────
$('addForm').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('habitInput');
  const name = input.value.trim();
  if (!name) return;
  const color = $('colorInput').value;
  addHabit(name, color);
  input.value = '';
  input.focus();
});

// Sync color dot preview with native color picker
$('colorInput').addEventListener('input', () => {
  $('colorDot').style.backgroundColor = $('colorInput').value;
});

$('modalCancel').addEventListener('click', closeDeleteModal);
$('modalConfirm').addEventListener('click', () => {
  if (deleteTargetId) deleteHabit(deleteTargetId);
  closeDeleteModal();
});

// Close modal on overlay click
$('modalOverlay').addEventListener('click', e => {
  if (e.target === $('modalOverlay')) closeDeleteModal();
});

// Close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDeleteModal();
});

// ── Init ───────────────────────────────────────────────────────
loadState();
render();

// Refresh at midnight so the tracker stays current without a page reload
(function scheduleMidnightRefresh() {
  const now = today();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const ms = midnight - now;
  setTimeout(() => { render(); scheduleMidnightRefresh(); }, ms);
})();
