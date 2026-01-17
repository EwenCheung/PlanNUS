#!/usr/bin/env python3
"""
NUSMods Data Ingestion Script - Supabase Client Version
Uses supabase-py for database operations.

Usage:
    python nusmods_ingestion.py                    # Full ingestion
    python nusmods_ingestion.py --limit 50         # Limited ingestion for testing
    python nusmods_ingestion.py --year 2025-2026   # Specific academic year
"""

import os
import sys
import time
import argparse
import json
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime

from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
NUSMODS_API_URL = os.environ.get("NUSMODS_API_URL", "https://api.nusmods.com/v2")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")

# Create Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Rate limiting
REQUEST_DELAY = 0.05  # 50ms between requests


def fetch_module_list(acad_year: str) -> List[Dict]:
    """Fetch list of all modules for an academic year."""
    url = f"{NUSMODS_API_URL}/{acad_year}/moduleList.json"
    print(f"Fetching module list from: {url}")
    
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    
    modules = response.json()
    print(f"Found {len(modules)} modules for {acad_year}")
    return modules


def fetch_module_details(acad_year: str, module_code: str) -> Optional[Dict]:
    """Fetch detailed info for a single module."""
    url = f"{NUSMODS_API_URL}/{acad_year}/modules/{module_code}.json"
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"  Error fetching {module_code}: {e}")
        return None


def insert_module(data: Dict, acad_year: str) -> bool:
    """Insert or update a module using Supabase client."""
    try:
        # Parse workload
        workload = data.get('workload', [])
        if isinstance(workload, str):
            workload = []
        
        module_data = {
            'module_code': data.get('moduleCode'),
            'title': data.get('title', 'Unknown'),
            'description': data.get('description'),
            'module_credit': float(data.get('moduleCredit', 4)),
            'department': data.get('department'),
            'faculty': data.get('faculty'),
            'workload': workload,
            'prerequisite_rule': data.get('prerequisite'),
            'prerequisite_tree': data.get('prereqTree'),
            'preclusion': data.get('preclusion'),
            'corequisite': data.get('corequisite'),
            'attributes': data.get('attributes', {}),
            'sentiment_tags': data.get('fulfillRequirements', [])
        }
        
        # Upsert module (insert or update on conflict)
        supabase.table('modules').upsert(module_data, on_conflict='module_code').execute()
        
        # Build semester offerings with boolean columns
        semester_data = data.get('semesterData', [])
        semester_1 = False
        semester_2 = False
        special_term_1 = False
        special_term_2 = False
        exam_info = {}
        
        for sem in semester_data:
            semester = sem.get('semester')
            if semester == 1:
                semester_1 = True
                if sem.get('examDate'):
                    exam_info['sem1'] = {'date': sem['examDate'], 'duration': sem.get('examDuration')}
            elif semester == 2:
                semester_2 = True
                if sem.get('examDate'):
                    exam_info['sem2'] = {'date': sem['examDate'], 'duration': sem.get('examDuration')}
            elif semester == 3:
                special_term_1 = True
                if sem.get('examDate'):
                    exam_info['st1'] = {'date': sem['examDate'], 'duration': sem.get('examDuration')}
            elif semester == 4:
                special_term_2 = True
                if sem.get('examDate'):
                    exam_info['st2'] = {'date': sem['examDate'], 'duration': sem.get('examDuration')}
        
        # Only insert offering if at least one semester is true
        if semester_1 or semester_2 or special_term_1 or special_term_2:
            offering_data = {
                'module_code': data.get('moduleCode'),
                'acad_year': acad_year,
                'semester_1': semester_1,
                'semester_2': semester_2,
                'special_term_1': special_term_1,
                'special_term_2': special_term_2,
                'exam_info': exam_info
            }
            
            try:
                supabase.table('module_offerings').upsert(
                    offering_data, 
                    on_conflict='module_code,acad_year'
                ).execute()
            except:
                pass  # Ignore offering insert errors
        
        return True
    except Exception as e:
        print(f"  Error inserting {data.get('moduleCode')}: {str(e)[:100]}")
        return False


def run_ingestion(acad_year: str = "2025-2026", limit: Optional[int] = None):
    """Run the full ingestion process."""
    print(f"\n{'='*60}")
    print(f"NUSMods Data Ingestion (Supabase Client) - {acad_year}")
    print(f"{'='*60}\n")
    
    start_time = time.time()
    
    # Fetch module list
    modules = fetch_module_list(acad_year)
    
    # Check which modules already have offerings (to skip them)
    print("Checking existing module offerings...")
    existing_result = supabase.table('module_offerings').select('module_code').eq('acad_year', acad_year).execute()
    existing_codes = set(o['module_code'] for o in existing_result.data)
    print(f"Found {len(existing_codes)} modules already with offerings - will skip these")
    
    # Filter to only process modules without offerings
    modules_to_process = [m for m in modules if m['moduleCode'] not in existing_codes]
    print(f"Processing {len(modules_to_process)} modules (skipping {len(modules) - len(modules_to_process)})\n")
    
    if limit:
        modules_to_process = modules_to_process[:limit]
        print(f"Limited to {limit} modules for testing\n")
    
    total = len(modules_to_process)
    if total == 0:
        print("All modules already have offerings - nothing to do!")
        return
    
    success_count = 0
    error_count = 0
    
    for i, mod in enumerate(modules_to_process, 1):
        module_code = mod['moduleCode']
        
        # Progress indicator
        if i % 100 == 0 or i == 1:
            elapsed = time.time() - start_time
            rate = i / elapsed if elapsed > 0 else 0
            eta = (total - i) / rate if rate > 0 else 0
            print(f"Progress: {i}/{total} ({i*100/total:.1f}%) | "
                  f"Success: {success_count} | Errors: {error_count} | "
                  f"ETA: {eta:.0f}s")
        
        # Fetch and insert
        details = fetch_module_details(acad_year, module_code)
        if details:
            if insert_module(details, acad_year):
                success_count += 1
            else:
                error_count += 1
        else:
            error_count += 1
        
        # Rate limiting
        time.sleep(REQUEST_DELAY)
    
    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"Ingestion Complete!")
    print(f"{'='*60}")
    print(f"Total modules processed: {total}")
    print(f"Successfully inserted: {success_count}")
    print(f"Errors: {error_count}")
    print(f"Time elapsed: {elapsed:.1f}s")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest NUSMods data into database")
    parser.add_argument("--year", default="2025-2026", help="Academic year (e.g., 2025-2026)")
    parser.add_argument("--limit", type=int, help="Limit number of modules for testing")
    
    args = parser.parse_args()
    run_ingestion(acad_year=args.year, limit=args.limit)
