-- ============================================================
-- Performance indexes — Milestone 3
-- ============================================================
-- The Event Intelligence Engine and Agent Orchestrator run these lookups
-- on every request (and every few seconds via the SSE stream), so the
-- columns they filter/join/order on need indexes as the dataset grows
-- beyond a demo-sized database. Safe to run repeatedly (IF NOT EXISTS).
--
-- Usage:
--   psql "$DATABASE_URL" -f config/schema_indexes.sql

-- Registrations & check-ins (registration-pulse agent, dashboard)
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_registration_date ON registrations(registration_date);
CREATE INDEX IF NOT EXISTS idx_checkins_registration_id ON checkins(registration_id);
CREATE INDEX IF NOT EXISTS idx_checkins_checkin_time ON checkins(checkin_time);

-- Sessions & attendance (overview + insights agents: capacity trend, scheduling coverage)
CREATE INDEX IF NOT EXISTS idx_sessions_venue_id ON sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_sessions_speaker_id ON sessions(speaker_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start_end_time ON sessions(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_session_attendance_session_id ON session_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_session_feedback_session_id ON session_feedback(session_id);

-- Sponsors (recommendation agent + intelligence overview)
CREATE INDEX IF NOT EXISTS idx_sponsor_deliverables_sponsor_id ON sponsor_deliverables(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_deliverables_status_due ON sponsor_deliverables(status, due_date);
CREATE INDEX IF NOT EXISTS idx_sponsor_engagement_sponsor_id ON sponsor_engagement(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_payments_sponsor_id ON sponsor_payments(sponsor_id);

-- Incidents (recommendation agent + intelligence overview: open/critical counts)
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_reported_at ON incidents(reported_at);

-- Operational alerts (alerting agent, alerts feed, dedup lookups in generateOperationalAlerts)
CREATE INDEX IF NOT EXISTS idx_operational_alerts_acknowledged_level ON operational_alerts(acknowledged, alert_level);
CREATE INDEX IF NOT EXISTS idx_operational_alerts_source ON operational_alerts(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_operational_alerts_created_at ON operational_alerts(created_at);
