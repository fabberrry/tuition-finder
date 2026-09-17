-- Apply with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name varchar(150) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  phone varchar(20) UNIQUE,
  password_hash text NOT NULL,
  role varchar(20) NOT NULL CHECK (role IN ('student','parent','owner','teacher','admin')),
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS student_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  class_level varchar(20), board varchar(50), exam_goal varchar(100),
  preferred_budget_min int CHECK (preferred_budget_min >= 0),
  preferred_budget_max int CHECK (preferred_budget_max >= 0),
  preferred_mode varchar(20) CHECK (preferred_mode IN ('online','offline','hybrid')),
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (preferred_budget_min IS NULL OR preferred_budget_max IS NULL OR preferred_budget_min <= preferred_budget_max)
);
CREATE TABLE IF NOT EXISTS centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  name varchar(255) NOT NULL,
  description text,
  address text NOT NULL,
  city varchar(100) NOT NULL,
  locality varchar(100) NOT NULL,
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  contact_phone varchar(20),
  photos text[] NOT NULL DEFAULT '{}',
  facilities text[] NOT NULL DEFAULT '{}',
  verification_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','approved','rejected')),
  listing_status varchar(20) NOT NULL DEFAULT 'draft' CHECK (listing_status IN ('draft','active','paused')),
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS centers_location_idx ON centers(city, locality);
CREATE INDEX IF NOT EXISTS centers_public_idx ON centers(verification_status, listing_status);
CREATE INDEX IF NOT EXISTS centers_owner_idx ON centers(owner_id);
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  class_level varchar(20), board varchar(50), exam_type varchar(100),
  UNIQUE NULLS NOT DISTINCT (name, class_level, board, exam_type)
);
CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES centers(id),
  user_id uuid REFERENCES users(id),
  name varchar(150) NOT NULL,
  qualification varchar(255), experience_years int CHECK (experience_years >= 0), bio text,
  verification_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','approved','rejected')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS teacher_subjects (
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id),
  PRIMARY KEY (teacher_id, subject_id)
);
CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES centers(id),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  subject_id uuid NOT NULL REFERENCES subjects(id),
  batch_name varchar(150) NOT NULL,
  class_level varchar(20), board varchar(50), exam_type varchar(100),
  start_time time NOT NULL, end_time time NOT NULL,
  days_of_week text[] NOT NULL DEFAULT '{}',
  mode varchar(20) NOT NULL CHECK (mode IN ('online','offline','hybrid')),
  capacity int NOT NULL CHECK (capacity > 0),
  filled_seats int NOT NULL DEFAULT 0 CHECK (filled_seats >= 0 AND filled_seats <= capacity),
  monthly_fee int CHECK (monthly_fee >= 0),
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  vacancy_last_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_time < end_time),
  UNIQUE (id, center_id)
);
CREATE INDEX IF NOT EXISTS batches_search_idx ON batches(subject_id, class_level, board, monthly_fee);
CREATE INDEX IF NOT EXISTS batches_center_idx ON batches(center_id, status);
CREATE TABLE IF NOT EXISTS vacancy_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id), actor_id uuid NOT NULL REFERENCES users(id),
  old_filled int NOT NULL, new_filled int NOT NULL,
  old_capacity int, new_capacity int,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vacancy_audit ADD COLUMN IF NOT EXISTS old_capacity int;
ALTER TABLE vacancy_audit ADD COLUMN IF NOT EXISTS new_capacity int;
CREATE TABLE IF NOT EXISTS batch_fee_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id), actor_id uuid NOT NULL REFERENCES users(id),
  old_monthly_fee int, new_monthly_fee int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS demo_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES centers(id), teacher_id uuid NOT NULL REFERENCES teachers(id),
  subject_id uuid NOT NULL REFERENCES subjects(id),
  title varchar(255) NOT NULL, topic varchar(255), video_url text NOT NULL,
  duration_seconds int CHECK (duration_seconds > 0), language varchar(50),
  approval_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS demo_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id),
  center_id uuid NOT NULL REFERENCES centers(id),
  batch_id uuid NOT NULL, teacher_id uuid NOT NULL REFERENCES teachers(id),
  booking_time timestamptz NOT NULL,
  contact_phone varchar(20),
  status varchar(20) NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','cancelled','attended','no_show')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, center_id) REFERENCES batches(id, center_id)
);
ALTER TABLE demo_bookings ADD COLUMN IF NOT EXISTS contact_phone varchar(20);
CREATE UNIQUE INDEX IF NOT EXISTS booking_unique_active_idx ON demo_bookings(student_id, batch_id, booking_time) WHERE status = 'booked';
CREATE UNIQUE INDEX IF NOT EXISTS booking_one_active_per_batch_idx ON demo_bookings(student_id, batch_id) WHERE status = 'booked';
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id), center_id uuid NOT NULL REFERENCES centers(id),
  batch_id uuid REFERENCES batches(id), source varchar(20) NOT NULL DEFAULT 'inquiry',
  status varchar(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','demo_scheduled','converted','closed')),
  student_message text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_center_idx ON leads(center_id, created_at DESC);
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id), center_id uuid NOT NULL REFERENCES centers(id),
  teacher_id uuid REFERENCES teachers(id), booking_id uuid NOT NULL UNIQUE REFERENCES demo_bookings(id),
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5), review_text text NOT NULL,
  teaching_clarity_rating int CHECK (teaching_clarity_rating BETWEEN 1 AND 5),
  doubt_solving_rating int CHECK (doubt_solving_rating BETWEEN 1 AND 5),
  environment_rating int CHECK (environment_rating BETWEEN 1 AND 5),
  value_for_money_rating int CHECK (value_for_money_rating BETWEEN 1 AND 5),
  verification_type varchar(20) NOT NULL DEFAULT 'attended_demo',
  moderation_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS teaching_clarity_rating int CHECK (teaching_clarity_rating BETWEEN 1 AND 5);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS doubt_solving_rating int CHECK (doubt_solving_rating BETWEEN 1 AND 5);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS environment_rating int CHECK (environment_rating BETWEEN 1 AND 5);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS value_for_money_rating int CHECK (value_for_money_rating BETWEEN 1 AND 5);
CREATE TABLE IF NOT EXISTS shortlists (
  student_id uuid NOT NULL REFERENCES users(id), center_id uuid NOT NULL REFERENCES centers(id),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (student_id, center_id)
);
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id), center_id uuid NOT NULL REFERENCES centers(id),
  issue_type varchar(50) NOT NULL, details text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admin_id uuid NOT NULL REFERENCES users(id),
  action varchar(50) NOT NULL, entity_id uuid NOT NULL, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
