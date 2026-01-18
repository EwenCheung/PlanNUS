import { AcademicYear, Module } from './types';

const API_BASE_URL = 'http://localhost:8000';

export async function fetchDummyPlan(): Promise<AcademicYear[]> {
    const response = await fetch(`${API_BASE_URL}/plans/dummy`);
    if (!response.ok) {
        throw new Error('Failed to fetch plan');
    }
    return response.json();
}

export interface UserPlanResponse {
    exists: boolean;
    plan: {
        id: string;
        name: string;
        minYear: string;
        maxYear: string;
        academicYears: AcademicYear[];
        exempted?: { code: string; title: string; units: number }[];
    } | null;
}

export async function fetchUserPlan(userId: string): Promise<UserPlanResponse> {
    const response = await fetch(`${API_BASE_URL}/plans/user/${userId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch user plan');
    }
    return response.json();
}

export async function fetchModules(): Promise<Module[]> {
    const response = await fetch(`${API_BASE_URL}/modules`);
    if (!response.ok) {
        throw new Error('Failed to fetch modules');
    }
    return response.json();
}

export interface SavePlanResponse {
    success: boolean;
    plan_id: string;
    message: string;
}

export async function savePlan(planData: Record<string, any>, planName: string = "My Plan", userId?: string, keepalive: boolean = false): Promise<SavePlanResponse> {
    const response = await fetch(`${API_BASE_URL}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: keepalive,
        body: JSON.stringify({
            plan_data: planData,
            plan_name: planName,
            user_id: userId
        })
    });

    if (!response.ok) {
        throw new Error('Failed to save plan');
    }
    return response.json();
}

// ============== Plan Generation ==============

export interface GeneratePlanRequest {
    degree: string;
    major: string;
    focus_area: string;
    max_mcs: number;
    exempted_codes?: string[];
    sep_semester?: string;
    fixed_courses?: Record<string, string>;
    max_hard_per_sem?: number;
}

export interface GeneratePlanResponse {
    success: boolean;
    plan: {
        degree: string;
        major: string;
        focus_area: string;
        max_mcs_per_semester: number;
        total_mcs: number;
        sep_semester?: string;
        plan: Record<string, string[]>;  // y1s1: ["CS1101S", ...], etc.
        exempted?: string[];
        courses: Record<string, { title: string; credit: number; type: string; fluff?: boolean }>;
    };
    message: string;
}

export async function generatePlan(request: GeneratePlanRequest): Promise<GeneratePlanResponse> {
    const response = await fetch(`${API_BASE_URL}/plans/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        throw new Error('Failed to generate plan');
    }
    return response.json();
}

export interface ModuleSearchResult {
    code: string;
    title: string;
    credits: number;
    department?: string;
    offered?: boolean;
}

export async function searchModules(query: string, limit: number = 20): Promise<ModuleSearchResult[]> {
    if (!query || query.length < 2) return [];

    const response = await fetch(`${API_BASE_URL}/modules/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!response.ok) {
        throw new Error('Failed to search modules');
    }
    return response.json();
}

export async function searchModulesBySemester(
    query: string,
    acadYear: string = "2025-2026",
    semester: 1 | 2 | 3 | 4 = 1,
    limit: number = 5
): Promise<ModuleSearchResult[]> {
    if (!query || query.length < 1) return [];

    const response = await fetch(
        `${API_BASE_URL}/modules/search/semester?q=${encodeURIComponent(query)}&acad_year=${acadYear}&semester=${semester}&limit=${limit}`
    );
    if (!response.ok) {
        throw new Error('Failed to search modules by semester');
    }
    return response.json();
}

export interface ModuleOfferedResult {
    module_code: string;
    offered: boolean;
    semester: number;
}

export async function checkModuleOffered(
    moduleCode: string,
    semester: 1 | 2 | 3 | 4 = 1
): Promise<ModuleOfferedResult> {
    const response = await fetch(
        `${API_BASE_URL}/modules/${moduleCode}/offered?semester=${semester}`
    );
    if (!response.ok) {
        throw new Error('Failed to check module offering');
    }
    return response.json();
}

export interface PrereqCheckResult {
    satisfied: boolean;
    missing: string[];
    prerequisite_tree: any;
    prerequisite_text?: string;
}

export async function checkPrerequisites(
    moduleCode: string,
    completedModules: string[]
): Promise<PrereqCheckResult> {
    const response = await fetch(`${API_BASE_URL}/modules/check-prereqs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            module_code: moduleCode,
            completed_modules: completedModules
        })
    });
    if (!response.ok) {
        throw new Error('Failed to check prerequisites');
    }
    return response.json();
}

export interface ModuleReview {
    comment: string;
    rating: number | null;
    academic_year: string | null;
    timestamp: string | null;
}

export interface ModuleDetails {
    module_code: string;
    title: string;
    description: string | null;
    module_credit: number;
    department: string | null;
    faculty: string | null;
    workload: number[] | null;
    workload_description: string;
    prerequisite_rule: string | null;
    prerequisite_tree: object | null;
    preclusion: string | null;
    corequisite: string | null;
    offered_semesters: string[];
    exam_info: object;
    reviews: ModuleReview[];
}

export async function getModuleDetails(moduleCode: string): Promise<ModuleDetails> {
    const response = await fetch(`${API_BASE_URL}/modules/${moduleCode}`);
    if (!response.ok) {
        throw new Error('Failed to fetch module details');
    }
    return response.json();
}
