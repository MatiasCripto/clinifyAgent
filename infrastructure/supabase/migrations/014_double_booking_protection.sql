-- Prevent double-booking: only one non-cancelled appointment per professional per time slot.
-- Uses a partial unique index so cancelled appointments don't block new bookings.
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_slot
  ON appointments (professional_id, starts_at)
  WHERE status != 'cancelled';
