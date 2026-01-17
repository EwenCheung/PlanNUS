export interface Module {
  code: string;
  title: string;
  units?: number;
  hasError?: boolean;
  errorMessage?: string;
  fluff?: boolean;
}

export interface Semester {
  id: number;
  name: string;
  units: number;
  modules: Module[];
  isExchange?: boolean;
  dropZone?: boolean;
  dragOver?: boolean;
}

export interface AcademicYear {
  year: number;
  label: string;
  academicYear: string;
  totalUnits: number;
  semesters: Semester[];
}

export interface PlanSettings {
  admissionYear: string;
  faculty: string;
  major: string;
  specialisation: string;
  secondMajor: boolean;
  minors: string[];
  exchange: boolean;
}