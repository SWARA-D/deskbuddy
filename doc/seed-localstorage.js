/**
 * DeskBuddy — seed demo data into localStorage
 *
 * Paste this entire snippet into the browser console while on any DeskBuddy
 * page to populate habits, goals, tasks, journal entries, and check-ins.
 *
 * Open DevTools → Console → paste → Enter
 */

const now  = Date.now();
const today = new Date().toISOString().slice(0, 10);

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── Habits (deskbuddy_habits) ─────────────────────────────────────────────────
const habits = [
  { id: now + 1, name: "Drink 8 glasses of water",   category: "health",     createdAt: new Date(now - 86400000 * 20).toISOString() },
  { id: now + 2, name: "Read 20 pages",               category: "learning",   createdAt: new Date(now - 86400000 * 18).toISOString() },
  { id: now + 3, name: "10-min morning stretch",      category: "health",     createdAt: new Date(now - 86400000 * 15).toISOString() },
  { id: now + 4, name: "No phone first 30 mins",      category: "confidence", createdAt: new Date(now - 86400000 * 10).toISOString() },
  { id: now + 5, name: "Spanish flashcards (15 min)", category: "learning",   createdAt: new Date(now - 86400000 * 7).toISOString()  },
];

// ── Goals (deskbuddy_goals) ───────────────────────────────────────────────────
const goals = [
  { id: now + 10, title: "Run a 5K without stopping",      category: "health",     dueAt: "2026-05-01", done: false, createdAt: new Date(now - 86400000 * 21).toISOString() },
  { id: now + 11, title: "Finish online design course",    category: "learning",   dueAt: "2026-04-15", done: false, createdAt: new Date(now - 86400000 * 14).toISOString() },
  { id: now + 12, title: "Save $500 this month",           category: "confidence", dueAt: "2026-03-31", done: false, createdAt: new Date(now - 86400000 * 10).toISOString() },
  { id: now + 13, title: "Go one week without social media",category: "confidence",dueAt: "2026-04-01", done: true,  createdAt: new Date(now - 86400000 * 8).toISOString()  },
  { id: now + 14, title: "Cook a new recipe every week",   category: "social",     dueAt: "2026-06-01", done: false, createdAt: new Date(now - 86400000 * 5).toISOString()  },
];

// ── Tasks (deskbuddy_tasks) ───────────────────────────────────────────────────
const tomorrow   = daysAgo(-1);
const in2days    = daysAgo(-2);
const in3days    = daysAgo(-3);
const in5days    = daysAgo(-5);

const tasks = [
  { id: now + 20, title: "Morning run (20 min)",              category: "health",     difficulty: 1, dueAt: today,    status: "done" },
  { id: now + 21, title: "Finish project proposal",           category: "work",       difficulty: 3, dueAt: today,    status: "todo" },
  { id: now + 22, title: "Call dentist to book appointment",  category: "health",     difficulty: 1, dueAt: today,    status: "todo" },
  { id: now + 23, title: "Read 20 pages",                     category: "learning",   difficulty: 1, dueAt: tomorrow, status: "todo" },
  { id: now + 24, title: "Meal prep for the week",            category: "health",     difficulty: 2, dueAt: tomorrow, status: "todo" },
  { id: now + 25, title: "Reply to pending emails",           category: "work",       difficulty: 1, dueAt: in2days,  status: "todo" },
  { id: now + 26, title: "Review Spanish flashcards (15 min)",category: "learning",   difficulty: 1, dueAt: in3days,  status: "todo" },
  { id: now + 27, title: "Deep clean desk + workspace",       category: "confidence", difficulty: 2, dueAt: in5days,  status: "todo" },
];

// ── Journal drafts + analysis (deskbuddy_draft_YYYY-MM-DD) ────────────────────
const journalEntries = [
  {
    date: daysAgo(21),
    text: "First day properly using this app. Setting some intentions for the month — want to be more consistent with journaling, drink more water, and actually go to bed before midnight.",
    analysis: { sentiment: "positive", emotion: "calm", confidence: 0.61, mood_summary: "Reflective and calm start to the month.", habits_to_highlight: [], suggested_tasks: [], _source: "keyword" },
  },
  {
    date: daysAgo(17),
    text: "Completely crashed today. Slept through my alarm, missed a meeting, spent the afternoon trying to catch up. I hate days like this. Everything just piles on.",
    analysis: { sentiment: "negative", emotion: "anxious", confidence: 0.82, mood_summary: "Overwhelmed and frustrated — high-stress day.", habits_to_highlight: [], suggested_tasks: [], _source: "keyword" },
  },
  {
    date: daysAgo(14),
    text: "Decent morning. Made coffee before touching my phone which felt like a win. Did a 20 min walk. Not every day has to be a masterpiece I guess.",
    analysis: { sentiment: "positive", emotion: "calm", confidence: 0.58, mood_summary: "Grounded and gently optimistic.", habits_to_highlight: [], suggested_tasks: [], _source: "keyword" },
  },
  {
    date: daysAgo(11),
    text: "Had a long video call with my sister. We laughed so much. I forget how much I need that. Feeling lighter than I have all week.",
    analysis: { sentiment: "positive", emotion: "excited", confidence: 0.79, mood_summary: "Joyful and recharged — connection helped a lot.", habits_to_highlight: [], suggested_tasks: [], _source: "keyword" },
  },
  {
    date: daysAgo(7),
    text: "Can't shake this low feeling. Nothing is technically wrong but I just feel kind of empty. Going to try to get to bed early and hope tomorrow is better.",
    analysis: { sentiment: "negative", emotion: "sad", confidence: 0.74, mood_summary: "Quiet sadness — needs rest and patience.", habits_to_highlight: [], suggested_tasks: [], _source: "keyword" },
  },
  {
    date: daysAgo(4),
    text: "i am okay. i have to go for a walk tomorrow",
    analysis: { sentiment: "neutral", emotion: "neutral", confidence: 0.52, mood_summary: "Flat but stable — small intention set.", habits_to_highlight: [], suggested_tasks: [], _source: "keyword" },
  },
  {
    date: daysAgo(2),
    text: "Really good day. Finished the thing I've been procrastinating on for two weeks. Treated myself to takeout. Brain feels clear. This is what I want more of.",
    analysis: { sentiment: "positive", emotion: "excited", confidence: 0.88, mood_summary: "Accomplished and satisfied — productive momentum.", habits_to_highlight: [], suggested_tasks: [], _source: "keyword" },
  },
];

// ── Write everything ──────────────────────────────────────────────────────────

localStorage.setItem("deskbuddy_habits", JSON.stringify(habits));
localStorage.setItem("deskbuddy_goals",  JSON.stringify(goals));
localStorage.setItem("deskbuddy_tasks",  JSON.stringify(tasks));

for (const entry of journalEntries) {
  localStorage.setItem(`deskbuddy_draft_${entry.date}`,    entry.text);
  localStorage.setItem(`deskbuddy_analysis_${entry.date}`, JSON.stringify(entry.analysis));
}

console.log(`✓ Seeded:`);
console.log(`  ${habits.length} habits`);
console.log(`  ${goals.length} goals`);
console.log(`  ${tasks.length} tasks`);
console.log(`  ${journalEntries.length} journal entries`);
console.log(`  Open the journal and navigate back through dates to see entries.`);
