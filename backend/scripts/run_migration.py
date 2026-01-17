#!/usr/bin/env python3
"""
Run database migration via Python - Fixed version
Executes each statement separately to handle Supabase pooler
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables
script_dir = os.path.dirname(__file__)
load_dotenv(os.path.join(script_dir, '../../.env.local'))
load_dotenv(os.path.join(script_dir, '../../.env'))

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in environment")

print(f"Connecting to database...")
engine = create_engine(DATABASE_URL, echo=False)

# Define statements individually to avoid parsing issues
STATEMENTS = [
    # Enable UUID extension
    """CREATE EXTENSION IF NOT EXISTS "uuid-ossp" """,
    
    # Users table
    """
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        major VARCHAR(255),
        admit_year VARCHAR(10),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
    """,
    
    # Modules table
    """
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
    )
    """,
    
    # Module offerings table
    """
    CREATE TABLE IF NOT EXISTS module_offerings (
        id SERIAL PRIMARY KEY,
        module_code VARCHAR(20) NOT NULL REFERENCES modules(module_code) ON DELETE CASCADE,
        acad_year VARCHAR(20) NOT NULL,
        semester INTEGER NOT NULL CHECK (semester IN (1, 2, 3, 4)),
        exam_date TIMESTAMP WITH TIME ZONE,
        exam_duration INTEGER,
        UNIQUE(module_code, acad_year, semester)
    )
    """,
    
    # Plans table
    """
    CREATE TABLE IF NOT EXISTS plans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL DEFAULT 'My Plan',
        content JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
    """,
    
    # Reviews table
    """
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
    )
    """,
    
    # Degree requirements table
    "DROP TABLE IF EXISTS degree_requirements",
    """
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
    )
    """,
    
    # Indexes
    "CREATE INDEX IF NOT EXISTS idx_modules_department ON modules(department)",
    "CREATE INDEX IF NOT EXISTS idx_modules_faculty ON modules(faculty)",
    "CREATE INDEX IF NOT EXISTS idx_module_offerings_module ON module_offerings(module_code)",
    "CREATE INDEX IF NOT EXISTS idx_module_offerings_year ON module_offerings(acad_year)",
    "CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_reviews_module ON reviews(module_code)",
    
    # Insert sample user
    """
    INSERT INTO users (email, name, major, admit_year)
    VALUES ('demo@nus.edu.sg', 'Demo User', 'Computer Science', '2024')
    ON CONFLICT (email) DO NOTHING
    """
]

print(f"Running {len(STATEMENTS)} SQL statements...")

success = 0
errors = 0

for i, stmt in enumerate(STATEMENTS, 1):
    with engine.connect() as conn:
        try:
            conn.execute(text(stmt))
            conn.commit()
            print(f"  [{i}/{len(STATEMENTS)}] ✓")
            success += 1
        except Exception as e:
            err_msg = str(e)[:80]
            if "already exists" in err_msg.lower() or "duplicate" in err_msg.lower():
                print(f"  [{i}/{len(STATEMENTS)}] ✓ (already exists)")
                success += 1
            else:
                print(f"  [{i}/{len(STATEMENTS)}] ✗ {err_msg}")
                errors += 1

print(f"\n{'='*50}")
print(f"Migration Summary: {success} succeeded, {errors} failed")
print(f"Tables: users, modules, module_offerings, plans, reviews, degree_requirements")
print(f"{'='*50}")
