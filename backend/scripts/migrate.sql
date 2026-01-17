-- NUS Planner Database Schema Migration
-- Run this in Supabase SQL Editor or via psql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    major VARCHAR(255),
    admit_year VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Modules table (NUSMods data)
CREATE TABLE IF NOT EXISTS modules (
    module_code VARCHAR(20) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    module_credit DECIMAL(4,1) NOT NULL DEFAULT 4.0,
    department VARCHAR(255),
    faculty VARCHAR(255),
    workload JSONB DEFAULT '[]'::jsonb,
    prerequisite_rule TEXT,
    prerequisite_tree JSONB,
    preclusion TEXT,
    corequisite TEXT,
    attributes JSONB DEFAULT '{}'::jsonb,
    sentiment_tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Module offerings table (semester availability) - One row per module per academic year
CREATE TABLE IF NOT EXISTS module_offerings (
    id SERIAL PRIMARY KEY,
    module_code VARCHAR(20) NOT NULL REFERENCES modules(module_code) ON DELETE CASCADE,
    acad_year VARCHAR(20) NOT NULL,
    semester_1 BOOLEAN DEFAULT FALSE,
    semester_2 BOOLEAN DEFAULT FALSE,
    special_term_1 BOOLEAN DEFAULT FALSE,
    special_term_2 BOOLEAN DEFAULT FALSE,
    exam_info JSONB DEFAULT '{}'::jsonb,  -- Stores exam dates/durations per semester
    UNIQUE(module_code, acad_year)
);

-- Plans table (user study plans)
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'My Plan',
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews table (module reviews from Disqus or internal)
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    module_code VARCHAR(20) NOT NULL REFERENCES modules(module_code) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'Internal',
    disqus_post_id VARCHAR(100),
    academic_year VARCHAR(20),
    UNIQUE(disqus_post_id)
);

-- Degree requirements table
-- Degree requirements table
DROP TABLE IF EXISTS degree_requirements;
CREATE TABLE IF NOT EXISTS degree_requirements (
    id SERIAL PRIMARY KEY,
    degree VARCHAR(255) NOT NULL,
    faculty VARCHAR(255) NOT NULL,
    major VARCHAR(255) NOT NULL,
    total_units DECIMAL(5,1) NOT NULL DEFAULT 160.0,
    requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(major)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_modules_title ON modules USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_modules_department ON modules(department);
CREATE INDEX IF NOT EXISTS idx_modules_faculty ON modules(faculty);
CREATE INDEX IF NOT EXISTS idx_module_offerings_module ON module_offerings(module_code);
CREATE INDEX IF NOT EXISTS idx_module_offerings_year ON module_offerings(acad_year);
CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_module ON reviews(module_code);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to modules and plans
DROP TRIGGER IF EXISTS update_modules_updated_at ON modules;
CREATE TRIGGER update_modules_updated_at
    BEFORE UPDATE ON modules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant public access for Supabase (adjust as needed)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert sample user for testing
INSERT INTO users (email, name, major, admit_year)
VALUES ('demo@nus.edu.sg', 'Demo User', 'Computer Science', '2024')
ON CONFLICT (email) DO NOTHING;
