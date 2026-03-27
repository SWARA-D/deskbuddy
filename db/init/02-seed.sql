-- ============================================================
-- DeskBuddy — Demo Account
-- ============================================================
-- Demo account
--   email:    demo@deskbuddy.app
--   password: deskbuddy
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
  '$2b$12$HvfjkK7co2neofUPAajuRepPghq9CGE2g242JnVW6qdg6h7r0RI/K',
  NOW() - INTERVAL '30 days'
)
ON CONFLICT (email) DO NOTHING;

END $$;
