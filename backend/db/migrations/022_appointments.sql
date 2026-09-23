-- 022_appointments.sql
-- Tabla para agendamiento interactivo de citas y reuniones

CREATE TABLE IF NOT EXISTS appointments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guest_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL DEFAULT 'Cita / Reunión',
  description    TEXT,
  location       TEXT,
  scheduled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | aceptada | rechazada
  reject_reason  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_host ON appointments (host_id);
CREATE INDEX IF NOT EXISTS idx_appointments_guest ON appointments (guest_id);
