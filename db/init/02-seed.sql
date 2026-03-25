-- ============================================================
-- DeskBuddy — Demo Seed Data  (March 2026)
-- ============================================================
-- Demo account
--   email:    demo@deskbuddy.app
--   password: deskbuddy
--
-- Generate the bcrypt hash (run once, then paste below):
--   python3 -c "from passlib.context import CryptContext; \
--               print(CryptContext(schemes=['bcrypt']).hash('deskbuddy'))"
-- ============================================================

DO $$
DECLARE
  uid UUID := '00000000-0000-0000-0001-000000000001';
BEGIN

-- ── Demo user ────────────────────────────────────────────────
INSERT INTO auth_db.users (id, email, password_hash, created_at)
VALUES (
  uid,
  'demo@deskbuddy.app',
  -- Replace this hash with the output of the python3 command above.
  -- This placeholder intentionally won't verify so prod data stays safe.
  '$2b$12$REPLACE_ME_RUN_THE_COMMAND_ABOVE_AND_PASTE_HASH_HERE',
  NOW() - INTERVAL '30 days'
)
ON CONFLICT (email) DO NOTHING;


-- ── Journal entries ──────────────────────────────────────────
-- A month of entries with realistic sentiments and emotions.

INSERT INTO journal_db.journal_entries
  (id, user_id, text, input_type, sentiment, emotion, confidence, mood_summary, created_at)
VALUES

( uuid_generate_v4(), uid,
  'First day properly using this app. Setting some intentions for the month — want to be more consistent with journaling, drink more water, and actually go to bed before midnight.',
  'typed', 'positive', 'calm', 0.61,
  'Reflective and calm start to the month.',
  NOW() - INTERVAL '21 days' ),

( uuid_generate_v4(), uid,
  'Completely crashed today. Slept through my alarm, missed a meeting, spent the afternoon trying to catch up. I hate days like this. Everything just piles on.',
  'typed', 'negative', 'anxious', 0.82,
  'Overwhelmed and frustrated — high-stress day.',
  NOW() - INTERVAL '17 days' ),

( uuid_generate_v4(), uid,
  'Decent morning. Made coffee before touching my phone which felt like a win. Did a 20 min walk. Not every day has to be a masterpiece I guess.',
  'typed', 'positive', 'calm', 0.58,
  'Grounded and gently optimistic.',
  NOW() - INTERVAL '14 days' ),

( uuid_generate_v4(), uid,
  'Had a long video call with my sister. We laughed so much. I forget how much I need that. Feeling lighter than I have all week.',
  'typed', 'positive', 'excited', 0.79,
  'Joyful and recharged — connection helped a lot.',
  NOW() - INTERVAL '11 days' ),

( uuid_generate_v4(), uid,
  'Can''t shake this low feeling. Nothing is technically wrong but I just feel kind of empty. Going to try to get to bed early and hope tomorrow is better.',
  'typed', 'negative', 'sad', 0.74,
  'Quiet sadness — needs rest and patience.',
  NOW() - INTERVAL '7 days' ),

( uuid_generate_v4(), uid,
  'i am okay. i have to go for a walk tomorrow',
  'typed', 'neutral', 'neutral', 0.52,
  'Flat but stable — small intention set.',
  NOW() - INTERVAL '4 days' ),

( uuid_generate_v4(), uid,
  'Really good day. Finished the thing I''ve been procrastinating on for two weeks. Treated myself to takeout. Brain feels clear. This is what I want more of.',
  'typed', 'positive', 'excited', 0.88,
  'Accomplished and satisfied — productive momentum.',
  NOW() - INTERVAL '2 days' );


-- ── Tasks ────────────────────────────────────────────────────
-- Mix of today, upcoming, and a done task.

INSERT INTO tasks_db.tasks
  (id, user_id, title, category, difficulty, status, due_at, created_at)
VALUES

( uuid_generate_v4(), uid,
  'Morning run (20 min)',
  'health', 1, 'done',
  NOW()::DATE + INTERVAL '0 days', NOW() - INTERVAL '1 day' ),

( uuid_generate_v4(), uid,
  'Finish project proposal',
  'work', 3, 'todo',
  NOW()::DATE + INTERVAL '0 days', NOW() - INTERVAL '1 day' ),

( uuid_generate_v4(), uid,
  'Call dentist to book appointment',
  'health', 1, 'todo',
  NOW()::DATE + INTERVAL '0 days', NOW() - INTERVAL '2 days' ),

( uuid_generate_v4(), uid,
  'Read 20 pages',
  'learning', 1, 'todo',
  NOW()::DATE + INTERVAL '1 day', NOW() - INTERVAL '1 day' ),

( uuid_generate_v4(), uid,
  'Meal prep for the week',
  'health', 2, 'todo',
  NOW()::DATE + INTERVAL '1 day', NOW() - INTERVAL '3 days' ),

( uuid_generate_v4(), uid,
  'Reply to pending emails',
  'work', 1, 'todo',
  NOW()::DATE + INTERVAL '2 days', NOW() - INTERVAL '1 day' ),

( uuid_generate_v4(), uid,
  'Review Spanish flashcards (15 min)',
  'learning', 1, 'todo',
  NOW()::DATE + INTERVAL '3 days', NOW() - INTERVAL '2 days' ),

( uuid_generate_v4(), uid,
  'Deep clean desk + workspace',
  'confidence', 2, 'todo',
  NOW()::DATE + INTERVAL '5 days', NOW() - INTERVAL '3 days' );


-- ── Daily check-ins ──────────────────────────────────────────
-- 19 check-ins spread over March, including a 6-day streak
-- ending yesterday so the streak counter has something to show.

INSERT INTO checkin_db.daily_checkins
  (id, user_id, checkin_date, caption, created_at)
VALUES

( uuid_generate_v4(), uid, (NOW() - INTERVAL '22 days')::DATE,
  'New month new me (maybe)', NOW() - INTERVAL '22 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '20 days')::DATE,
  'Two in a row!', NOW() - INTERVAL '20 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '19 days')::DATE,
  NULL, NOW() - INTERVAL '19 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '18 days')::DATE,
  'Quiet morning, good vibes', NOW() - INTERVAL '18 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '16 days')::DATE,
  NULL, NOW() - INTERVAL '16 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '15 days')::DATE,
  'Survived Monday', NOW() - INTERVAL '15 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '14 days')::DATE,
  NULL, NOW() - INTERVAL '14 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '13 days')::DATE,
  'Walk + coffee = perfect morning', NOW() - INTERVAL '13 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '12 days')::DATE,
  NULL, NOW() - INTERVAL '12 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '11 days')::DATE,
  'Called my sister 🫶', NOW() - INTERVAL '11 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '9 days')::DATE,
  NULL, NOW() - INTERVAL '9 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '7 days')::DATE,
  'Low day but still showed up', NOW() - INTERVAL '7 days' ),

-- 6-day streak leading into today
( uuid_generate_v4(), uid, (NOW() - INTERVAL '6 days')::DATE,
  'Back at it', NOW() - INTERVAL '6 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '5 days')::DATE,
  NULL, NOW() - INTERVAL '5 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '4 days')::DATE,
  'just a walk and some water', NOW() - INTERVAL '4 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '3 days')::DATE,
  NULL, NOW() - INTERVAL '3 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '2 days')::DATE,
  'Productive! Treated myself to ramen', NOW() - INTERVAL '2 days' ),

( uuid_generate_v4(), uid, (NOW() - INTERVAL '1 day')::DATE,
  'Cozy evening', NOW() - INTERVAL '1 day' )

ON CONFLICT (user_id, checkin_date) DO NOTHING;

END $$;
