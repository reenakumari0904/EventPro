

CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  organization VARCHAR(150),
  designation VARCHAR(150),
  city VARCHAR(100),
  country VARCHAR(100),
  interest VARCHAR(150),
  gender VARCHAR(20),                  -- Male | Female | Other
  age INT,
  role VARCHAR(20) DEFAULT 'attendee', -- admin | organizer | attendee
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  event_id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  date TIMESTAMP NOT NULL,
  venue VARCHAR(200),
  capacity INT,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS registrations (
  registration_id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(user_id),
  event_id INT REFERENCES events(event_id),
  registration_date TIMESTAMP DEFAULT NOW(),
  ticket_type VARCHAR(50) DEFAULT 'Standard', -- Standard | VIP | Student | Others
  source VARCHAR(50) DEFAULT 'Website',       -- Website | Mobile App | Google Forms | CSV Upload | API
  status VARCHAR(30) DEFAULT 'Registered',    -- Registered | Confirmed | Cancelled | Waitlisted
  qr_code TEXT
);

CREATE TABLE IF NOT EXISTS checkins (
  checkin_id SERIAL PRIMARY KEY,
  registration_id INT REFERENCES registrations(registration_id),
  checkin_time TIMESTAMP,
  checkout_time TIMESTAMP,
  gate VARCHAR(50),
  device VARCHAR(100)
);
-- ===== Milestone 2: Venue & Speaker Operations =====

CREATE TABLE IF NOT EXISTS venues (
  venue_id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  location VARCHAR(200),
  capacity INT NOT NULL,
  amenities VARCHAR(255),          -- e.g. "Projector, Mic, AC"
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS speakers (
  speaker_id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  topic VARCHAR(200),              -- their subject/expertise
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id SERIAL PRIMARY KEY,
  event_id INT REFERENCES events(event_id),
  venue_id INT REFERENCES venues(venue_id),
  speaker_id INT REFERENCES speakers(speaker_id),
  title VARCHAR(200) NOT NULL,
  track VARCHAR(100),              -- e.g. "AI Track", "Web Track"
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  expected_attendees INT,
  created_at TIMESTAMP DEFAULT NOW()
);
- ===== Milestone 2: Venue & Speaker Operations =====
-- (venues, speakers, sessions already exist from earlier setup — this
-- file only needs to be re-run for the NEW table below, IF NOT EXISTS
-- means it's safe to run against your existing database.)

CREATE TABLE IF NOT EXISTS venues (
  venue_id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  location VARCHAR(200),
  capacity INT NOT NULL,
  amenities VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS speakers (
  speaker_id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  topic VARCHAR(200),
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id SERIAL PRIMARY KEY,
  event_id INT REFERENCES events(event_id),
  venue_id INT REFERENCES venues(venue_id),
  speaker_id INT REFERENCES speakers(speaker_id),
  title VARCHAR(200) NOT NULL,
  track VARCHAR(100),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  expected_attendees INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ===== Venue Optimization Engine: recommendation history =====
-- Logs every AI venue recommendation made, so the Venue Optimization
-- dashboard can show "AI recommendation history" and we can later measure
-- how often recommendations were actually followed.
CREATE TABLE IF NOT EXISTS venue_recommendations (
  recommendation_id SERIAL PRIMARY KEY,
  session_title VARCHAR(200),
  expected_attendees INT,
  recommended_venue_id INT REFERENCES venues(venue_id),
  capacity_match_pct INT,          -- how tightly the venue fits the crowd (higher = less wasted seating)
  utilization_score INT,           -- overall fit score (capacity + amenities considered)
  suggestion_type VARCHAR(20),     -- 'match' | 'upgrade' | 'downgrade'
  reasoning TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ===== Speaker Scheduling Engine =====
-- Logs every automated scheduling action (auto-assignment of an unscheduled
-- session, or a reschedule of an existing one) so the Speaker Scheduling
-- dashboard can show a history of what the engine has done.
CREATE TABLE IF NOT EXISTS speaker_schedule_log (
  log_id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sessions(session_id),
  session_title VARCHAR(200),
  speaker_id INT REFERENCES speakers(speaker_id),
  action VARCHAR(20),              -- 'auto_assign' | 'reschedule' | 'reassign'
  previous_start_time TIMESTAMP,
  previous_end_time TIMESTAMP,
  new_start_time TIMESTAMP,
  new_end_time TIMESTAMP,
  reasoning TEXT,
  notified BOOLEAN DEFAULT false,  -- whether the speaker was emailed about this change
  created_at TIMESTAMP DEFAULT NOW()
);

-- ===== Session Analytics =====
-- Attendee participation per session (who actually showed up), separate
-- from the event-level `checkins` table used at the front gate.
CREATE TABLE IF NOT EXISTS session_attendance (
  attendance_id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sessions(session_id),
  registration_id INT REFERENCES registrations(registration_id),
  checked_in_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, registration_id)
);

-- Post-session ratings — powers "average session rating" and "speaker
-- feedback score" in the analytics dashboard.
CREATE TABLE IF NOT EXISTS session_feedback (
  feedback_id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sessions(session_id),
  registration_id INT REFERENCES registrations(registration_id),
  session_rating INT CHECK (session_rating BETWEEN 1 AND 5),
  speaker_rating INT CHECK (speaker_rating BETWEEN 1 AND 5),
  comments TEXT,
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- ===== Milestone 3: Sponsorship & Incident Management =====

-- ----- Sponsorship Agent -----
CREATE TABLE IF NOT EXISTS sponsors (
  sponsor_id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  tier VARCHAR(20),                              -- Platinum | Gold | Silver | Bronze
  contact_name VARCHAR(150),
  contact_email VARCHAR(150),
  contract_amount NUMERIC(12,2),
  payment_status VARCHAR(20) DEFAULT 'pending',   -- pending | partial | paid — kept in sync automatically from sponsor_payments
  contract_start_date DATE,
  contract_end_date DATE,
  contract_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Actual payments received against a sponsor's contract. payment_status
-- on the sponsors row is recalculated from this table every time a
-- payment is recorded, instead of being set by hand.
CREATE TABLE IF NOT EXISTS sponsor_payments (
  payment_id SERIAL PRIMARY KEY,
  sponsor_id INT REFERENCES sponsors(sponsor_id),
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  method VARCHAR(30),                             -- bank_transfer | cheque | card | cash | other
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reusable sponsorship packages (e.g. "Platinum Package") — a named bundle
-- of standard deliverables so organizers don't retype the same 5 items
-- for every Platinum sponsor.
CREATE TABLE IF NOT EXISTS sponsorship_packages (
  package_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  tier VARCHAR(20),
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sponsorship_package_items (
  item_id SERIAL PRIMARY KEY,
  package_id INT REFERENCES sponsorship_packages(package_id),
  description VARCHAR(255) NOT NULL,              
  deliverable_type VARCHAR(30)
);


CREATE TABLE IF NOT EXISTS sponsor_deliverables (
  deliverable_id SERIAL PRIMARY KEY,
  sponsor_id INT REFERENCES sponsors(sponsor_id),
  description VARCHAR(255) NOT NULL,
  deliverable_type VARCHAR(30),                   
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending',           
  spec_dimensions VARCHAR(100),                   
  spec_format VARCHAR(100),                      
  approval_status VARCHAR(20) DEFAULT 'not_required', 
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS sponsor_engagement (
  engagement_id SERIAL PRIMARY KEY,
  sponsor_id INT REFERENCES sponsors(sponsor_id),
  metric_type VARCHAR(30),                        
  metric_value INT DEFAULT 1,
  notes VARCHAR(255),
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Milestone 3 was created before these columns existed for some
-- deployments — these are safe no-ops if the columns are already there.
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS contract_notes TEXT;
ALTER TABLE sponsor_deliverables ADD COLUMN IF NOT EXISTS spec_dimensions VARCHAR(100);
ALTER TABLE sponsor_deliverables ADD COLUMN IF NOT EXISTS spec_format VARCHAR(100);
ALTER TABLE sponsor_deliverables ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'not_required';

-- ----- Incident Agent -----
CREATE TABLE IF NOT EXISTS incidents (
  incident_id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  incident_type VARCHAR(40),                      
                                                  
                                                   
  severity VARCHAR(20),                           
  status VARCHAR(20) DEFAULT 'reported',          
  session_id INT REFERENCES sessions(session_id),
  venue_id INT REFERENCES venues(venue_id),
  reported_by VARCHAR(150),
  assigned_to VARCHAR(150),
  reported_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolution_notes TEXT
);

CREATE TABLE IF NOT EXISTS incident_workflow_log (
  log_id SERIAL PRIMARY KEY,
  incident_id INT REFERENCES incidents(incident_id),
  from_status VARCHAR(20),
  to_status VARCHAR(20),
  action VARCHAR(30),                             
  notes TEXT,
  actor VARCHAR(150),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS operational_alerts (
  alert_id SERIAL PRIMARY KEY,
  alert_level VARCHAR(20),                     
  source_type VARCHAR(20),                        
  source_id INT,
  title VARCHAR(200),
  message TEXT,
  is_ai_generated BOOLEAN DEFAULT false,
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
