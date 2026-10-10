'use strict';

/* ============================================================
   GreenBuddy AI
   ============================================================ */

// ---- Config ---------------------------------------------------
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llama3.2'; // change to any model you have pulled
const OLLAMA_TIMEOUT_MS = 60000;
const DAILY_GOAL = 30;           // minutes
const LOG_STEP = 10;             // minutes per quick-log click
const STORAGE_KEY = 'greenbuddy-state-v1';

const DEFAULT_SESSION = {
    name: 'Touch Grass',
    minutes: 20,
    text: 'Spend 20 minutes outside without scrolling through social media. Notice five things you can see in nature.'
};

const ACTIVITY_TEXT = {
    'Mindful Walking': 'Walk slowly with your phone away. Feel each step and notice sounds, smells and colours around you.',
    'Gardening': 'Plant a seed, water a plant or tidy a garden bed. Notice the soil, the smell and the small changes.',
    'Bird Watching': 'Sit somewhere quiet and listen first. Try to spot three different birds or count how many calls you hear.',
    'Nature Exploration': 'Visit a nearby park or safe trail. Look for something you have never noticed there before.'
};

// ---- Helpers --------------------------------------------------
const $ = (id) => document.getElementById(id);
const todayKey = () => new Date().toLocaleDateString('en-CA');
const pad = (n) => String(n).padStart(2, '0');
const formatTime = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;

let toastTimer;
function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ---- Persistent daily state ------------------------------------
function loadState() {
    const fresh = { date: todayKey(), minutes: 0, completed: 0 };
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved && saved.date === todayKey()) {
            return {
                date: saved.date,
                minutes: Math.max(0, Number(saved.minutes) || 0),
                completed: Math.max(0, Number(saved.completed) || 0)
            };
        }
    } catch (e) { /* storage unavailable or corrupt */ }
    return fresh;
}

function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

const state = loadState();

function renderProgress() {
    const percent = Math.min(100, Math.round((state.minutes / DAILY_GOAL) * 100));
    $('completedCount').textContent = state.completed;
    $('minutesCount').textContent = state.minutes;
    $('progressPercent').textContent = `${percent}%`;
    $('progressFill').style.width = `${percent}%`;
    $('progressTrack').setAttribute('aria-valuenow', percent);
    $('progressText').textContent = state.minutes >= DAILY_GOAL
        ? `Goal reached! ${state.minutes} minutes outdoors today 🎉`
        : `${state.minutes} of ${DAILY_GOAL} minutes completed`;
}

function logMinutes(minutes, countAsActivity = true) {
    // Roll over to a new day if the page was left open overnight
    if (state.date !== todayKey()) {
        state.date = todayKey();
        state.minutes = 0;
        state.completed = 0;
    }
    const before = state.minutes;
    state.minutes += minutes;
    if (countAsActivity) state.completed += 1;
    saveState();
    renderProgress();
    if (before < DAILY_GOAL && state.minutes >= DAILY_GOAL) {
        showToast('🎉 You hit your daily outdoor goal. Well done!');
    }
}

// ---- Timer ------------------------------------------------------
const timer = {
    session: { ...DEFAULT_SESSION },
    total: DEFAULT_SESSION.minutes * 60,
    remaining: DEFAULT_SESSION.minutes * 60,
    endTime: 0,
    tick: null,
    status: 'idle' // idle | running | paused
};

function renderTimer() {
    $('timerDisplay').textContent = formatTime(timer.remaining);
    const elapsed = timer.total - timer.remaining;
    $('timerCircle').style.setProperty('--progress', ((elapsed / timer.total) * 100).toFixed(2));

    const startBtn = $('startChallenge');
    const pauseBtn = $('pauseTimer');

    if (timer.status === 'running') {
        startBtn.textContent = 'In progress…';
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        pauseBtn.textContent = 'Pause';
        $('timerStatus').textContent = 'Phone away. Look around. Breathe.';
        document.title = `${formatTime(timer.remaining)} · GreenBuddy AI`;
    } else if (timer.status === 'paused') {
        startBtn.textContent = 'Resume →';
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        $('timerStatus').textContent = 'Paused. Resume when you are ready.';
        document.title = 'GreenBuddy AI | Touch Grass';
    } else {
        startBtn.textContent = 'Start My Challenge →';
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        pauseBtn.textContent = 'Pause';
        document.title = 'GreenBuddy AI | Touch Grass';
    }
}

function stopTick() {
    clearInterval(timer.tick);
    timer.tick = null;
}

function startTimer() {
    if (timer.status === 'running') return;
    timer.endTime = Date.now() + timer.remaining * 1000;
    timer.status = 'running';
    stopTick();
    timer.tick = setInterval(() => {
        // Based on the clock, so it stays accurate in background tabs
        timer.remaining = Math.max(0, Math.round((timer.endTime - Date.now()) / 1000));
        renderTimer();
        if (timer.remaining <= 0) completeTimer();
    }, 250);
    renderTimer();
}

function pauseTimer() {
    if (timer.status !== 'running') return;
    stopTick();
    timer.remaining = Math.max(0, Math.round((timer.endTime - Date.now()) / 1000));
    timer.status = 'paused';
    renderTimer();
}

function resetTimer() {
    stopTick();
    timer.status = 'idle';
    timer.remaining = timer.total;
    $('timerStatus').textContent = 'Ready when you are.';
    renderTimer();
}

function completeTimer() {
    stopTick();
    timer.status = 'idle';
    timer.remaining = timer.total;
    logMinutes(timer.session.minutes, true);
    renderTimer();
    $('timerStatus').textContent = `Session complete! ${timer.session.minutes} minutes logged 🌿`;
    showToast(`✅ ${timer.session.name} complete. ${timer.session.minutes} minutes logged.`);
}

function setSession(session) {
    timer.session = session;
    timer.total = session.minutes * 60;
    timer.remaining = timer.total;
    timer.status = 'idle';
    stopTick();

    $('challengeTitle').innerHTML = '';
    if (session.name === DEFAULT_SESSION.name) {
        $('challengeTitle').append("Today's challenge:", document.createElement('br'), 'Touch Grass 🌿');
    } else {
        $('challengeTitle').append("Today's challenge:", document.createElement('br'), `${session.name} 🌿`);
    }
    $('challengeText').textContent = session.text;
    $('challengeDuration').textContent = `⏱ ${session.minutes} minutes`;
    $('timerStatus').textContent = 'Ready when you are.';
    renderTimer();
}

function chooseActivity(name, minutes) {
    if (timer.status === 'running' && !confirm('A session is running. Replace it with this activity?')) return;
    setSession({
        name,
        minutes,
        text: ACTIVITY_TEXT[name] || DEFAULT_SESSION.text
    });
    $('challenge').scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`${name} selected. Press Start when you are outside.`);
}

// ---- AI planner -------------------------------------------------
const MOOD_LABEL = {
    relaxed: 'relaxed and calm',
    energetic: 'energetic',
    stressed: 'stressed and needing to unwind',
    curious: 'curious and wanting to explore'
};
const PLACE_LABEL = {
    garden: 'a garden',
    park: 'a park',
    neighborhood: 'their neighborhood',
    nature: 'a nature trail',
    home: 'at home or in the yard'
};

function buildPrompt({ mood, duration, place }) {
    return `You are GreenBuddy, a friendly nature companion. Create a safe, simple outdoor plan.
The person feels ${MOOD_LABEL[mood]}, has ${duration} minutes and wants to be in ${PLACE_LABEL[place]}.
Reply ONLY with JSON in exactly this shape:
{"title":"short catchy title","summary":"one friendly sentence","steps":["step 1","step 2","step 3","step 4"],"tip":"one short tip"}
Rules: 3 to 5 steps, each under 25 words, no phone use during the activity, no markdown.`;
}

// Offline fallback so the planner always works, even without Ollama
function buildLocalPlan({ mood, duration, place }) {
    const moodIdeas = {
        relaxed: ['Move slowly and let your shoulders drop.', 'Pick one spot and watch the light change for a few minutes.'],
        energetic: ['Start with a brisk pace to burn off energy.', 'Add short bursts of movement, like stretching or climbing steps.'],
        stressed: ['Take five slow breaths: in for four, out for six.', 'Name five things you can see and four you can hear.'],
        curious: ['Pick something you have never noticed, like a leaf shape or insect.', 'Follow a path you do not usually take, staying somewhere safe.']
    };
    const placeIdeas = {
        garden: 'Touch the soil or a leaf and notice its texture and smell.',
        park: 'Find a tree and spend a minute studying its bark and branches.',
        neighborhood: 'Look up and notice plants, birds or sky you normally walk past.',
        nature: 'Stay on the marked trail and listen for the quietest sound you can find.',
        home: 'Step into the yard, balcony or doorway and watch the sky for a while.'
    };
    const titles = {
        relaxed: 'A Gentle Reset', energetic: 'Energy in the Open',
        stressed: 'Breathe It Out', curious: 'Small Discoveries'
    };
    const steps = [
        'Leave your phone in a pocket or bag, on silent.',
        ...moodIdeas[mood],
        placeIdeas[place],
        duration >= 60
            ? 'Take a short sit-down break halfway and drink some water.'
            : 'Finish by standing still for one minute and taking in the view.'
    ];
    return {
        title: titles[mood],
        summary: `A ${duration}-minute outdoor plan for when you feel ${MOOD_LABEL[mood]}.`,
        steps,
        tip: 'Tell yourself you only need to start. Most people feel better within ten minutes.',
        source: 'Built-in plan. Start Ollama to get AI-generated plans.'
    };
}

function extractJson(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON in response');
    return JSON.parse(text.slice(start, end + 1));
}

async function fetchOllamaPlan(input) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
    try {
        const res = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: buildPrompt(input),
                stream: false,
                format: 'json'
            }),
            signal: controller.signal
        });
        if (!res.ok) throw new Error(`Ollama responded with ${res.status}`);
        const data = await res.json();
        const plan = extractJson(data.response || '');
        const steps = Array.isArray(plan.steps) ? plan.steps.filter((s) => typeof s === 'string' && s.trim()) : [];
        if (!plan.title || steps.length < 2) throw new Error('Incomplete plan');
        return {
            title: String(plan.title),
            summary: String(plan.summary || ''),
            steps: steps.slice(0, 6),
            tip: String(plan.tip || ''),
            source: `Generated locally with Ollama (${OLLAMA_MODEL}).`
        };
    } finally {
        clearTimeout(timeout);
    }
}

function renderPlan(plan, note) {
    const box = $('aiResult');
    box.replaceChildren();

    const label = document.createElement('span');
    label.textContent = '🌿 YOUR ADVENTURE';
    const title = document.createElement('h3');
    title.textContent = plan.title;
    box.append(label, title);

    if (plan.summary) {
        const p = document.createElement('p');
        p.textContent = plan.summary;
        box.append(p);
    }

    const ul = document.createElement('ul');
    plan.steps.forEach((s) => {
        const li = document.createElement('li');
        li.textContent = s;
        ul.append(li);
    });
    box.append(ul);

    if (plan.tip) {
        const tip = document.createElement('p');
        tip.className = 'plan-tip';
        tip.textContent = `💡 ${plan.tip}`;
        box.append(tip);
    }

    const source = document.createElement('p');
    source.className = 'plan-source';
    source.textContent = note || plan.source;
    box.append(source);
}

function renderLoading() {
    const box = $('aiResult');
    box.replaceChildren();
    const label = document.createElement('span');
    label.textContent = '🌿 PLANNING YOUR ADVENTURE';
    const p = document.createElement('p');
    p.className = 'loading-text';
    const spinner = document.createElement('i');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    p.append(spinner, 'Thinking up something good…');
    box.append(label, p);
}

let generating = false;
async function generatePlan() {
    if (generating) return;
    generating = true;
    const btn = $('generatePlan');
    btn.disabled = true;
    btn.textContent = 'Generating…';
    renderLoading();

    const input = {
        mood: $('mood').value,
        duration: Number($('duration').value),
        place: $('locationType').value
    };

    try {
        renderPlan(await fetchOllamaPlan(input));
    } catch (err) {
        console.warn('Ollama unavailable, using built-in plan:', err);
        const plan = buildLocalPlan(input);
        const reason = err && err.name === 'AbortError'
            ? 'Ollama took too long, so here is a built-in plan.'
            : plan.source;
        renderPlan(plan, reason);
    } finally {
        generating = false;
        btn.disabled = false;
        btn.textContent = '✨ Generate My Adventure';
    }
}

// ---- Init ---------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    renderProgress();
    renderTimer();

    document.querySelectorAll('.activity-button').forEach((btn) => {
        btn.addEventListener('click', () => {
            chooseActivity(btn.dataset.activity, Number(btn.dataset.minutes) || 20);
        });
    });

    $('startChallenge').addEventListener('click', startTimer);
    $('pauseTimer').addEventListener('click', pauseTimer);
    $('resetTimer').addEventListener('click', resetTimer);
    $('logActivity').addEventListener('click', () => {
        logMinutes(LOG_STEP, false);
        showToast(`+${LOG_STEP} outdoor minutes logged 🌱`);
    });
    $('generatePlan').addEventListener('click', generatePlan);
});
