-- 003_moderacion.sql
-- Todo aditivo: verificación de perfil (check azul), rol de administrador,
-- baneos, bloqueos entre usuarios y reportes. Nada de DROP/TRUNCATE.

-- ---------- Roles y estado de la cuenta ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at    TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_by    UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at      TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by      UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users (is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_users_banned ON users (banned) WHERE banned = true;

-- ---------- Publicaciones editadas/borradas por un administrador ----------
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited_at        TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited_by_admin  UUID REFERENCES users(id) ON DELETE SET NULL;

-- ---------- Bloqueos entre usuarios ----------
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks (blocked_id);

-- ---------- Reportes (de usuarios o de publicaciones puntuales) ----------
CREATE TABLE IF NOT EXISTS reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  target_post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  reason            TEXT NOT NULL,
  details           TEXT,
  status            TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | resuelto | descartado
  reviewed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_report_target CHECK (target_user_id IS NOT NULL OR target_post_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target_user ON reports (target_user_id);
