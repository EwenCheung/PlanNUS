"""
Study Plan Generation Algorithm
Uses DAG with topological sort to generate optimal course scheduling
Fetches degree requirements from Supabase database
"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from collections import defaultdict
import re

from .supabase_client import get_supabase


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
    fluff: bool = False  # True for Common Core modules, False otherwise


@dataclass
class CategorySummary:
    """Summary of a requirement category."""
    category: str
    fluff: bool
    units_required: int
    courses_needed: int  # Approximate number of courses to fulfill requirement
    available_options: List[str]
    is_fixed: bool  # True if all courses are required, False if pick from options
    required_courses: List[Dict] = field(default_factory=list)  # List of required course details (when is_fixed=True)
    suggested_courses: List[Dict] = field(default_factory=list)  # List of suggested course options (when is_fixed=False)


@dataclass
class DegreeSummary:
    """Complete summary of degree requirements for agentic AI workflows."""
    major: str
    focus_area: Optional[str]
    degree: str
    faculty: str
    total_units: int
    categories: List[CategorySummary]
    all_courses: List[Course]
    insights: List[str]

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "major": self.major,
            "focus_area": self.focus_area,
            "degree": self.degree,
            "faculty": self.faculty,
            "total_units": self.total_units,
            "categories": [
                {
                    "category": c.category,
                    "fluff": c.fluff,
                    "units_required": c.units_required,
                    "courses_needed": c.courses_needed,
                    "available_options": c.available_options,
                    "is_fixed": c.is_fixed,
                    "required_courses": c.required_courses,
                    "suggested_courses": c.suggested_courses
                }
                for c in self.categories
            ],
            "all_courses": [
                {
                    "code": c.code,
                    "title": c.title,
                    "credit": c.credit,
                    "type": c.type,
                    "fluff": c.fluff,
                    "prereq": c.prereq,
                    "coreq": c.coreq,
                    "preclusion": c.preclusion
                }
                for c in self.all_courses
            ],
            "insights": self.insights
        }


def extract_course_codes_from_requirements(requirements: Dict, focus_area: Optional[str] = None) -> Dict[str, List[str]]:
    """
    Extract all course codes from a requirements JSON structure.

    Args:
        requirements: The requirements JSON from degree_requirements table
        focus_area: Optional focus area code (e.g., "AI", "SE", "ALG") for computing degrees

    Returns:
        Dict mapping course type to list of course codes
    """
    course_codes = defaultdict(list)

    # Extract from commonCore
    common_core = requirements.get('commonCore', {})
    for category in common_core.get('categories', []):
        category_name = category.get('name', 'Common Core')

        # Direct options in category
        if 'options' in category:
            for code in category.get('options', []):
                if code and not code.endswith('%'):  # Skip wildcard patterns
                    course_codes[f"CC-{category_name}"].append(code)

        # Nested requirements
        for req in category.get('requirements', []):
            req_name = req.get('name', category_name)
            for code in req.get('options', []):
                if code and not code.endswith('%'):
                    course_codes[f"CC-{req_name}"].append(code)

    # Extract from core
    core = requirements.get('core', {})
    for category in core.get('categories', []):
        category_name = category.get('name', 'Core')

        # Direct options in category
        if 'options' in category:
            for code in category.get('options', []):
                if code and not code.endswith('%'):
                    course_codes[f"Core-{category_name}"].append(code)

        # Nested requirements
        for req in category.get('requirements', []):
            req_name = req.get('name', category_name)
            for code in req.get('options', []):
                if code and not code.endswith('%'):
                    course_codes[f"Core-{req_name}"].append(code)

    # Extract focus area courses (for Computing degrees)
    focus_area_data = requirements.get('focusArea', {})
    if focus_area_data and focus_area:
        # First try exact code match, then try name match
        matched_fa = None
        for fa_option in focus_area_data.get('options', []):
            fa_code = fa_option.get('code', '')
            if fa_code.upper() == focus_area.upper():
                matched_fa = fa_option
                break

        # If no exact code match, try name match
        if not matched_fa:
            for fa_option in focus_area_data.get('options', []):
                fa_name = fa_option.get('name', '')
                if focus_area.lower() in fa_name.lower():
                    matched_fa = fa_option
                    break

        if matched_fa:
            fa_name = matched_fa.get('name', '')
            # Primary options (required)
            for code in matched_fa.get('primaryOptions', []):
                if code:
                    course_codes[f"Focus-{fa_name}-Primary"].append(code)

            # Elective options (choose from)
            for code in matched_fa.get('electiveOptions', []):
                if code:
                    course_codes[f"Focus-{fa_name}-Elective"].append(code)

    # Extract from major-specific structure (for BBA degrees)
    major_data = requirements.get('major', {})
    if major_data:
        major_name = major_data.get('name', 'Major')

        # Core modules
        core_modules = major_data.get('coreModules', {})
        for code in core_modules.get('options', []):
            if code and not code.endswith('%'):
                course_codes[f"Major-{major_name}-Core"].append(code)

        # Elective modules
        elective_modules = major_data.get('electiveModules', {})
        for level, level_data in elective_modules.items():
            if isinstance(level_data, dict):
                for code in level_data.get('options', []):
                    if code and not code.endswith('%'):
                        course_codes[f"Major-{major_name}-Elective-{level}"].append(code)

        # Capstone
        capstone = major_data.get('capstone', {})
        for code in capstone.get('options', []):
            if code and not code.endswith('%'):
                course_codes[f"Major-{major_name}-Capstone"].append(code)

    return dict(course_codes)


def get_category_requirements(requirements: Dict, focus_area: Optional[str] = None) -> Dict[str, Dict]:
    """
    Extract category requirements with units needed.

    Returns:
        Dict mapping category name to {units, is_fixed, options}
    """
    category_reqs = {}

    # Common Core categories
    common_core = requirements.get('commonCore', {})
    for category in common_core.get('categories', []):
        cat_name = category.get('name', 'Common Core')
        cat_units = category.get('units', 0)

        if 'requirements' in category:
            for req in category['requirements']:
                req_name = req.get('name', cat_name)
                req_units = req.get('units', 0)
                options = [c for c in req.get('options', []) if c and not c.endswith('%')]
                is_fixed = len(options) == 1
                category_reqs[f"CC-{req_name}"] = {
                    'units': req_units,
                    'is_fixed': is_fixed,
                    'options': options,
                    'fluff': True
                }
        elif 'options' in category:
            options = [c for c in category.get('options', []) if c and not c.endswith('%')]
            is_fixed = len(options) <= cat_units // 4  # If options count matches required courses
            category_reqs[f"CC-{cat_name}"] = {
                'units': cat_units,
                'is_fixed': is_fixed,
                'options': options,
                'fluff': True
            }

    # Core categories
    core = requirements.get('core', {})
    for category in core.get('categories', []):
        cat_name = category.get('name', 'Core')
        cat_units = category.get('units', 0)

        if 'options' in category:
            options = [c for c in category.get('options', []) if c and not c.endswith('%')]
            # Fixed if total units of options equals required units
            is_fixed = len(options) * 4 <= cat_units + 4  # Allow some flexibility
            category_reqs[f"Core-{cat_name}"] = {
                'units': cat_units,
                'is_fixed': is_fixed,
                'options': options,
                'fluff': False
            }

        if 'requirements' in category:
            for req in category['requirements']:
                req_name = req.get('name', cat_name)
                req_units = req.get('units', 0)
                options = [c for c in req.get('options', []) if c and not c.endswith('%')]
                is_fixed = len(options) == 1 or (len(options) > 0 and len(options) * 4 <= req_units + 4)
                category_reqs[f"Core-{req_name}"] = {
                    'units': req_units,
                    'is_fixed': is_fixed,
                    'options': options,
                    'fluff': False
                }

    # Focus area
    focus_area_data = requirements.get('focusArea', {})
    if focus_area_data and focus_area:
        # First try exact code match, then try name match
        matched_fa = None
        for fa_option in focus_area_data.get('options', []):
            fa_code = fa_option.get('code', '')
            if fa_code.upper() == focus_area.upper():
                matched_fa = fa_option
                break

        # If no exact code match, try name match
        if not matched_fa:
            for fa_option in focus_area_data.get('options', []):
                fa_name = fa_option.get('name', '')
                if focus_area.lower() in fa_name.lower():
                    matched_fa = fa_option
                    break

        if matched_fa:
            fa_name = matched_fa.get('name', '')
            fa_units = matched_fa.get('units', 12)
            primary_options = matched_fa.get('primaryOptions', [])
            elective_options = matched_fa.get('electiveOptions', [])

            category_reqs[f"Focus-{fa_name}-Primary"] = {
                'units': fa_units,
                'is_fixed': False,
                'options': primary_options,
                'fluff': False
            }
            category_reqs[f"Focus-{fa_name}-Elective"] = {
                'units': 0,  # Electives are optional beyond primary
                'is_fixed': False,
                'options': elective_options,
                'fluff': False
            }

    # Major-specific (BBA)
    major_data = requirements.get('major', {})
    if major_data:
        major_name = major_data.get('name', 'Major')

        core_modules = major_data.get('coreModules', {})
        if core_modules:
            category_reqs[f"Major-{major_name}-Core"] = {
                'units': core_modules.get('units', 0),
                'is_fixed': True,
                'options': core_modules.get('options', []),
                'fluff': False
            }

        elective_modules = major_data.get('electiveModules', {})
        for level, level_data in elective_modules.items():
            if isinstance(level_data, dict):
                category_reqs[f"Major-{major_name}-Elective-{level}"] = {
                    'units': level_data.get('units', 0),
                    'is_fixed': False,
                    'options': level_data.get('options', []),
                    'fluff': False
                }

        capstone = major_data.get('capstone', {})
        if capstone:
            category_reqs[f"Major-{major_name}-Capstone"] = {
                'units': capstone.get('units', 0),
                'is_fixed': True,
                'options': capstone.get('options', []),
                'fluff': False
            }

    # Unrestricted Electives
    ue = requirements.get('unrestrictedElectives', {})
    if ue:
        category_reqs["Unrestricted Electives"] = {
            'units': ue.get('units', 40),
            'is_fixed': False,
            'options': [],
            'fluff': True
        }

    return category_reqs


def get_module_details(module_codes: List[str]) -> Dict[str, Dict]:
    """
    Fetch module details from the modules table.
    """
    if not module_codes:
        return {}

    supabase = get_supabase()
    modules = {}
    batch_size = 50

    for i in range(0, len(module_codes), batch_size):
        batch = module_codes[i:i + batch_size]
        result = supabase.table('modules').select(
            'module_code, title, module_credit, prerequisite_rule, prerequisite_tree, corequisite, preclusion'
        ).in_('module_code', batch).execute()

        for mod in result.data:
            modules[mod['module_code']] = mod

    return modules


def get_module_offerings(module_codes: List[str], acad_year: str = "2025-2026") -> Dict[str, Dict]:
    """
    Fetch module offerings to determine semester availability.
    """
    if not module_codes:
        return {}

    supabase = get_supabase()
    offerings = {}
    batch_size = 50

    for i in range(0, len(module_codes), batch_size):
        batch = module_codes[i:i + batch_size]
        result = supabase.table('module_offerings').select(
            'module_code, semester_1, semester_2, special_term_1, special_term_2'
        ).in_('module_code', batch).eq('acad_year', acad_year).execute()

        for offering in result.data:
            offerings[offering['module_code']] = offering

    return offerings


def parse_simple_prereqs(prereq_tree: Any) -> List[str]:
    """
    Parse prerequisite tree and extract a simple list of prereq codes.
    """
    if prereq_tree is None:
        return []

    if isinstance(prereq_tree, str):
        return [prereq_tree]

    if isinstance(prereq_tree, list):
        prereqs = []
        for item in prereq_tree:
            prereqs.extend(parse_simple_prereqs(item))
        return prereqs

    if isinstance(prereq_tree, dict):
        if 'and' in prereq_tree:
            prereqs = []
            for item in prereq_tree['and']:
                prereqs.extend(parse_simple_prereqs(item))
            return prereqs
        elif 'or' in prereq_tree:
            if prereq_tree['or']:
                return parse_simple_prereqs(prereq_tree['or'][0])

    return []


def get_needed_courses(major: str, focus_area: Optional[str] = None) -> List[Course]:
    """
    Returns a list of courses needed for the given major.
    Fetches requirements from the degree_requirements table and course details from modules table.

    Args:
        major: e.g., "Computer Science", "Business Analytics", "Business Administration - Finance"
        focus_area: e.g., "AI", "SE", "ALG" (only for Computing degrees with focus areas)

    Returns:
        List of Course objects required for graduation
    """
    supabase = get_supabase()

    # Fetch degree requirements for the major
    result = supabase.table('degree_requirements').select('*').eq('major', major).execute()

    if not result.data:
        raise ValueError(f"No degree requirements found for major: {major}")

    req_data = result.data[0]
    requirements = req_data.get('requirements', {})

    # Check if this degree has focus areas (Computing degrees)
    has_focus_area = 'focusArea' in requirements and requirements['focusArea'].get('options')

    # If focus area is required but not provided, raise error
    if has_focus_area and not focus_area:
        available_fas = [fa['name'] for fa in requirements['focusArea'].get('options', [])]
        raise ValueError(f"Focus area is required for {major}. Available options: {available_fas}")

    # Extract course codes from requirements
    course_codes_by_type = extract_course_codes_from_requirements(requirements, focus_area)

    # Flatten all course codes
    all_course_codes = []
    for codes in course_codes_by_type.values():
        all_course_codes.extend(codes)

    # Remove duplicates while preserving order
    seen = set()
    unique_codes = []
    for code in all_course_codes:
        if code not in seen:
            seen.add(code)
            unique_codes.append(code)

    # Fetch module details
    module_details = get_module_details(unique_codes)

    # Build Course objects
    courses = []

    for course_type, codes in course_codes_by_type.items():
        for code in codes:
            # Skip if already added (in case of duplicates across categories)
            if any(c.code == code for c in courses):
                continue

            module = module_details.get(code, {})

            # Parse prerequisites
            prereqs = parse_simple_prereqs(module.get('prerequisite_tree'))

            # Parse corequisites
            coreq_str = module.get('corequisite', '') or ''
            coreqs = [c.strip() for c in coreq_str.split(',') if c.strip()] if coreq_str else []

            # Parse preclusions
            preclusion_str = module.get('preclusion', '') or ''
            preclusions = []
            if preclusion_str:
                preclusions = re.findall(r'[A-Z]{2,4}\d{4}[A-Z]?', preclusion_str)

            # Determine if fluff (Common Core modules)
            is_fluff = course_type.startswith('CC-')

            course = Course(
                code=code,
                title=module.get('title', code),
                credit=int(module.get('module_credit', 4)),
                type=course_type,
                prereq=prereqs,
                coreq=coreqs,
                preclusion=preclusions,
                fluff=is_fluff
            )
            courses.append(course)

    return courses


def get_available_focus_areas(major: str) -> List[Dict[str, str]]:
    """
    Get available focus areas for a major.
    """
    supabase = get_supabase()

    result = supabase.table('degree_requirements').select('requirements').eq('major', major).execute()

    if not result.data:
        return []

    requirements = result.data[0].get('requirements', {})
    focus_area_data = requirements.get('focusArea', {})

    focus_areas = []
    for fa in focus_area_data.get('options', []):
        focus_areas.append({
            'name': fa.get('name', ''),
            'code': fa.get('code', '')
        })

    return focus_areas


def generate_summary(major: str, focus_area: Optional[str] = None) -> DegreeSummary:
    """
    Generate a complete summary of degree requirements for agentic AI workflows.

    Args:
        major: e.g., "Computer Science", "Business Analytics", "Business Administration - Finance"
        focus_area: e.g., "AI", "SE", "ALG" (only for Computing degrees with focus areas)

    Returns:
        DegreeSummary object containing all requirements, courses, and insights
    """
    supabase = get_supabase()

    # Fetch degree requirements
    result = supabase.table('degree_requirements').select('*').eq('major', major).execute()

    if not result.data:
        raise ValueError(f"No degree requirements found for major: {major}")

    req_data = result.data[0]
    requirements = req_data.get('requirements', {})
    degree = req_data.get('degree', 'Unknown')
    faculty = req_data.get('faculty', 'Unknown')
    total_units = int(req_data.get('total_units', 160))

    # Check if focus area is needed
    has_focus_area = 'focusArea' in requirements and requirements['focusArea'].get('options')

    if has_focus_area and not focus_area:
        available_fas = [fa['name'] for fa in requirements['focusArea'].get('options', [])]
        raise ValueError(f"Focus area is required for {major}. Available options: {available_fas}")

    # Get all courses
    courses = get_needed_courses(major, focus_area)

    # Create a lookup for courses by code
    course_lookup = {c.code: c for c in courses}

    # Get category requirements
    category_reqs = get_category_requirements(requirements, focus_area)

    # Build category summaries
    categories = []
    for cat_name, cat_info in category_reqs.items():
        units = cat_info['units']
        options = cat_info['options']
        is_fixed = cat_info['is_fixed']
        is_fluff = cat_info['fluff']

        # Calculate courses needed (assuming 4 units per course)
        courses_needed = units // 4 if units > 0 else 0

        # Get required courses for this category (courses that match the category type)
        # Find courses that belong to this category
        category_courses = [c for c in courses if c.type == cat_name]

        # Build required_courses list with course details (for fixed categories)
        required_courses = []
        suggested_courses = []

        if is_fixed:
            # Fixed categories - these are required courses
            if category_courses:
                for course in category_courses:
                    required_courses.append({
                        "code": course.code,
                        "title": course.title,
                        "credit": course.credit,
                        "prereq": course.prereq
                    })
            elif options:
                # If no courses found but options exist, use options to look up course details
                for code in options:
                    if code in course_lookup:
                        course = course_lookup[code]
                        required_courses.append({
                            "code": course.code,
                            "title": course.title,
                            "credit": course.credit,
                            "prereq": course.prereq
                        })
        else:
            # Non-fixed categories - these are suggested courses (pick from options)
            # Particularly useful for Focus Areas and electives
            if category_courses:
                for course in category_courses:
                    suggested_courses.append({
                        "code": course.code,
                        "title": course.title,
                        "credit": course.credit,
                        "prereq": course.prereq
                    })
            elif options:
                for code in options:
                    if code in course_lookup:
                        course = course_lookup[code]
                        suggested_courses.append({
                            "code": course.code,
                            "title": course.title,
                            "credit": course.credit,
                            "prereq": course.prereq
                        })

        categories.append(CategorySummary(
            category=cat_name,
            fluff=is_fluff,
            units_required=units,
            courses_needed=courses_needed,
            available_options=options,
            is_fixed=is_fixed,
            required_courses=required_courses,
            suggested_courses=suggested_courses
        ))

    # Generate insights
    insights = []

    # Count fluff vs non-fluff
    fluff_courses = [c for c in courses if c.fluff]
    core_courses = [c for c in courses if not c.fluff]

    insights.append(f"Total units required: {total_units}")
    insights.append(f"Common Core (fluff) modules available: {len(fluff_courses)} options")
    insights.append(f"Core/Major modules available: {len(core_courses)} options")

    # Focus area insight
    if focus_area:
        fa_courses = [c for c in courses if 'Focus' in c.type]
        insights.append(f"Focus Area ({focus_area}): {len(fa_courses)} courses available, need 12 units (3 courses)")

    # Identify required courses (fixed categories)
    fixed_courses = []
    for cat in categories:
        if cat.is_fixed and cat.available_options:
            fixed_courses.extend(cat.available_options)

    if fixed_courses:
        insights.append(f"Required courses (no choice): {len(set(fixed_courses))} courses")

    # Unrestricted electives
    ue_cat = next((c for c in categories if c.category == "Unrestricted Electives"), None)
    if ue_cat:
        insights.append(f"Unrestricted Electives: {ue_cat.units_required} units (~{ue_cat.courses_needed} courses of free choice)")

    # Prerequisite chains
    courses_with_prereqs = [c for c in courses if c.prereq]
    if courses_with_prereqs:
        insights.append(f"Courses with prerequisites: {len(courses_with_prereqs)}")

    return DegreeSummary(
        major=major,
        focus_area=focus_area,
        degree=degree,
        faculty=faculty,
        total_units=total_units,
        categories=categories,
        all_courses=courses,
        insights=insights
    )


def print_summary(summary: DegreeSummary) -> None:
    """
    Print a formatted summary for console output.
    """
    print("=" * 80)
    print(f"DEGREE SUMMARY: {summary.major}")
    if summary.focus_area:
        print(f"Focus Area: {summary.focus_area}")
    print(f"Degree: {summary.degree} | Faculty: {summary.faculty}")
    print(f"Total Units Required: {summary.total_units}")
    print("=" * 80)

    print("\n{:<45} {:>6} {:>8} {:>8} {:>8}".format(
        "Category", "Fluff", "Units", "Courses", "Fixed"
    ))
    print("-" * 80)

    for cat in sorted(summary.categories, key=lambda x: (not x.fluff, x.category)):
        fluff_str = "Yes" if cat.fluff else "No"
        fixed_str = "Yes" if cat.is_fixed else "No"
        print("{:<45} {:>6} {:>8} {:>8} {:>8}".format(
            cat.category[:45],
            fluff_str,
            cat.units_required,
            cat.courses_needed,
            fixed_str
        ))

    print("\n" + "=" * 80)
    print("KEY INSIGHTS")
    print("=" * 80)
    for insight in summary.insights:
        print(f"  • {insight}")

    print("\n" + "=" * 80)
    print("COURSES BY CATEGORY")
    print("=" * 80)

    # Group courses by type
    courses_by_type = defaultdict(list)
    for course in summary.all_courses:
        courses_by_type[course.type].append(course)

    for course_type in sorted(courses_by_type.keys()):
        type_courses = courses_by_type[course_type]
        fluff_indicator = "[FLUFF]" if type_courses[0].fluff else "[CORE]"
        print(f"\n{course_type} {fluff_indicator}")
        print("-" * 60)
        for course in type_courses[:10]:  # Limit to 10 per category for readability
            print(f"  {course.code}: {course.title[:40]} ({course.credit} units)")
        if len(type_courses) > 10:
            print(f"  ... and {len(type_courses) - 10} more options")


# Test/Main function
if __name__ == "__main__":
    test_cases = [
        ("Computer Science", "SE"),
        ("Information Security", None),
        ("Business Administration - Finance", None),
    ]

    for major, focus_area in test_cases:
        print("\n" + "#" * 80)
        print(f"# Testing: {major}" + (f" with {focus_area} focus" if focus_area else ""))
        print("#" * 80)

        try:
            summary = generate_summary(major=major, focus_area=focus_area)
            print_summary(summary)
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()

        print("\n")
