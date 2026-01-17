"""
Study Plan Generation Algorithm
Uses DAG with topological sort to generate optimal course scheduling
"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Set
from collections import defaultdict, deque
import re

@dataclass
class Course:
    """Represents a course with prerequisites, corequisites, and metadata."""
    code: str
    title: str
    credit: int
    type: str  # Core-CS, Core-MS, CC-UP, Focus in {X}-P, UE, etc.
    prereq: List[str] = field(default_factory=list)  # Simple prereq list (all AND)
    coreq: List[str] = field(default_factory=list)   # Must take together
    preclusion: List[str] = field(default_factory=list)  # Cannot take if one taken
    sem_offered: List[int] = field(default_factory=lambda: [1, 2])  # 1, 2, 3 (ST1), 4 (ST2)
    preferred_years: List[int] = field(default_factory=list) # e.g. [1, 2] for Y1-Y2
    is_fixed: bool = False # If true, should ideally be in a fixed semester
    fluff: bool = False


def get_needed_courses(degree: str, major: str, focus_area: str = "AI") -> List[Course]:
    """
    Returns a list of courses needed for the given degree and major.
    Currently hardcoded for Computer Science.
    
    Args:
        degree: e.g., "computing", "bba"
        major: e.g., "Computer Science"
        focus_area: e.g., "AI", "SoftwareEngineering", "Algorithms"
    
    Returns:
        List of Course objects required for graduation
    """
    courses = []
    
    # ============== COMMON CURRICULUM (CC) ==============
    # University Pillars
    courses.append(Course("CS1101S", "Programming Methodology", 4, "CC-UP", [], [], ["CS1101", "CS1010"]))
    courses.append(Course("ES2660", "Communicating in the Information Age", 4, "CC-UP", [], [], [], True, fluff=True))
    courses.append(Course("GEA1000", "Quantitative Reasoning with Data", 4, "CC-UP", [], [], ["ST1131", "BT1101", "DSA1101"], True, fluff=True))
    courses.append(Course("GES", "Singapore Studies", 4, "CC-UP", [], [], [], True, fluff=True))  # Placeholder
    courses.append(Course("GEC", "Cultures and Connections", 4, "CC-UP", [], [], [], True, fluff=True))  # Placeholder
    courses.append(Course("GEN", "Communities and Engagement", 4, "CC-UP", [], [], [], True, fluff=True))  # Placeholder
    
    # Computing Ethics
    courses.append(Course("IS1108", "Digital Ethics and Data Privacy", 4, "CC-CE", [], [], [], True, fluff=True))
    
    # Interdisciplinary (2 courses)
    courses.append(Course("ID-1", "Interdisciplinary Course 1", 4, "CC-ID", [], [], [], True, fluff=True))
    courses.append(Course("ID-2", "Interdisciplinary Course 2", 4, "CC-ID", [], [], [], True, fluff=True))
    
    # Cross-disciplinary (1 course)
    courses.append(Course("CD", "Cross-disciplinary Course", 4, "CC-CD", [], [], [], True, fluff=True))
    
    # ============== CORE - MATHEMATICS & SCIENCE ==============
    courses.append(Course("MA1521", "Calculus for Computing", 4, "Core-MS", [], [], ["MA2002"]))
    courses.append(Course("MA1522", "Linear Algebra for Computing", 4, "Core-MS", [], [], ["MA2001"]))
    courses.append(Course("ST2334", "Probability and Statistics", 4, "Core-MS", ["MA1521"], [], []))
    
    # ============== CORE - COMPUTER SCIENCE ==============
    courses.append(Course("CS1231S", "Discrete Structures", 4, "Core-CS", [], [], ["CS1231"]))
    courses.append(Course("CS2030S", "Programming Methodology II", 4, "Core-CS", ["CS1101S"], [], ["CS2030"]))
    courses.append(Course("CS2040S", "Data Structures and Algorithms", 4, "Core-CS", ["CS1101S", "CS1231S"], [], ["CS2040"]))
    courses.append(Course("CS2100", "Computer Organisation", 4, "Core-CS", ["CS1101S"], [], []))
    courses.append(Course("CS2101", "Effective Communication for Computing Professionals", 4, "Core-CS", [], ["CS2103T"], []))
    courses.append(Course("CS2103T", "Software Engineering", 4, "Core-CS", ["CS2030S", "CS2040S"], ["CS2101"], []))
    courses.append(Course("CS2106", "Introduction to Operating Systems", 4, "Core-CS", ["CS2100"], [], []))
    courses.append(Course("CS2109S", "Introduction to AI and Machine Learning", 4, "Core-CS", ["CS2040S", "CS1231S", "MA1521"], [], []))
    courses.append(Course("CS3230", "Design and Analysis of Algorithms", 4, "Core-CS", ["CS2040S", "CS1231S"], [], []))
    
    # ============== FOCUS AREA COURSES ==============
    if focus_area == "AI":
        # Primary Focus (must take)
        courses.append(Course("CS3243", "Introduction to Artificial Intelligence", 4, f"Focus in AI-P", ["CS2040S", "CS1231S"], [], []))
        courses.append(Course("CS3244", "Machine Learning", 4, f"Focus in AI-P", ["CS2040S", "MA1521", "MA1522", "ST2334"], [], []))
        # Elective Focus (choose from these)
        courses.append(Course("CS4243", "Computer Vision and Pattern Recognition", 4, f"Focus in AI-E", ["CS2040S", "MA1521", "MA1522"], [], []))
        courses.append(Course("CS4248", "Natural Language Processing", 4, f"Focus in AI-E", ["CS3243"], [], []))
        courses.append(Course("CS4269", "Fundamentals of Logic in CS", 4, f"Focus in AI-E", ["CS1231S"], [], []))
    elif focus_area == "SoftwareEngineering":
        courses.append(Course("CS3203", "Software Engineering Project", 8, f"Focus in SE-P", ["CS2103T"], [], []))
        courses.append(Course("CS3219", "Software Engineering Principles and Patterns", 4, f"Focus in SE-P", ["CS2103T"], [], []))
        courses.append(Course("CS4211", "Formal Methods for Software Engineering", 4, f"Focus in SE-E", ["CS2103T", "CS1231S"], [], []))
    elif focus_area == "Algorithms":
        courses.append(Course("CS3231", "Theory of Computation", 4, f"Focus in Algo-P", ["CS1231S", "CS2040S"], [], []))
        courses.append(Course("CS4231", "Parallel and Distributed Algorithms", 4, f"Focus in Algo-P", ["CS3230"], [], []))
        courses.append(Course("CS4232", "Theory of Computation", 4, f"Focus in Algo-E", ["CS3231"], [], []))
    
    # ============== UNRESTRICTED ELECTIVES ==============
    # Add placeholder UEs (students will fill with their own choices)
    for i in range(1, 6):
        courses.append(Course(f"UE-{i}", "Unrestricted Elective", 4, "UE", [], [], [], True, fluff=True))
    
    return courses


def evaluate_prereq_tree(prereq_tree: Any, completed: Set[str]) -> bool:
    """
    Evaluate if prerequisites are satisfied given completed courses.
    Handles complex AND/OR trees from NUSMods format.
    """
    if prereq_tree is None:
        return True
    
    if isinstance(prereq_tree, str):
        return prereq_tree in completed
    
    if isinstance(prereq_tree, list):
        # List = all must be completed (AND)
        return all(evaluate_prereq_tree(item, completed) for item in prereq_tree)
    
    if isinstance(prereq_tree, dict):
        if "and" in prereq_tree:
            return all(evaluate_prereq_tree(item, completed) for item in prereq_tree["and"])
        if "or" in prereq_tree:
            return any(evaluate_prereq_tree(item, completed) for item in prereq_tree["or"])
    
    return True


def build_prereq_graph(courses: List[Course]) -> Dict[str, List[str]]:
    """
    Build a dependency graph from courses.
    Edge (A -> B) means A is a prerequisite for B.
    """
    graph = defaultdict(list)
    course_codes = {c.code for c in courses}
    
    for course in courses:
        for prereq in course.prereq:
            if prereq in course_codes:
                graph[prereq].append(course.code)
    
    return graph


def topological_sort(courses: List[Course]) -> List[str]:
    """
    Perform topological sort on courses based on prerequisites.
    Uses Kahn's algorithm (BFS-based) with priority ordering by course type.
    """
    course_map = {c.code: c for c in courses}
    
    # Define type priority (lower = schedule earlier)
    def get_type_priority(code: str) -> int:
        course = course_map.get(code)
        if not course:
            return 99
        t = course.type
        # Critical foundations first
        if t == "CC-UP" or t.startswith("Core-"):
            return 1
        if t.startswith("Focus"):
            return 2
        
        # Fluff last (matches users desire to push them back/balance)
        if course.fluff or t == "UE" or t in ("CC-CE", "CC-ID", "CC-CD", "CC-UP"): 
            # Note: User marked GEA/ES/GES/GEC as fluff=True
            return 5 
            
        return 3
    
    graph = defaultdict(list)
    in_degree = defaultdict(int)
    course_codes = {c.code for c in courses}
    
    for code in course_codes:
        in_degree[code] = 0
    
    for course in courses:
        for prereq in course.prereq:
            if prereq in course_codes:
                graph[prereq].append(course.code)
                in_degree[course.code] += 1
    
    zero_degree = [code for code in course_codes if in_degree[code] == 0]
    zero_degree.sort(key=get_type_priority)
    queue = deque(zero_degree)
    result = []
    
    while queue:
        code = queue.popleft()
        result.append(code)
        
        neighbors_to_add = []
        for neighbor in graph[code]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                neighbors_to_add.append(neighbor)
        
        neighbors_to_add.sort(key=get_type_priority)
        queue.extend(neighbors_to_add)
    
    if len(result) != len(course_codes):
        missing = course_codes - set(result)
        result.extend(missing)
    
    return result


def assign_to_semesters(
    courses: List[Course],
    sorted_codes: List[str],
    max_mcs: int = 20,
    num_semesters: int = 8,
    exempted_codes: List[str] = None,
    fixed_courses: Dict[str, str] = None,
    sep_semester: Optional[str] = None,
    max_hard_per_sem: int = 4
) -> Dict[str, List[str]]:
    """
    Assign courses to semesters respecting prerequisites, corequisites,
    semester offerings, and workload limits.
    """
    if exempted_codes is None:
        exempted_codes = []
    if fixed_courses is None:
        fixed_courses = {}
        
    course_map = {c.code: c for c in courses}
    completed: Set[str] = set(exempted_codes)
    scheduled_courses = set()
    
    # Initialize semester structure
    semesters = {}
    for year in range(1, 5):
        for sem in range(1, 3):
            key = f"y{year}s{sem}"
            semesters[key] = {
                "codes": [], 
                "mcs": 0, 
                "core_count": 0,
                "fluff_count": 0,
                "is_sep": (key == sep_semester)
            }
            
    # Handle SEP Semester
    if sep_semester and sep_semester in semesters:
        semesters[sep_semester]["codes"] = ["SEP-PLACEHOLDER"]
        semesters[sep_semester]["mcs"] = 20

    # Helper definitions
    def is_hard_course(course: Course) -> bool:
        return (course.type.startswith("Core-") or 
                course.type.startswith("Focus"))

    def is_fluff_course(course: Course) -> bool:
        return course.fluff or course.type == "UE" or course.type.startswith("UE") or course.code.startswith("UE")
    
    def get_base_code(c):
         match = re.match(r'^([A-Z]{2,4}\d{4})', c)
         return match.group(1) if match else c
         
    def get_year_range(c: Course) -> tuple:
        if c.preferred_years:
            return (min(c.preferred_years), max(c.preferred_years))
        lvl_code = c.code
        if len(lvl_code) >= 3 and lvl_code[2].isdigit():
            level = int(lvl_code[2])
            if level == 1: return (1, 2)
            elif level == 2: return (1, 3)
            elif level == 3: return (2, 4)
            elif level >= 4: return (3, 4)
        return (1, 4)

    # --- PHASE 1: Pre-assign Fixed Courses ---
    for code, sem_key in fixed_courses.items():
        if code in course_map and sem_key in semesters:
            if code in scheduled_courses or code in exempted_codes: 
                continue
            
            course = course_map[code]
            semesters[sem_key]["codes"].append(code)
            semesters[sem_key]["mcs"] += course.credit
            if is_hard_course(course):
                semesters[sem_key]["core_count"] += 1
            if is_fluff_course(course):
                semesters[sem_key]["fluff_count"] += 1
            
            scheduled_courses.add(code)
            completed.add(code)

    # --- PHASE 2: Main Scheduling Loop ---
    # We define a "Max Fluff Per Semester" to force distribution
    MAX_FLUFF_PER_SEM = 2 # Heuristic: Max 2 fluff modules (8MCs) per sem to save some for later

    for code in sorted_codes:
        if code in scheduled_courses or code in exempted_codes:
            continue
            
        course = course_map.get(code)
        if not course: continue
        
        is_hard = is_hard_course(course)
        is_fluff = is_fluff_course(course)
        
        pref_min, pref_max = get_year_range(course)
        is_foundation = course.type in ["Core-CS", "Core-MS", "CC-UP"]

        sem_keys = list(semesters.keys())
        
        # Build map for temporal check
        scheduled_sem_map = {}
        for idx, s_key in enumerate(sem_keys):
            for c_code in semesters[s_key]["codes"]:
                scheduled_sem_map[c_code] = idx
        for ex in exempted_codes:
            scheduled_sem_map[ex] = -1

        # Attempt to schedule in main loop
        for sem_idx, sem_key in enumerate(sem_keys):
            sem_data = semesters[sem_key]
            if sem_data["is_sep"]: continue
            
            year = (sem_idx // 2) + 1
            sem_num = (sem_idx % 2) + 1
            
            # Prereqs check (SKIP for Fluff)
            prereqs_ok = True
            if not is_fluff:
                for p in course.prereq:
                    p_base = get_base_code(p)
                    satisfied = False
                    for c in completed:
                        if get_base_code(c) == p_base:
                            satisfied = True; break
                    if not satisfied:
                        prereqs_ok = False; break
            if not prereqs_ok: continue 
            
            # Offering check (SKIP for Fluff)
            if not is_fluff:
                if course.sem_offered and sem_num not in course.sem_offered: continue

            # Workload check
            if sem_data["mcs"] + course.credit > max_mcs: continue
            
            if is_hard and sem_data["core_count"] >= max_hard_per_sem:
                 if year <= pref_max: continue 
            
            # Fluff throttling (Spread it out!)
            # If strictly fluff, try to limit to MAX_FLUFF_PER_SEM, UNLESS we are in late years (Y4)
            # where we must simply fill the schedule.
            if is_fluff and sem_data["fluff_count"] >= MAX_FLUFF_PER_SEM:
                if year < 4: # Enforce throttling in Y1/Y2/Y3 to save fluff for Y4
                    continue

            # Coreqs check
            coreqs_ok = True
            coreq_courses = []
            for coreq_code in course.coreq:
                coreq = course_map.get(coreq_code)
                if coreq and coreq_code not in scheduled_courses and coreq_code not in exempted_codes:
                    # Check coreq prereqs locally
                    cp_ok = True
                    if not is_fluff_course(coreq): # Skip check if coreq is also fluff
                        for cp in coreq.prereq:
                            cp_base = get_base_code(cp)
                            cp_satis = False
                            for c in completed: 
                                if get_base_code(c) == cp_base: cp_satis = True; break
                            if not cp_satis and get_base_code(code) == cp_base: cp_satis = True
                            if not cp_satis: cp_ok = False; break
                    if not cp_ok: coreqs_ok = False; break

                    if sem_data["mcs"] + course.credit + coreq.credit > max_mcs:
                        coreqs_ok = False; break
                    coreq_courses.append(coreq)
            if not coreqs_ok: continue

            # Assign
            if code not in scheduled_courses:
                sem_data["codes"].append(code)
                sem_data["mcs"] += course.credit
                if is_hard: sem_data["core_count"] += 1
                if is_fluff: sem_data["fluff_count"] += 1
                scheduled_courses.add(code)
                completed.add(code)
            
            for cq in coreq_courses:
                if cq.code not in scheduled_courses:
                    sem_data["codes"].append(cq.code)
                    sem_data["mcs"] += cq.credit
                    if is_hard_course(cq): sem_data["core_count"] += 1
                    if is_fluff_course(cq): sem_data["fluff_count"] += 1
                    scheduled_courses.add(cq.code)
                    completed.add(cq.code)
            
            break # Done with this course

        # Fallback if not scheduled
        if code not in scheduled_courses:
             # Refresh map
             scheduled_sem_map = {}
             for idx, s_key in enumerate(sem_keys):
                 for c_code in semesters[s_key]["codes"]:
                     scheduled_sem_map[c_code] = idx
             for ex in exempted_codes:
                 scheduled_sem_map[ex] = -1

             for sem_idx, sem_key in enumerate(sem_keys):
                sem_data = semesters[sem_key]
                if sem_data["is_sep"]: continue
                sem_num = (sem_idx % 2) + 1
                
                # Loose Checks
                prereqs_ok = True
                if not is_fluff:
                    for p in course.prereq:
                        p_base = get_base_code(p)
                        satisfied = False
                        for s_code, s_idx in scheduled_sem_map.items():
                            if get_base_code(s_code) == p_base:
                                if s_idx < sem_idx: satisfied = True; break
                        if not satisfied: prereqs_ok = False; break
                if not prereqs_ok: continue
                
                if not is_fluff:
                    if course.sem_offered and sem_num not in course.sem_offered: continue

                # Coreqs check (Strict for fallback to avoid invalid plans)
                valid_coreqs = []
                coreqs_ok = True
                for coreq_code in course.coreq:
                    if coreq_code not in scheduled_courses and coreq_code not in exempted_codes:
                        coreq = course_map.get(coreq_code)
                        if coreq:
                            # Verify coreq prereqs
                            cp_ok = True
                            if not is_fluff_course(coreq):
                                for cp in coreq.prereq:
                                    cp_base = get_base_code(cp)
                                    cp_satis = False
                                    for s_code, s_idx in scheduled_sem_map.items():
                                        if get_base_code(s_code) == cp_base:
                                            if s_idx < sem_idx: cp_satis = True; break
                                    if not cp_satis and get_base_code(code) == cp_base: cp_satis = True
                                    if not cp_satis: cp_ok = False; break
                            if not cp_ok: coreqs_ok = False; break
                            
                            valid_coreqs.append(coreq)
                if not coreqs_ok: continue
                
                # Force Schedule
                print(f"Warning: Force scheduling {code} in {sem_key} due to constraints.")
                if code not in scheduled_courses:
                    sem_data["codes"].append(code)
                    sem_data["mcs"] += course.credit
                    if is_hard: sem_data["core_count"] += 1
                    scheduled_courses.add(code)
                    completed.add(code)
                
                for cq in valid_coreqs:
                    if cq.code not in scheduled_courses:
                        sem_data["codes"].append(cq.code)
                        sem_data["mcs"] += cq.credit
                        if is_hard_course(cq): sem_data["core_count"] += 1
                        scheduled_courses.add(cq.code)
                        completed.add(cq.code)
                
                break
    
    # Return simple format
    result = {}
    for key, data in semesters.items():
        result[key] = data["codes"]
    
    return result


def generate_study_plan(
    degree: str = "computing",
    major: str = "Computer Science",
    focus_area: str = "AI",
    max_mcs: int = 20,
    exempted_codes: List[str] = None,
    sep_semester: Optional[str] = None,
    fixed_courses: Dict[str, str] = None,
    max_hard_per_sem: int = 4
) -> Dict[str, Any]:
    """
    Generate an optimal study plan using DAG with topological sort.
    """
    # default exemptions
    defaults = ["MA1301", "ES1103", "ES1000"]
    if exempted_codes is None:
        exempted_codes = defaults
    else:
        for c in defaults:
            if c not in exempted_codes:
                exempted_codes.append(c)

    # Get required courses
    courses = get_needed_courses(degree, major, focus_area)

    # Ensure metadata for exempted courses exists
    existing_codes = {c.code for c in courses}
    exemption_meta = {
        "MA1301": Course("MA1301", "Introductory Mathematics", 4, "UE"),
        "ES1103": Course("ES1103", "English for Academic Purposes", 4, "UE"),
        "ES1000": Course("ES1000", "Basic English Course", 0, "UE"),
    }

    for code in exempted_codes:
        if code not in existing_codes:
            if code in exemption_meta:
                courses.append(exemption_meta[code])
            else:
                courses.append(Course(code, "Exempted Module", 4, "UE"))
    
    # Deduplicate courses by code (keep first occurrence)
    unique_courses = {}
    for c in courses:
        if c.code not in unique_courses:
            unique_courses[c.code] = c
    courses = list(unique_courses.values())
    
    # Topological sort based on prerequisites
    sorted_codes = topological_sort(courses)
    
    # Assign to semesters
    semester_plan = assign_to_semesters(
        courses, 
        sorted_codes, 
        max_mcs, 
        exempted_codes=exempted_codes,
        sep_semester=sep_semester,
        fixed_courses=fixed_courses,
        max_hard_per_sem=max_hard_per_sem
    )
    
    # Build output format
    total_mcs = sum(c.credit for c in courses)
    result = {
        "degree": degree,
        "major": major,
        "focus_area": focus_area,
        "max_mcs_per_semester": max_mcs,
        "total_mcs": total_mcs,
        "plan": semester_plan,
        "exempted": exempted_codes,
        "courses": {
            c.code: {
                "title": c.title,
                "credit": c.credit,
                "type": c.type,
                "fluff": c.fluff
            } for c in courses
        }
    }
    
    return result


# For testing
if __name__ == "__main__":
    import json
    
    plan = generate_study_plan(
        degree="computing",
        major="Computer Science",
        focus_area="AI",
        max_mcs=24,
        fixed_courses={"CS1101S": "y1s1"},
        sep_semester="y3s2",
        max_hard_per_sem=4
    )
    
    print("Generated Study Plan (with Fixed CS1101S @ Y1S1 & SEP @ Y3S2, Max MCs=24):")
    print(json.dumps(plan["plan"], indent=2))
