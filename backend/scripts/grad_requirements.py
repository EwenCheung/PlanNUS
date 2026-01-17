#!/usr/bin/env python3
"""
Graduation Requirements Ingestion Script

Loads degree requirements from JSON seed files and upserts them into
the degree_requirements table in Supabase.

Usage:
    python grad_requirements.py                    # Load all requirements
    python grad_requirements.py --file cs_grad    # Load specific file
"""

import os
import json
import argparse
from typing import List, Dict, Optional

from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")

# Create Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Path to seeds directory
SEEDS_DIR = os.path.join(os.path.dirname(__file__), "..", "seeds")


def load_json_file(filepath: str) -> Dict:
    """Load a JSON file and return its contents."""
    print(f"Loading {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data


def extract_cs_grad_requirements(data: Dict) -> List[Dict]:
    """
    Extract degree requirements from cs_grad.json format.
    This file contains a 'programmes' array with multiple programmes.
    """
    requirements_list = []

    programmes = data.get('programmes', [])

    for programme in programmes:
        req_data = {
            'degree': programme.get('degree'),
            'faculty': programme.get('faculty'),
            'major': programme.get('major'),
            'total_units': float(programme.get('units', 160)),
            'requirements': programme.get('course', {}),
            'notes': '\n'.join(programme.get('notes', [])) if programme.get('notes') else None
        }
        requirements_list.append(req_data)

    return requirements_list


def extract_business_grad_requirements(data: Dict) -> List[Dict]:
    """
    Extract degree requirements from business_grad.json format.
    This file has a single degree with multiple major options.
    """
    requirements_list = []

    degree = data.get('degree')
    faculty = data.get('faculty')
    total_units = float(data.get('units', 160))

    # Get the base course structure (commonCore, core, unrestrictedElectives)
    base_course = data.get('course', {})
    common_core = base_course.get('commonCore', {})
    core = base_course.get('core', {})
    unrestricted_electives = base_course.get('unrestrictedElectives', {})

    # Get major options
    major_info = base_course.get('major', {})
    major_options = major_info.get('options', [])

    for major_option in major_options:
        major_name = major_option.get('name')
        major_code = major_option.get('code')

        # Build the full requirements structure for this major
        requirements = {
            'commonCore': common_core,
            'core': core,
            'major': {
                'name': major_name,
                'code': major_code,
                'units': major_option.get('units'),
                'restricted': major_option.get('restricted', False),
                'coreModules': major_option.get('coreModules', {}),
                'electiveModules': major_option.get('electiveModules', {}),
                'capstone': major_option.get('capstone', {}),
                'remainingUnits': major_option.get('remainingUnits'),
                'notes': major_option.get('notes', [])
            },
            'unrestrictedElectives': unrestricted_electives
        }

        # Construct the full major name (e.g., "Business Administration - Finance")
        full_major_name = f"Business Administration - {major_name}"

        # Collect notes
        notes_list = []
        if unrestricted_electives.get('notes'):
            notes_list.extend(unrestricted_electives['notes'])
        if major_option.get('notes'):
            notes_list.extend(major_option['notes'])

        req_data = {
            'degree': degree,
            'faculty': faculty,
            'major': full_major_name,
            'total_units': total_units,
            'requirements': requirements,
            'notes': '\n'.join(notes_list) if notes_list else None
        }
        requirements_list.append(req_data)

    return requirements_list


def upsert_requirements(requirements_list: List[Dict]) -> tuple:
    """
    Upsert degree requirements into the database.
    Returns (success_count, error_count).
    """
    success_count = 0
    error_count = 0

    for req in requirements_list:
        try:
            supabase.table('degree_requirements').upsert(
                req,
                on_conflict='major'
            ).execute()

            print(f"  ✓ Upserted: {req['major']}")
            success_count += 1

        except Exception as e:
            print(f"  ✗ Error upserting {req.get('major')}: {str(e)[:100]}")
            error_count += 1

    return success_count, error_count


def run_ingestion(file_filter: Optional[str] = None):
    """Run the graduation requirements ingestion process."""
    print(f"\n{'='*60}")
    print(f"Graduation Requirements Ingestion")
    print(f"{'='*60}\n")

    all_requirements = []

    # Process cs_grad.json
    if file_filter is None or file_filter == 'cs_grad':
        cs_grad_path = os.path.join(SEEDS_DIR, "cs_grad.json")
        if os.path.exists(cs_grad_path):
            cs_data = load_json_file(cs_grad_path)
            cs_requirements = extract_cs_grad_requirements(cs_data)
            print(f"  Found {len(cs_requirements)} programmes in cs_grad.json")
            all_requirements.extend(cs_requirements)
        else:
            print(f"  Warning: {cs_grad_path} not found")

    # Process business_grad.json
    if file_filter is None or file_filter == 'business_grad':
        business_grad_path = os.path.join(SEEDS_DIR, "business_grad.json")
        if os.path.exists(business_grad_path):
            business_data = load_json_file(business_grad_path)
            business_requirements = extract_business_grad_requirements(business_data)
            print(f"  Found {len(business_requirements)} majors in business_grad.json")
            all_requirements.extend(business_requirements)
        else:
            print(f"  Warning: {business_grad_path} not found")

    if not all_requirements:
        print("\nNo requirements to process.")
        return

    print(f"\nUpserting {len(all_requirements)} degree requirements...\n")

    success, errors = upsert_requirements(all_requirements)

    print(f"\n{'='*60}")
    print(f"Ingestion Complete!")
    print(f"{'='*60}")
    print(f"Successfully upserted: {success}")
    print(f"Errors: {errors}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest graduation requirements into database")
    parser.add_argument(
        "--file",
        choices=['cs_grad', 'business_grad'],
        help="Specific file to process (default: all)"
    )

    args = parser.parse_args()
    run_ingestion(file_filter=args.file)