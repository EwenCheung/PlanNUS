"""
NUS Planner API - Using Supabase Python Client
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import os
import hashlib
import uuid as uuid_lib
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="NUS Planner API")

# CORS Configuration
origins = [
    "http://localhost:5173",  # Vite default port
    "http://localhost:3000",  # Next.js default port
    "http://localhost:3001",  # Vite dev server (current)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to NUS Planner API"}

# ============== Auth Endpoints ==============

class AuthRequest(BaseModel):
    email: str
    password: str = ""
    username: str = None

class AuthResponse(BaseModel):
    id: str
    email: str
    name: str
    major: str = None
    admit_year: str = None
    success: bool = True
    message: str = "Success"
    isGuest: bool = False

def hash_password(password: str) -> str:
    """Simple password hashing (use bcrypt in production)."""
    return hashlib.sha256(password.encode()).hexdigest()

@app.post("/auth/signup", response_model=AuthResponse)
def signup(request: AuthRequest):
    """Create a new user account."""
    if not request.email or not request.password:
        return AuthResponse(
            id="", email="", name="",
            success=False,
            message="Email and password are required"
        )
    
    # Check if user already exists
    existing = supabase.table('users').select('*').eq('email', request.email).execute()
    if existing.data:
        return AuthResponse(
            id="", email=request.email, name="",
            success=False,
            message="An account with this email already exists. Please sign in."
        )
    
    # Create new user with hashed password
    new_user_data = {
        'email': request.email,
        'name': request.username or request.email.split('@')[0],
        'major': 'Computer Science',
        'admit_year': '2024',
        'password_hash': hash_password(request.password)
    }
    
    result = supabase.table('users').insert(new_user_data).execute()
    
    if result.data:
        user = result.data[0]
        return AuthResponse(
            id=str(user['id']),
            email=user['email'],
            name=user['name'],
            major=user.get('major'),
            admit_year=user.get('admit_year'),
            success=True,
            message="Account created successfully"
        )
    else:
        return AuthResponse(
            id="", email="", name="",
            success=False,
            message="Failed to create account"
        )

@app.post("/auth/login", response_model=AuthResponse)
def login(request: AuthRequest):
    """Login with email and password."""
    if not request.email or not request.password:
        return AuthResponse(
            id="", email="", name="",
            success=False,
            message="Email and password are required"
        )
    
    # Find user by email
    result = supabase.table('users').select('*').eq('email', request.email).execute()
    
    if not result.data:
        return AuthResponse(
            id="", email=request.email, name="",
            success=False,
            message="Account not found. Please sign up first."
        )
    
    user = result.data[0]
    stored_hash = user.get('password_hash')
    
    if not stored_hash or stored_hash != hash_password(request.password):
        return AuthResponse(
            id="", email=request.email, name="",
            success=False,
            message="Incorrect password. Please try again."
        )
    
    return AuthResponse(
        id=str(user['id']),
        email=user['email'],
        name=user['name'],
        major=user.get('major'),
        admit_year=user.get('admit_year'),
        success=True,
        message="Login successful"
    )

@app.post("/auth/guest", response_model=AuthResponse)
def guest_login():
    """Create a guest user account."""
    guest_id = str(uuid_lib.uuid4())[:8]
    guest_email = f"guest#{guest_id}@temp.nus.edu"
    guest_name = f"Guest#{guest_id}"
    
    guest_data = {
        'email': guest_email,
        'name': guest_name,
        'major': 'Undeclared',
        'admit_year': '2024'
    }
    
    result = supabase.table('users').insert(guest_data).execute()
    
    if result.data:
        user = result.data[0]
        return AuthResponse(
            id=str(user['id']),
            email=user['email'],
            name=user['name'],
            major=user.get('major'),
            admit_year=user.get('admit_year'),
            success=True,
            message="Guest account created",
            isGuest=True
        )
    else:
        return AuthResponse(
            id="", email="", name="",
            success=False,
            message="Failed to create guest account"
        )

# ============== Module Endpoints ==============

@app.get("/modules")
def get_modules():
    """Get all modules."""
    result = supabase.table('modules').select('*').limit(100).execute()
    return result.data

@app.get("/modules/search")
def search_modules(q: str, limit: int = 20):
    """Search modules by code or title."""
    if not q or len(q) < 2:
        return []
    
    # Search by module code (case insensitive)
    result = supabase.table('modules').select(
        'module_code, title, module_credit, department'
    ).or_(
        f"module_code.ilike.%{q}%,title.ilike.%{q}%"
    ).limit(limit).execute()
    
    return [
        {
            "code": m['module_code'],
            "title": m['title'],
            "credits": m['module_credit'],
            "department": m.get('department')
        }
        for m in result.data
    ]

@app.get("/modules/search/semester")
def search_modules_by_semester(
    q: str, 
    acad_year: str = "2025-2026", 
    semester: int = 1,  # 1=Sem1, 2=Sem2, 3=ST1, 4=ST2
    limit: int = 5
):
    """Search modules offered in a specific semester."""
    if not q or len(q) < 1:
        return []
    
    # Map semester to boolean column name
    sem_column = {
        1: 'semester_1',
        2: 'semester_2', 
        3: 'special_term_1',
        4: 'special_term_2'
    }.get(semester, 'semester_1')
    
    # First get modules matching the search query
    modules_result = supabase.table('modules').select(
        'module_code, title, module_credit'
    ).or_(
        f"module_code.ilike.%{q}%,title.ilike.%{q}%"
    ).limit(50).execute()
    
    if not modules_result.data:
        return []
    
    # Get module codes that are offered in the specified semester
    module_codes = [m['module_code'] for m in modules_result.data]
    
    # Query module_offerings for these modules in the specified semester (no year filter - semester offerings are consistent across years)
    offerings_result = supabase.table('module_offerings').select(
        'module_code'
    ).in_('module_code', module_codes).eq(sem_column, True).execute()
    
    offered_codes = set(m['module_code'] for m in offerings_result.data)
    
    # Filter and return only modules offered in this semester
    return [
        {
            "code": m['module_code'],
            "title": m['title'],
            "credits": m['module_credit'],
            "offered": True
        }
        for m in modules_result.data
        if m['module_code'] in offered_codes
    ][:limit]

@app.get("/modules/{module_code}/offered")
def check_module_offered(module_code: str, semester: int = 1):
    """Check if a module is offered in a specific semester (no year filter - offerings are consistent)."""
    sem_column = {
        1: 'semester_1',
        2: 'semester_2',
        3: 'special_term_1', 
        4: 'special_term_2'
    }.get(semester, 'semester_1')
    
    # Query without year filter - if module is offered in Sem 1, it's always Sem 1
    result = supabase.table('module_offerings').select(
        'module_code', sem_column
    ).eq('module_code', module_code).limit(1).execute()
    
    if not result.data:
        return {"module_code": module_code, "offered": False, "semester": semester}
    
    is_offered = result.data[0].get(sem_column, False)
    return {"module_code": module_code, "offered": is_offered, "semester": semester}

# ============== Degree Requirements Endpoints ==============

@app.get("/degree-requirements")
def get_all_degree_requirements():
    """Get all degree requirements."""
    result = supabase.table('degree_requirements').select('*').execute()
    return result.data

@app.get("/degree-requirements/{major}")
def get_degree_requirements(major: str):
    """Get degree requirements for a specific major."""
    # Case insensitive search
    result = supabase.table('degree_requirements').select('*').ilike('major', f"%{major}%").execute()
    
    if not result.data:
         # Try precise match if fuzzy fails or returns empty
        result = supabase.table('degree_requirements').select('*').eq('major', major).execute()
        
    if not result.data:
        raise HTTPException(status_code=404, detail="Major requirements not found")
        
    return result.data[0]

@app.post("/modules/check-prereqs")
def check_prerequisites(request: dict):
    """Check if prerequisites are satisfied for a module.
    
    Request body:
        module_code: str - The module to check prerequisites for
        completed_modules: List[str] - List of completed module codes
    
    Returns:
        satisfied: bool - Whether all prerequisites are met
        missing: List[str] - List of missing prerequisite courses
        prerequisite_tree: Any - The raw prerequisite tree from database
    """
    module_code = request.get("module_code", "")
    completed_modules = set(request.get("completed_modules", []))
    
    # Get module prerequisite info from database
    result = supabase.table('modules').select('prerequisite_rule, prerequisite_tree').eq('module_code', module_code).execute()
    
    if not result.data:
        return {"satisfied": True, "missing": [], "prerequisite_tree": None, "message": "Module not found"}
    
    module = result.data[0]
    prereq_tree = module.get('prerequisite_tree')
    prereq_text = module.get('prerequisite_rule', '')
    
    # If no prerequisites, it's satisfied
    if not prereq_tree and not prereq_text:
        return {"satisfied": True, "missing": [], "prerequisite_tree": prereq_tree}
    
    # Helper to get base code (ignore suffix like 'S', 'T' if not 4 digits)
    import re
    def get_base_code(c):
        # Match AAXXXX where X is digit, ignore anything after
        match = re.match(r'^([A-Z]{2,4}\d{4})', c)
        return match.group(1) if match else c

    # Create set of base codes for completed modules
    # We should perform fuzzy match on completed modules too
    completed_bases = {get_base_code(c) for c in completed_modules}
    
    missing = []
    
    def check_tree(node):
        if isinstance(node, str):
            # Leaf node: "CS1010:D" or just "CS1010"
            req_code = node.split(':')[0]
            # Fuzzy match
            if get_base_code(req_code) in completed_bases:
                return True
            else:
                return [req_code]
        
        if isinstance(node, dict):
            if 'and' in node:
                # All must be satisfied
                child_missing = []
                for child in node['and']:
                    res = check_tree(child)
                    if res is not True:
                        if isinstance(res, list): child_missing.extend(res)
                if not child_missing:
                    return True
                return child_missing
            
            if 'or' in node:
                # At least one must be satisfied
                # We collect missing from all branches, but if one returns True, we represent satisfied
                all_child_missing = []
                for child in node['or']:
                    res = check_tree(child)
                    if res is True:
                        return True
                    if isinstance(res, list): all_child_missing.extend(res)
                return all_child_missing # Return all missing options if none satisfied
        
        return True # Default fallback (shouldn't happen with valid tree)

    # Use tree if available, otherwise fallback to text
    if prereq_tree:
        result_check = check_tree(prereq_tree)
        if result_check is True:
             return {
                "satisfied": True,
                "missing": [],
                "prerequisite_tree": prereq_tree,
                "prerequisite_text": prereq_text
            }
        else:
             # Flatten missing list uniquely
             flat_missing = list(set(result_check)) if isinstance(result_check, list) else []
             return {
                "satisfied": False,
                "missing": flat_missing,
                "prerequisite_tree": prereq_tree,
                "prerequisite_text": prereq_text
            }

    if prereq_text:
        # Extract module codes from prerequisite text (e.g., "CS1101S and CS1231S")
        # Fallback if no tree
        prereq_codes = re.findall(r'[A-Z]{2,4}\d{4}[A-Z]?', prereq_text)
        for code in prereq_codes:
            # Check if base code exists in completed modules
            if get_base_code(code) not in completed_bases:
                missing.append(code)
    
    return {
        "satisfied": len(missing) == 0,
        "missing": missing,
        "prerequisite_tree": prereq_tree,
        "prerequisite_text": prereq_text
    }

@app.get("/modules/{module_code}")
def get_module(module_code: str):
    """Get a specific module by code with full details including offerings and reviews."""
    # Get module basic info
    result = supabase.table('modules').select('*').eq('module_code', module_code).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Module not found")
    
    module = result.data[0]
    
    # Get semester offerings
    offerings_result = supabase.table('module_offerings').select(
        'semester_1, semester_2, special_term_1, special_term_2, exam_info'
    ).eq('module_code', module_code).limit(1).execute()
    
    offered_semesters = []
    exam_info = {}
    if offerings_result.data:
        off = offerings_result.data[0]
        if off.get('semester_1'):
            offered_semesters.append('Semester 1')
        if off.get('semester_2'):
            offered_semesters.append('Semester 2')
        if off.get('special_term_1'):
            offered_semesters.append('Special Term 1')
        if off.get('special_term_2'):
            offered_semesters.append('Special Term 2')
        exam_info = off.get('exam_info', {})
    
    # Get reviews (limit to 10 most recent)
    reviews_result = supabase.table('reviews').select(
        'comment, rating, academic_year, timestamp'
    ).eq('module_code', module_code).order(
        'timestamp', desc=True
    ).limit(10).execute()
    
    # Parse workload into human-readable format
    workload = module.get('workload', [])
    workload_desc = ""
    if workload and isinstance(workload, list) and len(workload) >= 5:
        workload_desc = f"Lecture: {workload[0]}h, Tutorial: {workload[1]}h, Lab: {workload[2]}h, Project: {workload[3]}h, Self-study: {workload[4]}h"
    elif workload:
        workload_desc = str(workload)
    
    return {
        **module,
        "offered_semesters": offered_semesters,
        "exam_info": exam_info,
        "reviews": reviews_result.data,
        "workload_description": workload_desc
    }

# ============== Plan Endpoints ==============

@app.get("/plans/user/{user_id}")
def get_user_plan(user_id: str):
    """Get a user's saved plan by user_id."""
    plan_result = supabase.table('plans').select('*').eq('user_id', user_id).limit(1).execute()
    
    if not plan_result.data:
        # Return empty plan structure if user has no saved plan
        return {
            "exists": False,
            "plan": None
        }
    
    plan = plan_result.data[0]
    plan_content = plan.get('content', {})
    
    # Get all modules for lookup
    modules_result = supabase.table('modules').select('module_code, title, module_credit').execute()
    mod_map = {m['module_code']: m for m in modules_result.data}
    
    def build_semester(sem_id: int, name: str, mod_codes: List[str]):
        sem_modules = []
        units = 0
        for code in mod_codes:
            mod = mod_map.get(code)
            if mod:
                sem_modules.append({
                    "code": code,
                    "title": mod.get('title', code),
                    "units": int(mod.get('module_credit', 4))
                })
                units += int(mod.get('module_credit', 4))
            else:
                sem_modules.append({"code": code, "title": code, "units": 4})
                units += 4
        return {"id": sem_id, "name": name, "units": units, "modules": sem_modules}
    
    academic_years = []
    start_year = plan_content.get('minYear', '2024/2025')
    start_year_num = int(start_year.split('/')[0]) if '/' in start_year else 2024

    # Standard "NUSMods" export format uses a 'modules' map
    if 'modules' in plan_content and isinstance(plan_content['modules'], dict):
        modules_data = plan_content['modules']
        
        # Organize modules by year and semester
        # Structure: plan_map[year_idx][sem_num] = [(index, code), ...]
        plan_map = {
            1: {1: [], 2: [], 3: [], 4: []},
            2: {1: [], 2: [], 3: [], 4: []},
            3: {1: [], 2: [], 3: [], 4: []},
            4: {1: [], 2: [], 3: [], 4: []}
        }
        
        exempted_modules = []

        for key, item in modules_data.items():
            mod_code = item.get('moduleCode')
            if not mod_code: continue

            year_str = item.get('year') # e.g. "2024/2025" or "-1"
            sem_num = item.get('semester') # 1, 2, 3, 4
            idx = item.get('index', 0)

            if year_str == "-1":
                exempted_modules.append(mod_code)
                continue
            
            # Calculate year index (1-4)
            try:
                item_year_num = int(year_str.split('/')[0]) if '/' in year_str else 2024
                year_idx = item_year_num - start_year_num + 1
                
                if 1 <= year_idx <= 4:
                     # Check if sem_num is valid, default to 1
                    s_num = int(sem_num) if sem_num else 1
                    if s_num in plan_map[year_idx]:
                        plan_map[year_idx][s_num].append((idx, mod_code))
            except:
                continue

        # Build final structure
        for year_idx in range(1, 5):
            semesters = []
            
            # Helper to get sorted codes
            def get_sorted_codes(y_idx, s_num):
                items = plan_map[y_idx][s_num]
                items.sort(key=lambda x: x[0]) # Sort by index
                return [x[1] for x in items]

            # Sem 1 & 2
            s1_id = (year_idx - 1) * 4 + 1
            s2_id = (year_idx - 1) * 4 + 2
            semesters.append(build_semester(s1_id, "Semester 1", get_sorted_codes(year_idx, 1)))
            semesters.append(build_semester(s2_id, "Semester 2", get_sorted_codes(year_idx, 2)))
            
            # Special Terms
            st1_codes = get_sorted_codes(year_idx, 3)
            st2_codes = get_sorted_codes(year_idx, 4)
            
            if st1_codes:
                s3_id = (year_idx - 1) * 4 + 3
                semesters.append(build_semester(s3_id, "Special Term 1", st1_codes))
            if st2_codes:
                s4_id = (year_idx - 1) * 4 + 4
                semesters.append(build_semester(s4_id, "Special Term 2", st2_codes))
            
            academic_years.append({
                "year": year_idx,
                "label": f"Year {year_idx}",
                "academicYear": f"{start_year_num + year_idx - 1}/{start_year_num + year_idx}",
                "totalUnits": sum(s["units"] for s in semesters),
                "semesters": semesters
            })
            
    else:
        # Legacy Format Handling (fallback)
        exempted_modules = [] # Legacy didn't explicitly support this in same way or we ignore it
        for year_idx in range(1, 5):
            # Regular semesters
            sem1_mods = plan_content.get(f"y{year_idx}s1", [])
            sem2_mods = plan_content.get(f"y{year_idx}s2", [])
            s1_id = (year_idx - 1) * 4 + 1
            s2_id = (year_idx - 1) * 4 + 2
            semesters = [
                build_semester(s1_id, "Semester 1", sem1_mods),
                build_semester(s2_id, "Semester 2", sem2_mods)
            ]
            
            # Special terms if they exist
            st1_mods = plan_content.get(f"y{year_idx}st1", [])
            st2_mods = plan_content.get(f"y{year_idx}st2", [])
            if st1_mods:
                s3_id = (year_idx - 1) * 4 + 3
                semesters.append(build_semester(s3_id, "Special Term 1", st1_mods))
            if st2_mods:
                s4_id = (year_idx - 1) * 4 + 4
                semesters.append(build_semester(s4_id, "Special Term 2", st2_mods))
            
            academic_years.append({
                "year": year_idx,
                "label": f"Year {year_idx}",
                "academicYear": f"{start_year_num + year_idx - 1}/{start_year_num + year_idx}",
                "totalUnits": sum(s["units"] for s in semesters),
                "semesters": semesters
            })
    
    # Process exempted modules details
    processed_exempted = []
    for code in exempted_modules:
        mod = mod_map.get(code)
        if mod:
            processed_exempted.append({
                "code": code,
                "title": mod.get('title', code),
                "units": int(mod.get('module_credit', 4))
            })
        else:
            processed_exempted.append({"code": code, "title": code, "units": 4})

    return {
        "exists": True,
        "plan": {
            "id": plan.get('id'),
            "name": plan.get('name', 'My Plan'),
            "minYear": start_year,
            "maxYear": f"{start_year_num + 3}/{start_year_num + 4}",
            "academicYears": academic_years,
            "exempted": processed_exempted
        }
    }

@app.get("/plans/dummy")
def get_dummy_plan():
    """Get a sample plan for display."""
    # Get first plan from database
    plan_result = supabase.table('plans').select('*').limit(1).execute()
    
    if not plan_result.data:
        # Return empty plan structure
        return [
            {
                "year": i,
                "label": f"Year {i}",
                "academicYear": f"{2024+i-1}/{2024+i}",
                "totalUnits": 0,
                "semesters": [
                    {"id": (i-1)*2+1, "name": "Semester 1", "units": 0, "modules": []},
                    {"id": (i-1)*2+2, "name": "Semester 2", "units": 0, "modules": []}
                ]
            }
            for i in range(1, 5)
        ]
    
    plan = plan_result.data[0]
    plan_content = plan.get('content', {})
    
    # Get all modules for lookup
    modules_result = supabase.table('modules').select('module_code, title, module_credit').execute()
    mod_map = {m['module_code']: m for m in modules_result.data}
    
    def build_semester(sem_id: int, name: str, mod_codes: List[str]):
        sem_modules = []
        units = 0
        for code in mod_codes:
            mod = mod_map.get(code)
            if mod:
                sem_modules.append({
                    "code": mod['module_code'],
                    "title": mod['title'],
                    "units": mod['module_credit']
                })
                units += mod['module_credit']
            else:
                sem_modules.append({
                    "code": code,
                    "title": "Unknown Module",
                    "units": 4,
                    "hasError": True
                })
                units += 4
        return {"id": sem_id, "name": name, "units": units, "modules": sem_modules}
    
    academic_years = []
    for year_idx in range(1, 5):
        sem1_mods = plan_content.get(f"y{year_idx}s1", [])
        sem2_mods = plan_content.get(f"y{year_idx}s2", [])
        s1_id = (year_idx - 1) * 2 + 1
        s2_id = (year_idx - 1) * 2 + 2
        sem1 = build_semester(s1_id, "Semester 1", sem1_mods)
        sem2 = build_semester(s2_id, "Semester 2", sem2_mods)
        
        academic_years.append({
            "year": year_idx,
            "label": f"Year {year_idx}",
            "academicYear": f"{2024+year_idx-1}/{2024+year_idx}",
            "totalUnits": sem1["units"] + sem2["units"],
            "semesters": [sem1, sem2]
        })
    
    return academic_years

# ============== Plan Generation ==============

class GeneratePlanRequest(BaseModel):
    degree: str = "computing"
    major: str = "Computer Science"
    focus_area: str = "AI"
    max_mcs: int = 20
    exempted_codes: Optional[List[str]] = None
    sep_semester: Optional[str] = None
    fixed_courses: Optional[Dict[str, str]] = None
    max_hard_per_sem: int = 4

class GeneratePlanResponse(BaseModel):
    success: bool
    plan: Dict[str, Any]
    message: str

@app.post("/plans/generate", response_model=GeneratePlanResponse)
def generate_plan(request: GeneratePlanRequest):
    """Generate an optimal study plan using DAG topological sort algorithm."""
    try:
        from app.core import generate_study_plan
        
        plan = generate_study_plan(
            degree=request.degree,
            major=request.major,
            focus_area=request.focus_area,
            max_mcs=request.max_mcs,
            exempted_codes=request.exempted_codes,
            sep_semester=request.sep_semester,
            fixed_courses=request.fixed_courses,
            max_hard_per_sem=request.max_hard_per_sem
        )
        
        return GeneratePlanResponse(
            success=True,
            plan=plan,
            message="Plan generated successfully!"
        )
    except Exception as e:
        return GeneratePlanResponse(
            success=False,
            plan={},
            message=f"Failed to generate plan: {str(e)}"
        )

# ============== Plan Saving ==============

class SavePlanRequest(BaseModel):
    plan_data: Dict[str, Any]
    plan_name: str = "My Plan"
    user_id: str = None

class SavePlanResponse(BaseModel):
    success: bool
    plan_id: str
    message: str

@app.post("/plans", response_model=SavePlanResponse)
def save_plan(request: SavePlanRequest):
    """Save a user's plan to the database (Logic-based Upsert).
    Enforces 'One Plan Per User'.
    """
    try:
        user_id = request.user_id
        
        # Enforce user_id presence
        if not user_id:
             return SavePlanResponse(
                success=False,
                plan_id="",
                message="User ID is required to save a plan. Please login."
            )
        
        # Check for ANY existing plans for this user
        existing_result = supabase.table('plans').select('id').eq('user_id', user_id).execute()
        existing_plans = existing_result.data if existing_result.data else []
        
        plan_data = {
            'user_id': user_id,
            'name': request.plan_name,
            'content': request.plan_data
        }

        if len(existing_plans) > 0:
            # Update the first found plan
            plan_id = existing_plans[0]['id']
            result = supabase.table('plans').update(plan_data).eq('id', plan_id).execute()
            
            # Self-healing: Delete any extra duplicates if they exist
            if len(existing_plans) > 1:
                duplicate_ids = [p['id'] for p in existing_plans[1:]]
                for dup_id in duplicate_ids:
                    supabase.table('plans').delete().eq('id', dup_id).execute()
        else:
            # Create new plan
            result = supabase.table('plans').insert(plan_data).execute()
        
        if result.data:
            return SavePlanResponse(
                success=True,
                plan_id=str(result.data[0]['id']),
                message="Plan saved successfully!"
            )
        else:
            return SavePlanResponse(
                success=False,
                plan_id="",
                message="Failed to save plan (Database error)"
            )
    except Exception as e:
        return SavePlanResponse(
            success=False,
            plan_id="",
            message=f"Error saving plan: {str(e)}"
        )

# ============== Chat Endpoint ==============

from app.agent import CoursePlanningAgent

# Initialize Agent
agent = CoursePlanningAgent()

class ChatRequest(BaseModel):
    user_id: str
    message: str
    current_plan: Dict[str, Any] = {}
    user_major: str = "Undeclared"
    user_degree: str = "Undeclared"
    current_semester: str = "Y1S1"
    start_year: str = "2024/2025"
    has_exchange: bool = False
    conversation_history: List[Dict[str, str]] = []
    conversation_summary: str = ""  # Summary of older messages beyond the 10-message window

class ChatResponse(BaseModel):
    reply: str
    tool_calls: Optional[List[Dict[str, Any]]] = None

@app.post("/chat", response_model=ChatResponse)
def chat_with_ai(request: ChatRequest):
    """Chat with AI for module planning help using the Agent."""
    try:
        # Process message with Agent
        response = agent.process_chat(
            user_id=request.user_id,
            message=request.message,
            current_plan=request.current_plan,
            user_major=request.user_major,
            user_degree=request.user_degree,
            current_semester=request.current_semester,
            start_year=request.start_year,
            has_exchange=request.has_exchange,
            conversation_history=request.conversation_history,
            conversation_summary=request.conversation_summary
        )
        
        return ChatResponse(
            reply=response.get("content") or "I'm thinking...",
            tool_calls=response.get("tool_calls")
        )
    except Exception as e:
        return ChatResponse(reply=f"Error processing request: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
