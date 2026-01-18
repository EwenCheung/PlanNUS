import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AcademicYear, Module, Semester } from '../types';
import { fetchDummyPlan, fetchUserPlan, searchModulesBySemester, searchModules, checkModuleOffered, checkPrerequisites, ModuleSearchResult, GeneratePlanResponse } from '../api';
import CourseDetailsModal from './CourseDetailsModal';

interface StagedModule {
  id: string;
  code: string;
  type: 'taken' | 'exempted';
  mcs: number;
}


// Mock Requirements Data
const REQUIREMENTS = [
  {
    category: "Common Curriculum",
    requiredUnits: 40,
    courses: [
      { code: "CS1101S", title: "Digital Literacy" },
      { code: "ES2660", title: "Critique and Expression" },
      { code: "GEC%", title: "Cultures and Connections" },
      { code: "GEA1000", title: "Data Literacy" },
      { code: "GES%", title: "Singapore Studies" },
      { code: "GEN%", title: "Communities and Engagement" },
    ]
  },
  {
    category: "Computer Science Foundation",
    requiredUnits: 36,
    courses: [
      { code: "CS1231S", title: "Discrete Structures" },
      { code: "CS2030S", title: "Programming Methodology II" },
      { code: "CS2040S", title: "Data Structures & Algos" },
      { code: "CS2100", title: "Computer Organisation" },
      { code: "CS2106", title: "Operating Systems" },
      { code: "CS3230", title: "Design & Analysis of Algorithms" },
    ]
  },
  {
    category: "CS Breadth & Depth",
    requiredUnits: 32,
    courses: [
      // Focus Area (12 units minimum)
      { code: "Focus 4K", title: "Focus Area 4000-level (required)" },
      { code: "Focus 2", title: "Focus Area Course 2" },
      { code: "Focus 3", title: "Focus Area Course 3" },
      // 4K Electives (12 units = 3 courses)
      { code: "CS4%", title: "4K Elective 1" },
      { code: "CS4%", title: "4K Elective 2" },
      { code: "CS4%", title: "4K Elective 3" },
      // Industry Experience (self-check)
      { code: "IE/FYP", title: "Industry Exp. or FYP (self-check)" },
      { code: "Project", title: "Team Project / Elective" },
    ]
  },
  {
    category: "Math & Sciences",
    requiredUnits: 12,
    courses: [
      { code: "MA1521", title: "Calculus for Computing" },
      { code: "MA1522", title: "Linear Algebra" },
      { code: "ST2334", title: "Probability & Statistics" },
    ]
  },
  {
    category: "Unrestricted Electives",
    requiredUnits: 40,
    courses: [
      { code: "UE 1", title: "General Elective" },
      { code: "UE 2", title: "General Elective" },
      { code: "UE 3", title: "General Elective" },
      { code: "UE 4", title: "General Elective" },
      { code: "UE 5", title: "General Elective" },
      { code: "UE 6", title: "General Elective" },
      { code: "UE 7", title: "General Elective" },
      { code: "UE 8", title: "General Elective" },
      { code: "UE 9", title: "General Elective" },
      { code: "UE 10", title: "General Elective" },
    ]
  }
];

const DEFAULT_PLAN: AcademicYear[] = Array.from({ length: 4 }, (_, i) => ({
  year: i + 1,
  label: `Year ${i + 1} `,
  academicYear: `202${5 + i}/202${6 + i}`,
  totalUnits: 0,
  semesters: [
    { id: i * 2 + 1, name: "Semester 1", units: 0, modules: [] },
    { id: i * 2 + 2, name: "Semester 2", units: 0, modules: [] }
  ]
}));

interface MainBoardProps {
  refreshTrigger?: number;
  saveTrigger?: number;
  exportTrigger?: number;
  onSaveSuccess?: () => void;
  userId?: string;
  startAcademicYear?: string;
  generatedPlan?: GeneratePlanResponse | null;
  currentSemester?: string;
  onPlanChange?: (plan: { academicYears: AcademicYear[], stagedModules: any[] }) => void;
}

const MainBoard: React.FC<MainBoardProps> = ({ refreshTrigger = 0, saveTrigger = 0, exportTrigger = 0, onSaveSuccess, userId, startAcademicYear = '2024/2025', generatedPlan, currentSemester = 'Y1S1', onPlanChange }) => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(DEFAULT_PLAN);
  const [loading, setLoading] = useState(false);

  // Helper to parse academic year from both formats: "AY24/25" or "2024/2025"
  const parseAcademicYear = (ayString: string): number => {
    // Handle "AY24/25" format
    if (ayString.startsWith('AY')) {
      const yearPart = ayString.substring(2).split('/')[0];
      const year = parseInt(yearPart);
      // Convert 2-digit year to 4-digit (assuming 2000s)
      return isNaN(year) ? 2024 : (year < 100 ? 2000 + year : year);
    }
    // Handle "2024/2025" format
    const year = parseInt(ayString.split('/')[0]);
    return isNaN(year) ? 2024 : year;
  };

  // Parse currentSemester (e.g., "Y2S1" -> year 2, sem 1)
  const { currentYearNum, currentSemNum } = useMemo(() => {
    // Handle Incoming Freshman case (Y0S0) - all semesters are future
    if (currentSemester === 'Y0S0') {
      return { currentYearNum: 0, currentSemNum: 0 };
    }
    // Parse format like "Y2S1" or "Y3S2"
    const match = currentSemester.match(/Y(\d)S(\d)/);
    if (match) {
      return { currentYearNum: parseInt(match[1]), currentSemNum: parseInt(match[2]) };
    }
    return { currentYearNum: 1, currentSemNum: 1 }; // Default to Y1S1
  }, [currentSemester]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      setLoading(true);
      fetchDummyPlan()
        .then(data => {
          setAcademicYears(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [refreshTrigger]);

  // Update academic year labels when startAcademicYear changes
  useEffect(() => {
    const startYear = parseAcademicYear(startAcademicYear);
    setAcademicYears(prev => prev.map((year, idx) => ({
      ...year,
      academicYear: `${startYear + idx}/${startYear + idx + 1}`
    })));
  }, [startAcademicYear]);

  // Load user's saved plan on initial mount
  useEffect(() => {
    if (userId) {
      setLoading(true);
      fetchUserPlan(userId)
        .then(response => {
          if (response.exists && response.plan) {
            setAcademicYears(response.plan.academicYears);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Error loading user plan:', err);
          setLoading(false);
        });
    }
  }, [userId]);

  // Process generated plan when it changes
  useEffect(() => {
    if (generatedPlan && generatedPlan.success && generatedPlan.plan) {
      const plan = generatedPlan.plan;
      const startYear = parseAcademicYear(startAcademicYear);

      // Convert generated plan format to academicYears format
      const newAcademicYears: AcademicYear[] = [1, 2, 3, 4].map((yearNum) => {
        const sem1Key = `y${yearNum}s1`;
        const sem2Key = `y${yearNum}s2`;

        const sem1Codes = plan.plan[sem1Key] || [];
        const sem2Codes = plan.plan[sem2Key] || [];

        const convertModules = (codes: string[]): Module[] => {
          return codes.map((code) => {
            const courseInfo = plan.courses[code];
            return {
              code: code,
              title: courseInfo?.title || code,
              units: courseInfo?.credit || 4,
              fluff: courseInfo?.fluff
            };
          });
        };

        const sem1Modules = convertModules(sem1Codes);
        const sem2Modules = convertModules(sem2Codes);

        const sem1Units = sem1Modules.reduce((sum, m) => sum + (m.units || 4), 0);
        const sem2Units = sem2Modules.reduce((sum, m) => sum + (m.units || 4), 0);

        return {
          year: yearNum,
          label: `Year ${yearNum}`,
          academicYear: `${startYear + yearNum - 1}/${startYear + yearNum}`,
          totalUnits: sem1Units + sem2Units,
          semesters: [
            {
              id: yearNum * 10 + 1,
              name: 'Semester 1',
              units: sem1Units,
              modules: sem1Modules,
              isExchange: sem1Key === plan.sep_semester
            },
            {
              id: yearNum * 10 + 2,
              name: 'Semester 2',
              units: sem2Units,
              modules: sem2Modules,
              isExchange: sem2Key === plan.sep_semester
            }
          ]
        };
      });

      setAcademicYears(newAcademicYears);

      // Process exempted modules
      if (plan.exempted && Array.isArray(plan.exempted)) {
        const newStaged: StagedModule[] = plan.exempted.map(code => {
          const courseInfo = plan.courses[code];
          return {
            id: code, // use code as id for simplicity
            code: code,
            type: 'exempted',
            mcs: courseInfo?.credit || 4
          };
        });
        setStagedModules(newStaged);
      }

      showToast('Study plan generated successfully!', 'success');
    }
  }, [generatedPlan, startAcademicYear]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOverSemId, setDragOverSemId] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null); // Track position within semester
  const [addingModuleSemId, setAddingModuleSemId] = useState<number | null>(null);

  // Drag to scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingScroll, setIsDraggingScroll] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // Bottom panel state
  const [isBottomOpen, setIsBottomOpen] = useState(true);
  const [isBottomExpanded, setIsBottomExpanded] = useState(false);
  const [bottomHeight, setBottomHeight] = useState(160); // Default h-40 = 160px

  // Resize handler for bottom panel
  const handleBottomResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const newHeight = Math.min(Math.max(startHeight + delta, 100), 400); // Min 100px, Max 400px
      setBottomHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Progression Panel State
  const [isProgressionExpanded, setIsProgressionExpanded] = useState(false);
  const [isProgressionOpen, setIsProgressionOpen] = useState(true);
  const [progressionHeight, setProgressionHeight] = useState(280); // Default expanded height

  // Resize handler for progression panel
  const handleProgressionResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = progressionHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      const newHeight = Math.min(Math.max(startHeight + delta, 150), 450); // Min 150px, Max 450px
      setProgressionHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Staging Area State - Exempted courses only
  const [stagedModules, setStagedModules] = useState<StagedModule[]>([
    { id: '2', code: 'MA1301', type: 'exempted', mcs: 4 }
  ]);

  // Modal State - now used for exempted course search
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newModuleCode, setNewModuleCode] = useState('');
  const [newModuleType, setNewModuleType] = useState<'taken' | 'exempted'>('exempted'); // Default to exempted

  // Module Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ModuleSearchResult[]>([]);
  const [searchSemester, setSearchSemester] = useState<{ acadYear: string; semester: 1 | 2 | 3 | 4 } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Exempted course search state
  const [exemptedSearchQuery, setExemptedSearchQuery] = useState('');
  const [exemptedSearchResults, setExemptedSearchResults] = useState<ModuleSearchResult[]>([]);
  const [isExemptedSearching, setIsExemptedSearching] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [shakingSemId, setShakingSemId] = useState<number | null>(null);

  // Course Details Modal State
  const [selectedModuleCode, setSelectedModuleCode] = useState<string | null>(null);

  // Special Term Menu State
  const [specialTermMenuYear, setSpecialTermMenuYear] = useState<number | null>(null);

  // Add special term to a year
  const addSpecialTerm = (yearNum: number, termType: 'Special Term 1' | 'Special Term 2') => {
    setAcademicYears(prev => prev.map(year => {
      if (year.year === yearNum) {
        // Check if this special term already exists
        const termExists = year.semesters.some(s => s.name === termType);
        if (termExists) {
          showToast(`${termType} already exists in Year ${yearNum}`, 'error');
          return year;
        }
        // Add the new special term
        const newSemId = yearNum * 100 + (termType === 'Special Term 1' ? 3 : 4);
        return {
          ...year,
          semesters: [...year.semesters, {
            id: newSemId,
            name: termType,
            units: 0,
            modules: []
          }]
        };
      }
      return year;
    }));
    setSpecialTermMenuYear(null);
  };

  // Delete special term from a year
  const deleteSpecialTerm = (yearNum: number, semId: number) => {
    setAcademicYears(prev => prev.map(year => {
      if (year.year === yearNum) {
        return {
          ...year,
          semesters: year.semesters.filter(s => s.id !== semId)
        };
      }
      return year;
    }));
    showToast('Special term removed', 'success');
  };

  // Show toast notification
  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Calculations
  const allTakenModules = useMemo(() => {
    // Only count modules as "taken" if they are in a PAST semester
    // Current semester modules are "in progress" (Blue)
    // Future semester modules are "planned" (Yellow)
    const currentSemId = currentYearNum * 10 + currentSemNum;

    const planMods = academicYears.flatMap(y =>
      y.semesters.flatMap(s => {
        const sId = y.year * 10 + (s.name.includes('1') ? 1 : 2);
        if (sId < currentSemId) {
          return s.modules.map(m => m.code);
        }
        return [];
      })
    );
    const stagedMods = stagedModules.map(m => m.code);
    return new Set<string>([...planMods, ...stagedMods]);
  }, [academicYears, stagedModules, currentYearNum, currentSemNum]);

  // Track modules with prerequisite and offering violations
  const [prereqViolations, setPrereqViolations] = useState<Map<string, string[]>>(new Map());
  const [offeringViolations, setOfferingViolations] = useState<Map<string, string>>(new Map());

  // Check constraints (prereqs & offerings) for all modules whenever plan changes
  useEffect(() => {
    const checkAllConstraints = async () => {
      const pViolations = new Map<string, string[]>();
      const oViolations = new Map<string, string>();

      for (let yearIdx = 0; yearIdx < academicYears.length; yearIdx++) {
        const year = academicYears[yearIdx];
        for (let semIdx = 0; semIdx < year.semesters.length; semIdx++) {
          const sem = year.semesters[semIdx];
          const semOrder = year.year * 10 + (sem.name.includes('1') ? 1 : 2);
          const semNum = sem.name.includes('1') ? 1 : 2;

          // Get all modules from EARLIER semesters
          const completedBefore: string[] = [];
          for (const y of academicYears) {
            for (const s of y.semesters) {
              const sOrder = y.year * 10 + (s.name.includes('1') ? 1 : 2);
              if (sOrder < semOrder) {
                completedBefore.push(...s.modules.map(m => m.code));
              }
            }
          }
          // Also add staged modules as "completed"
          completedBefore.push(...stagedModules.map(m => m.code));

          // Check each module in this semester
          await Promise.all(sem.modules.map(async (mod) => {
            // Skip checks for "Fluff" modules or explicitly marked ignored modules
            if (mod.fluff) return;

            // 1. Check Prereqs
            try {
              const result = await checkPrerequisites(mod.code, completedBefore);
              if (!result.satisfied && result.missing.length > 0) {
                pViolations.set(mod.code, result.missing);
              }
            } catch (e) { /* Ignore */ }

            // 2. Check Offering
            try {
              const offering = await checkModuleOffered(mod.code, semNum as 1 | 2);
              if (!offering.offered) {
                oViolations.set(mod.code, `Not offered in Semester ${semNum}`);
              }
            } catch (e) { /* Ignore */ }
          }));
        }
      }

      setPrereqViolations(pViolations);
      setOfferingViolations(oViolations);
    };

    // Debounce the check to avoid too many API calls
    const timer = setTimeout(checkAllConstraints, 800);
    return () => clearTimeout(timer);
  }, [academicYears, stagedModules]);

  const progressionStats = useMemo(() => {
    let completed = 0;
    let current = 0;
    let planned = 0;
    const allCodes = new Set<string>();

    const currentSemId = currentYearNum * 10 + currentSemNum;

    // 1. Process Exempted (Always Completed)
    stagedModules.forEach(mod => {
      if (mod.type === 'exempted' && !allCodes.has(mod.code)) {
        completed += (mod.mcs || 4);
        allCodes.add(mod.code);
      }
    });

    // 2. Process Academic Years
    academicYears.forEach(year => {
      year.semesters.forEach(sem => {
        const semId = year.year * 10 + (sem.name.includes('1') ? 1 : 2);

        sem.modules.forEach(mod => {
          if (!allCodes.has(mod.code)) {
            const mcs = mod.units || 4;
            if (semId < currentSemId) {
              completed += mcs;
            } else if (semId === currentSemId) {
              current += mcs;
            } else {
              planned += mcs;
            }
            allCodes.add(mod.code);
          }
        });
      });
    });

    return { completed, current, planned, total: completed + current + planned };
  }, [academicYears, stagedModules, currentYearNum, currentSemNum]);

  // Notify parent of plan changes for AI context
  useEffect(() => {
    onPlanChange?.({ academicYears, stagedModules });
  }, [academicYears, stagedModules, onPlanChange]);

  const GRADUATION_MCS = 160;

  // Helper to check requirement fulfillment, covering UEs
  const checkRequirement = (reqCode: string) => {
    // Helper to get base code (ignore suffix like 'S', 'T', 'E')
    const getBaseCode = (code: string) => {
      const match = code.match(/^([A-Z]{2,4}\d{4})/);
      return match ? match[1] : code;
    };
    const reqBase = getBaseCode(reqCode);

    // 1. Direct Match (Fuzzy)
    // Check against all taken modules
    const isSatisfied = Array.from(allTakenModules).some(takenCode => {
      if (typeof takenCode !== 'string') return false;
      return getBaseCode(takenCode) === reqBase;
    });
    if (isSatisfied) return true;

    // 2. Wildcard Match
    if (reqCode.endsWith('%')) {
      const prefix = reqCode.slice(0, -1);
      return Array.from(allTakenModules).some((code: string) =>
        typeof code === 'string' && code.startsWith(prefix)
      );
    }

    // 3. Unrestricted Elective Overflow Logic
    if (reqCode.startsWith('UE')) {
      // Collect all modules consumed by other requirements
      const consumed = new Set<string>();

      // Iterate all NON-UE requirements to find what is used
      REQUIREMENTS.forEach(cat => {
        if (cat.category === "Unrestricted Electives") return;
        cat.courses.forEach(c => {
          const cBase = getBaseCode(c.code);
          Array.from(allTakenModules).forEach((myCode: unknown) => {
            if (typeof myCode !== 'string') return;

            // Check if myCode satisfies c.code (Fuzzy)
            if (getBaseCode(myCode) === cBase) {
              consumed.add(myCode);
            }
            else if (c.code.endsWith('%') && myCode.startsWith(c.code.slice(0, -1))) {
              consumed.add(myCode);
            }
          });
        });
      });

      // Find Unconsumed Modules
      const unconsumed = Array.from(allTakenModules).filter((c: unknown) => typeof c === 'string' && !consumed.has(c));

      const ueIndex = parseInt(reqCode.split(' ')[1]) - 1;
      return ueIndex < unconsumed.length;
    }

    return false;
  };

  // Drag and Drop State
  const [draggingModule, setDraggingModule] = useState<{ code: string; source: 'staged' | 'semester'; sourceId?: number } | null>(null);

  const handleDragStart = (e: React.DragEvent, moduleCode: string, source: 'staged' | 'semester', sourceId?: number) => {
    setIsDragging(true);
    setDraggingModule({ code: moduleCode, source, sourceId });
    e.dataTransfer.setData('text/plain', moduleCode);
    e.dataTransfer.effectAllowed = 'move';

    // Create a translucent drag image
    const dragElement = e.currentTarget as HTMLElement;
    const clone = dragElement.cloneNode(true) as HTMLElement;
    clone.style.opacity = '0.7';
    clone.style.position = 'absolute';
    clone.style.top = '-1000px';
    clone.style.transform = 'rotate(3deg)';
    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, 50, 30);
    setTimeout(() => document.body.removeChild(clone), 0);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverSemId(null);
    setDragOverIndex(null);
    setDraggingModule(null);
  };

  const handleDragEnter = (semId: number) => {
    if (isDragging) {
      setDragOverSemId(semId);
    }
  };

  const handleDragOverModule = (e: React.DragEvent, semId: number, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    // Determine if we should insert before or after this module
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const insertIndex = e.clientY < midpoint ? index : index + 1;

    setDragOverSemId(semId);
    setDragOverIndex(insertIndex);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetSemId: number, insertAtIndex?: number) => {
    e.preventDefault();

    if (!draggingModule) return;

    const { code, source, sourceId } = draggingModule;

    // Handle reordering within the same semester
    if (source === 'semester' && sourceId === targetSemId) {
      if (insertAtIndex !== undefined) {
        setAcademicYears(prev => prev.map(year => ({
          ...year,
          semesters: year.semesters.map(sem => {
            if (sem.id === targetSemId) {
              const modules = [...sem.modules];
              const currentIndex = modules.findIndex(m => m.code === code);
              if (currentIndex !== -1 && currentIndex !== insertAtIndex) {
                const [movedModule] = modules.splice(currentIndex, 1);
                // Adjust index if we removed an item before the insert position
                const adjustedIndex = currentIndex < insertAtIndex ? insertAtIndex - 1 : insertAtIndex;
                modules.splice(adjustedIndex, 0, movedModule);
                return { ...sem, modules };
              }
            }
            return sem;
          })
        })));
      }
      setIsDragging(false);
      setDragOverSemId(null);
      setDragOverIndex(null);
      setDraggingModule(null);
      return;
    }

    // Find target semester info
    let targetYear: AcademicYear | undefined;
    let targetSem: Semester | undefined;
    for (const year of academicYears) {
      for (const sem of year.semesters) {
        if (sem.id === targetSemId) {
          targetYear = year;
          targetSem = sem;
          break;
        }
      }
    }

    if (targetYear && targetSem) {
      // Determine semester number (1 or 2 based on name)
      const semNum = targetSem.name.includes('1') ? 1 : 2;

      // Check if module already exists ANYWHERE in the plan (except source semester if moving)
      const moduleExistsInPlan = academicYears.some(year =>
        year.semesters.some(sem => {
          // If moving from another semester, exclude the source
          if (source === 'semester' && sem.id === sourceId) return false;
          return sem.modules.some(m => m.code === code);
        })
      );

      if (moduleExistsInPlan) {
        setShakingSemId(targetSemId);
        setTimeout(() => setShakingSemId(null), 500);
        showToast(`${code} already exists in your study plan`, 'error');
        setIsDragging(false);
        setDragOverSemId(null);
        setDragOverIndex(null);
        setDraggingModule(null);
        return;
      }

      // OPTIMISTIC UPDATE: removed blocking checks for offering/prereqs
      // Validation will happen in background via useEffect
    }

    // Add module to target semester at specified index
    setAcademicYears(prev => prev.map(year => ({
      ...year,
      semesters: year.semesters.map(sem => {
        // Remove from source semester if it was from a semester
        if (source === 'semester' && sem.id === sourceId) {
          return {
            ...sem,
            modules: sem.modules.filter(m => m.code !== code),
            units: sem.units - 4
          };
        }
        // Add to target semester
        if (sem.id === targetSemId) {
          // Check if already exists
          if (sem.modules.some(m => m.code === code)) return sem;
          const newModule = { code, title: code, units: 4 };
          const modules = [...sem.modules];
          if (insertAtIndex !== undefined && insertAtIndex >= 0) {
            modules.splice(insertAtIndex, 0, newModule);
          } else {
            modules.push(newModule);
          }
          return {
            ...sem,
            modules,
            units: sem.units + 4
          };
        }
        return sem;
      })
    })));

    // If dragged from staged, remove from staged modules
    if (source === 'staged') {
      setStagedModules(prev => prev.filter(m => m.code !== code));
    }

    setIsDragging(false);
    setDragOverSemId(null);
    setDragOverIndex(null);
    setDraggingModule(null);
  };

  // Scroll Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[draggable="true"], button, input, .no-drag')) return;
    setIsDraggingScroll(true);
    if (scrollContainerRef.current) {
      setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
      setStartY(e.pageY - scrollContainerRef.current.offsetTop);
      setScrollLeft(scrollContainerRef.current.scrollLeft);
      setScrollTop(scrollContainerRef.current.scrollTop);
    }
  };

  const handleMouseLeave = () => {
    setIsDraggingScroll(false);
  };

  const handleMouseUp = () => {
    setIsDraggingScroll(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingScroll || !scrollContainerRef.current) return;
    e.preventDefault();

    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walkX = (x - startX) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft - walkX;

    const y = e.pageY - scrollContainerRef.current.offsetTop;
    const walkY = (y - startY) * 1.5;
    scrollContainerRef.current.scrollTop = scrollTop - walkY;
  };

  // Refs for Auto-Save (to access state in event listeners)
  const academicYearsRef = useRef(academicYears);
  const stagedModulesRef = useRef(stagedModules);
  const userIdRef = useRef(userId);

  // Update refs whenever state changes
  useEffect(() => {
    academicYearsRef.current = academicYears;
    stagedModulesRef.current = stagedModules;
  }, [academicYears, stagedModules]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const handleAddModule = () => {
    if (newModuleCode.trim()) {
      setStagedModules([
        ...stagedModules,
        {
          id: Date.now().toString(),
          code: newModuleCode.toUpperCase(),
          type: newModuleType,
          mcs: 4
        }
      ]);
      setNewModuleCode('');
      setNewModuleType('taken');
      setIsModalOpen(false);
    }
  };

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<StagedModule | null>(null);

  // Parse academic year string (e.g. "Year 1") to actual AY string (e.g. "2024/2025")
  // Assuming Start Year is 2024 for this prototype
  const getAYString = (yearLabel: string) => {
    const startYear = 2024;
    const yearIndex = parseInt(yearLabel.replace('Year ', '')) - 1;
    return `${startYear + yearIndex}/${startYear + yearIndex + 1}`;
  };

  const generateSavePayload = (years: AcademicYear[], staged: StagedModule[]) => {
    const modulesMap: Record<string, any> = {};
    let idCounter = 1;

    // 1. Process Planned Modules
    years.forEach(year => {
      const ayString = getAYString(year.label);
      year.semesters.forEach(sem => {
        const semNum = sem.name.includes('1') ? 1 : 2;
        sem.modules.forEach((mod, index) => {
          modulesMap[idCounter.toString()] = {
            id: idCounter.toString(),
            year: ayString,
            semester: semNum,
            index: index,
            moduleCode: mod.code
          };
          idCounter++;
        });
      });
    });

    // 2. Process Staged Modules
    staged.forEach((mod, index) => {
      modulesMap[idCounter.toString()] = {
        id: idCounter.toString(),
        year: "-1",
        semester: -1,
        index: index,
        moduleCode: mod.code
      };
      idCounter++;
    });

    // Generate export data
    const exportData = {
      minYear: "2024/2025",
      maxYear: "2028/2029",
      iblocs: false,
      ignorePrereqCheck: true,
      modules: modulesMap,
      custom: {} // Placeholder for custom modules
    };

    return exportData;
  };

  const handleSavePlan = (isAutoSave: boolean = false) => {
    const exportData = generateSavePayload(academicYearsRef.current, stagedModulesRef.current);
    const uid = userId || userIdRef.current;

    console.log("Saving Plan:", exportData, "AutoSave:", isAutoSave);

    // Call backend API to save
    import('../api').then(({ savePlan }) => {
      savePlan(exportData, "My Study Plan", uid, isAutoSave) // pass isAutoSave as keepalive
        .then(response => {
          if (response.success) {
            if (!isAutoSave) {
              showToast('Plan saved successfully!', 'success');
              onSaveSuccess?.();
            }
            console.log('Plan saved:', response.plan_id);
          } else {
            console.error('Failed to save:', response.message);
            if (!isAutoSave) showToast(`Failed to save: ${response.message}`, 'error');
          }
        })
        .catch(err => {
          console.error("Save error:", err);
          if (!isAutoSave) showToast(`Error saving plan: ${err.message}`, 'error');
        });
    });
  };

  // Auto-save on page unload (reload/close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (userIdRef.current) {
        handleSavePlan(true);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (saveTrigger > 0) {
      handleSavePlan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [saveTrigger]);

  // Handle export - save first then download JSON
  const handleExportPlan = () => {
    // Build NUSMods-compatible export format
    const startYear = parseInt(startAcademicYear.split('/')[0]);
    const modules: Record<string, any> = {};
    let moduleId = 1;

    academicYears.forEach((year, yearIdx) => {
      year.semesters.forEach((sem) => {
        let semNum = 1;
        if (sem.name === 'Semester 2') semNum = 2;
        else if (sem.name === 'Special Term 1') semNum = 3;
        else if (sem.name === 'Special Term 2') semNum = 4;

        sem.modules.forEach((mod, modIdx) => {
          modules[String(moduleId)] = {
            id: String(moduleId),
            year: `${startYear + yearIdx}/${startYear + yearIdx + 1}`,
            semester: semNum,
            index: modIdx,
            moduleCode: mod.code
          };
          moduleId++;
        });
      });
    });

    // Add exempted modules with year -1
    stagedModules.forEach((mod, idx) => {
      modules[String(moduleId)] = {
        id: String(moduleId),
        year: "-1",
        semester: -1,
        index: idx,
        moduleCode: mod.code
      };
      moduleId++;
    });

    const exportData = {
      minYear: startAcademicYear,
      maxYear: `${startYear + 3}/${startYear + 4}`,
      iblocs: false,
      ignorePrereqCheck: true,
      modules,
      custom: {}
    };

    // Download as JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nusplanner_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Plan exported successfully!', 'success');
  };

  useEffect(() => {
    if (exportTrigger > 0) {
      // First save, then export
      handleSavePlan();
      setTimeout(() => handleExportPlan(), 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [exportTrigger]);

  const handleEditModule = (id: string) => {
    const mod = stagedModules.find(m => m.id === id);
    if (mod) {
      setEditingModule(mod);
      setNewModuleCode(mod.code);
      setNewModuleType(mod.type as 'taken' | 'exempted');
      setIsEditModalOpen(true);
    }
  };

  const saveEditedModule = () => {
    if (editingModule && newModuleCode.trim()) {
      setStagedModules(prev => prev.map(m =>
        m.id === editingModule.id
          ? { ...m, code: newModuleCode.toUpperCase(), type: newModuleType }
          : m
      ));
      setIsEditModalOpen(false);
      setEditingModule(null);
      setNewModuleCode('');
    }
  };

  const totalStagedMCs = stagedModules.reduce((acc, mod) => acc + mod.mcs, 0);

  return (
    <main className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">

      {/* Progression Dashboard */}
      <div
        style={{ height: !isProgressionOpen ? 44 : (isProgressionExpanded ? progressionHeight : 'auto') }}
        className="bg-white border-b border-slate-200 shadow-sm shrink-0 z-10 flex flex-col transition-all duration-100 ease-out"
      >
        {/* Summary Bar */}
        <div className="px-6 py-2 flex items-center gap-8 justify-between shrink-0">
          {!isProgressionOpen ? (
            <button
              onClick={() => setIsProgressionOpen(true)}
              className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">expand_more</span>
              <span className="text-sm font-bold">Graduation Progress</span>
            </button>
          ) : (
            <>
              <div className="flex items-center gap-6 flex-1">
                <div className="flex items-center gap-2 min-w-[140px]">
                  <span className="material-symbols-outlined text-green-600">school</span>
                  <span className="text-sm font-bold text-slate-700">Graduation Progress</span>
                </div>

                <div className="flex-1 max-w-2xl">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-xs font-bold text-slate-500">
                      {progressionStats.total} <span className="text-slate-400 font-normal">/ {GRADUATION_MCS} MCs</span>
                    </span>
                    <div className="flex gap-3 text-[10px] font-bold">
                      <span className="text-green-600 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div>Completed</span>
                      <span className="text-blue-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Current</span>
                      <span className="text-amber-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div>Planned</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    {/* Completed (Green) */}
                    <div
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (progressionStats.completed / GRADUATION_MCS) * 100)}%` }}
                    ></div>
                    {/* Current (Blue) */}
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (progressionStats.current / GRADUATION_MCS) * 100)}%` }}
                    ></div>
                    {/* Planned (Yellow) */}
                    <div
                      className="h-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, (progressionStats.planned / GRADUATION_MCS) * 100)}%` }}
                    ></div>
                    {/* Remaining (Red - Implicitly remaining space, but we can color it light red if we want full bar filled) */}
                    <div className="flex-1 bg-red-100"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsProgressionExpanded(!isProgressionExpanded)}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <span>{isProgressionExpanded ? 'Hide Details' : 'View Requirements'}</span>
                  <span className={`material-symbols-outlined text-[18px] transition-transform ${isProgressionExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                <button
                  onClick={() => setIsProgressionOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors"
                  title="Collapse panel"
                >
                  <span className="material-symbols-outlined text-[18px]">expand_less</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Detailed Checklist (Scrollable Row) */}
        {isProgressionExpanded && isProgressionOpen && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-8 pb-2 pt-2 border-t border-slate-50 animate-in slide-in-from-top-2 fade-in duration-200 flex-1 overflow-hidden">
              <div className="flex gap-6 overflow-x-auto h-full custom-scrollbar snap-x">
                {REQUIREMENTS.map((category, idx) => {
                  const fulfilledCount = category.courses.filter(c => checkRequirement(c.code)).length;
                  const isBreadthDepth = category.category.includes('Breadth');

                  return (
                    <div key={idx} className="space-y-3 min-w-[280px] max-w-[280px] snap-start">
                      <div className="flex items-center justify-between sticky top-0 bg-white z-10">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide truncate" title={category.category}>{category.category}</h4>
                          {isBreadthDepth && (
                            <div className="relative group">
                              <button className="text-slate-400 hover:text-primary">
                                <span className="material-symbols-outlined text-[14px]">info</span>
                              </button>
                              <div className="absolute left-0 top-full mt-2 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-lg z-50 w-72 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                <p className="font-bold mb-2">CS Degree Notes:</p>
                                <ul className="space-y-1.5 list-disc pl-3 text-[11px]">
                                  <li>Industry Experience & FYP not tracked here (self-check)</li>
                                  <li>6-12 units of Industry Experience required</li>
                                  <li>GPA &gt; 4.0 can use <strong>CP4101</strong> to replace Industry Exp.</li>
                                  <li>GPA &gt; 4.5 for Highest Distinction must take <strong>CP4101</strong></li>
                                  <li>At most 12 units of CP modules</li>
                                  <li>Focus Area: 12 units, one 4K, 2 from list</li>
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{fulfilledCount}/{category.courses.length}</span>
                      </div>
                      <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                        {category.courses.map((course) => {
                          const isDone = checkRequirement(course.code);

                          // Helper for fuzzy matching in plan
                          const getBaseCode = (c: string) => {
                            const match = c.match(/^([A-Z]{2,4}\d{4})/);
                            return match ? match[1] : c;
                          };
                          const courseBase = getBaseCode(course.code);

                          const currentSemId = currentYearNum * 10 + currentSemNum;

                          // Helper to strictly check if module is in a specific semester
                          const semContainsCourse = (sem: any) => {
                            return sem.modules.some((m: any) => {
                              const mBase = getBaseCode(m.code);
                              return mBase === courseBase || (course.code.endsWith('%') && m.code.startsWith(course.code.slice(0, -1)));
                            });
                          };

                          // Check if course is in strict future semesters (semID > currentSemId)
                          const isInFuturePlan = !isDone && academicYears.some(year =>
                            year.semesters.some(sem => {
                              const semId = year.year * 10 + (sem.name.includes('1') ? 1 : 2);
                              return semId > currentSemId && semContainsCourse(sem);
                            })
                          );
                          // Check if course is in strictly current semester
                          const isInCurrentYear = !isDone && academicYears.some(year =>
                            year.semesters.some(sem => {
                              const semId = year.year * 10 + (sem.name.includes('1') ? 1 : 2);
                              return semId === currentSemId && semContainsCourse(sem);
                            })
                          );

                          const bgClass = isDone
                            ? 'bg-green-50/50 border-green-100'
                            : isInCurrentYear
                              ? 'bg-blue-50/50 border-blue-100'
                              : isInFuturePlan
                                ? 'bg-amber-50/50 border-amber-100'
                                : 'bg-white border-slate-100';

                          const iconClass = isDone
                            ? 'bg-green-500 text-white'
                            : isInCurrentYear
                              ? 'bg-blue-500 text-white'
                              : isInFuturePlan
                                ? 'bg-amber-400 text-white'
                                : 'bg-slate-100 border border-slate-300';

                          const textClass = isDone
                            ? 'text-slate-700'
                            : isInCurrentYear
                              ? 'text-blue-700'
                              : isInFuturePlan
                                ? 'text-amber-700'
                                : 'text-slate-500';

                          return (
                            <div key={course.code} className={`flex items-start gap-2.5 p-2 rounded-lg border ${bgClass}`}>
                              <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}>
                                {isDone && <span className="material-symbols-outlined text-[12px]">check</span>}
                                {isInCurrentYear && !isDone && <span className="material-symbols-outlined text-[10px]">play_arrow</span>}
                                {isInFuturePlan && <span className="material-symbols-outlined text-[10px]">event</span>}
                              </div>
                              <div className="min-w-0">
                                <div className={`text-xs font-bold ${textClass}`}>{course.code}</div>
                                <div className="text-[10px] text-slate-400 truncate" title={course.title}>{course.title}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Resize Handle */}
            <div
              onMouseDown={handleProgressionResize}
              className="h-3 w-full bg-slate-100 hover:bg-primary/10 cursor-ns-resize flex items-center justify-center transition-colors group shrink-0 border-t border-slate-200"
              title="Drag to resize"
            >
              <div className="h-1 w-12 bg-slate-300 rounded-full group-hover:bg-primary transition-colors"></div>
            </div>
          </div>
        )}
      </div>

      {/* Top Part: Timeline Board */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto custom-scrollbar bg-grid-pattern cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <div className="flex h-full p-8 gap-8 min-w-max">
          {academicYears.map((year, yearIndex) => {
            const yearTotalUnits = year.semesters.reduce((acc, sem) => acc + (sem.isExchange ? 0 : sem.modules.length * 4), 0);
            const isLastYear = yearIndex === academicYears.length - 1;

            // Year header always uses neutral styling - highlighting is at semester level now

            return year.semesters.length > 0 ? (
              <div
                key={year.year}
                className={`w-80 flex flex-col h-full pointer-events-none ${!isLastYear ? 'border-r-2 border-dashed border-slate-200 pr-8' : ''}`}
              >
                {/* Year Header - neutral styling */}
                <div className="flex justify-between items-end mb-6 pb-2 shrink-0 pointer-events-auto border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-slate-800">{year.label}</h2>
                    </div>
                    <p className="text-sm font-medium mt-1 text-slate-500">{year.academicYear}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{yearTotalUnits} MCs</span>
                  </div>
                </div>

                {/* Semesters Container */}
                <div className="flex-1 space-y-8 overflow-y-visible pr-2 pb-10 pointer-events-auto no-drag">
                  {year.semesters.map((sem) => {
                    const currentSemUnits = sem.modules.length * 4;
                    const isDragTarget = isDragging && dragOverSemId === sem.id;
                    const isSearching = addingModuleSemId === sem.id;

                    // Determine semester status for highlighting
                    // Parse semester number from name (Semester 1 -> 1, Semester 2 -> 2)
                    const semNum = sem.name.includes('1') ? 1 : (sem.name.includes('2') ? 2 : 0);
                    const semOrder = year.year * 10 + semNum;
                    const currentOrder = currentYearNum * 10 + currentSemNum;

                    const isPastSemester = semOrder < currentOrder;
                    const isCurrentSemester = semOrder === currentOrder;
                    const isFutureSemester = semOrder > currentOrder;

                    // Determine semester background class
                    const semBgClass = sem.isExchange
                      ? 'bg-orange-50/70 ring-2 ring-orange-300 border-2 border-orange-200'
                      : isPastSemester
                        ? 'bg-green-50/70 ring-2 ring-green-300 border-2 border-green-200'
                        : isCurrentSemester
                          ? 'bg-blue-50/70 ring-2 ring-blue-300 border-2 border-blue-200'
                          : 'border-2 border-slate-200';

                    return (
                      <div
                        key={sem.id}
                        className={`flex flex-col gap-3 transition-colors rounded-xl p-2 -m-2 ${semBgClass} ${isDragTarget ? 'bg-blue-50/50 ring-2 ring-primary/30' : ''} ${sem.isExchange ? 'h-full max-h-[220px]' : ''} ${shakingSemId === sem.id ? 'animate-shake' : ''}`}
                        onDragEnter={() => handleDragEnter(sem.id)}
                        onDragOver={(e) => {
                          handleDragOver(e);
                          // If hovering over empty area at the end, set index to end of list
                          if (isDragging && dragOverSemId === sem.id && dragOverIndex === null) {
                            setDragOverIndex(sem.modules.length);
                          }
                        }}
                        onDrop={(e) => handleDrop(e, sem.id, dragOverIndex ?? sem.modules.length)}
                      >

                        {/* Semester Header */}
                        <div className="flex justify-between items-center px-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-base font-bold ${isDragTarget ? 'text-primary' : isPastSemester ? 'text-green-700' : isCurrentSemester ? 'text-blue-700' : (sem.isExchange ? 'text-orange-600 uppercase tracking-wider' : (sem.name.includes('Special') ? 'text-amber-600' : 'text-slate-700'))}`}>
                              {sem.isExchange ? `SEP - ${sem.name}` : sem.name}
                            </span>
                            {isPastSemester && !sem.isExchange && !sem.name.includes('Special') && (
                              <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full uppercase">Completed</span>
                            )}
                            {isCurrentSemester && !sem.isExchange && !sem.name.includes('Special') && (
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase">Current</span>
                            )}
                            {sem.isExchange && (
                              <>
                                <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full uppercase">SEP</span>
                                <span className="material-symbols-outlined text-orange-400 text-[20px]">flight_takeoff</span>
                              </>
                            )}
                            {sem.name.includes('Special') && (
                              <span className="material-symbols-outlined text-amber-400 text-[18px]">sunny</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!sem.isExchange && <span className={`text-xs font-medium ${isPastSemester ? 'text-green-500' : isCurrentSemester ? 'text-blue-500' : 'text-slate-400'}`}>{currentSemUnits} MCs</span>}
                            {sem.name.includes('Special') && (
                              <button
                                onClick={() => deleteSpecialTerm(year.year, sem.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors p-0.5 hover:bg-red-50 rounded"
                                title="Remove special term"
                              >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Modules List & Bottom Action */}
                        <div className="space-y-2 relative">

                          {/* Existing Modules with Drop Indicators */}
                          {sem.modules.filter(mod => mod.code !== 'SEP-PLACEHOLDER').map((mod, modIndex) => {
                            const hasPrereqViolation = prereqViolations.has(mod.code);
                            const missingPrereqs = prereqViolations.get(mod.code) || [];

                            const hasOfferingViolation = offeringViolations.has(mod.code);
                            const offeringError = offeringViolations.get(mod.code);

                            const hasError = mod.hasError || hasPrereqViolation || hasOfferingViolation;
                            const combinedErrorMessage = [
                              mod.errorMessage,
                              hasPrereqViolation ? `Missing prerequisites: ${missingPrereqs.join(', ')}` : '',
                              hasOfferingViolation ? offeringError : ''
                            ].filter(Boolean).join('. ');

                            const showDropIndicatorBefore = isDragTarget && dragOverIndex === modIndex && draggingModule?.code !== mod.code;
                            const showDropIndicatorAfter = isDragTarget && dragOverIndex === modIndex + 1 && modIndex === sem.modules.length - 1 && draggingModule?.code !== mod.code;

                            // Determine card border color based on semester status
                            const cardBorderClass = hasError
                              ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                              : isPastSemester
                                ? 'border-green-400 hover:border-green-500 hover:shadow-md'
                                : isCurrentSemester
                                  ? 'border-blue-400 hover:border-blue-500 hover:shadow-md'
                                  : sem.isExchange
                                    ? 'border-orange-400 hover:border-orange-500 hover:shadow-md'
                                    : 'border-amber-400 hover:border-amber-500 hover:shadow-md';

                            return (
                              <div key={mod.code}>
                                {/* Drop Indicator Before */}
                                {showDropIndicatorBefore && (
                                  <div className="h-16 mb-2 border-2 border-dashed border-primary bg-primary/10 rounded-xl flex items-center justify-center animate-pulse">
                                    <div className="flex items-center gap-2 text-primary">
                                      <span className="material-symbols-outlined text-[20px]">vertical_align_bottom</span>
                                      <span className="text-xs font-bold uppercase tracking-wider">Drop here</span>
                                    </div>
                                  </div>
                                )}

                                <div
                                  draggable="true"
                                  onDragStart={(e) => handleDragStart(e, mod.code, 'semester', sem.id)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOverModule(e, sem.id, modIndex)}
                                  onDrop={(e) => handleDrop(e, sem.id, dragOverIndex ?? undefined)}
                                  onClick={() => setSelectedModuleCode(mod.code)}
                                  className={`bg-white p-4 rounded-xl border-[3px] shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] group ${draggingModule?.code === mod.code ? 'opacity-50 scale-95' : ''
                                    } ${cardBorderClass}`}
                                  title={combinedErrorMessage}
                                >
                                  {/* Top Row: Module Code, MCs Badge, Delete Button, Drag Handle */}
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className={`text-base font-bold ${hasError ? 'text-red-700' : 'text-slate-800'}`}>{mod.code}</div>

                                    <div className="flex items-center gap-2">
                                      {hasError && (
                                        <span className="material-symbols-outlined text-red-500 text-[18px]" title={combinedErrorMessage}>warning</span>
                                      )}
                                      <div className={`text-xs font-bold px-2.5 py-1 rounded ${hasError ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                        4 MCs
                                      </div>
                                      {/* Delete button */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAcademicYears(prev => prev.map(y => ({
                                            ...y,
                                            semesters: y.semesters.map(s => {
                                              if (s.id === sem.id) {
                                                return {
                                                  ...s,
                                                  modules: s.modules.filter(m => m.code !== mod.code),
                                                  units: s.units - 4
                                                };
                                              }
                                              return s;
                                            })
                                          })));
                                        }}
                                        className="p-1 hover:bg-red-100 rounded transition-colors"
                                        title="Remove module"
                                      >
                                        <span className="material-symbols-outlined text-red-400 hover:text-red-600 text-[18px]">close</span>
                                      </button>
                                      {/* Drag Handle */}
                                      <div
                                        className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded transition-colors"
                                        title="Drag to move"
                                      >
                                        <span className="material-symbols-outlined text-slate-400 hover:text-slate-600 text-[18px]">drag_indicator</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Module Title */}
                                  <div className={`text-sm font-medium line-clamp-1 ${hasError ? 'text-red-600' : 'text-slate-500'}`}>{mod.title}</div>

                                  {hasError && (
                                    <div className="flex items-center gap-1.5 mt-3 text-red-600 bg-red-100/50 p-2 rounded-lg">
                                      <span className="material-symbols-outlined text-[16px]">error</span>
                                      <span className="text-sm font-bold leading-tight line-clamp-2">{combinedErrorMessage}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Drop Indicator After (only for last item) */}
                                {showDropIndicatorAfter && (
                                  <div className="h-16 mt-2 border-2 border-dashed border-primary bg-primary/10 rounded-xl flex items-center justify-center animate-pulse">
                                    <div className="flex items-center gap-2 text-primary">
                                      <span className="material-symbols-outlined text-[20px]">vertical_align_bottom</span>
                                      <span className="text-xs font-bold uppercase tracking-wider">Drop here</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Drop Zone Placeholder - shown when dragging to empty area */}
                          {isDragTarget && !sem.isExchange && sem.modules.length === 0 && (
                            <div className="h-16 border-2 border-dashed border-primary bg-primary/10 rounded-xl flex items-center justify-center animate-pulse">
                              <div className="flex items-center gap-2 text-primary">
                                <span className="material-symbols-outlined text-[20px]">add_to_photos</span>
                                <span className="text-xs font-bold uppercase tracking-wider">Drop Here</span>
                              </div>
                            </div>
                          )}

                          {isSearching ? (() => {
                            // Calculate semester info for API call
                            const semNum = sem.name.includes('1') ? 1 : (sem.name.includes('2') ? 2 : 1);
                            const acadYear = year.academicYear?.replace('/', '-') || '2025-2026';

                            const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
                              const query = e.target.value;
                              setSearchQuery(query);
                              if (query.length >= 1) {
                                try {
                                  const results = await searchModulesBySemester(query, acadYear, semNum as 1 | 2 | 3 | 4, 10);
                                  // Filter out modules already in the plan
                                  const allModulesInPlan = new Set(
                                    academicYears.flatMap(y => y.semesters.flatMap(s => s.modules.map(m => m.code)))
                                  );
                                  const filteredResults = results.filter(r => !allModulesInPlan.has(r.code));
                                  setSearchResults(filteredResults.slice(0, 5));
                                } catch (err) {
                                  setSearchResults([]);
                                }
                              } else {
                                setSearchResults([]);
                              }
                            };

                            const handleModuleSelect = (moduleCode: string, title: string) => {
                              // Add module to this semester
                              setAcademicYears(prev => prev.map(y => ({
                                ...y,
                                semesters: y.semesters.map(s => {
                                  if (s.id === sem.id) {
                                    if (s.modules.some(m => m.code === moduleCode)) return s;
                                    return {
                                      ...s,
                                      modules: [...s.modules, { code: moduleCode, title, units: 4 }],
                                      units: s.units + 4
                                    };
                                  }
                                  return s;
                                })
                              })));
                              setAddingModuleSemId(null);
                              setSearchQuery('');
                              setSearchResults([]);
                            };

                            const handleKeyDown = (e: React.KeyboardEvent) => {
                              if (e.key === 'Enter' && searchResults.length > 0) {
                                handleModuleSelect(searchResults[0].code, searchResults[0].title);
                              } else if (e.key === 'Escape') {
                                setAddingModuleSemId(null);
                                setSearchQuery('');
                                setSearchResults([]);
                              }
                            };

                            return (
                              <div className="relative animate-in fade-in zoom-in-95 duration-200 z-50">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                                <input
                                  autoFocus
                                  type="text"
                                  value={searchQuery}
                                  onChange={handleSearchChange}
                                  onKeyDown={handleKeyDown}
                                  placeholder={`Search ${sem.name} modules...`}
                                  className="w-full pl-9 pr-3 py-3 bg-white border-2 border-primary/20 rounded-lg text-xs font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-xl text-slate-700 placeholder:text-slate-400"
                                  onBlur={() => setTimeout(() => {
                                    setAddingModuleSemId(null);
                                    setSearchQuery('');
                                    setSearchResults([]);
                                  }, 200)}
                                />
                                {searchResults.length > 0 && (
                                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                      Offered in {sem.name}
                                    </div>
                                    {searchResults.map((result, idx) => (
                                      <button
                                        key={result.code}
                                        onMouseDown={() => handleModuleSelect(result.code, result.title)}
                                        className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex flex-col gap-0.5 ${idx < searchResults.length - 1 ? 'border-b border-slate-50' : ''} group`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-xs text-slate-800 group-hover:text-primary">{result.code}</span>
                                          <span className="text-[9px] font-medium text-slate-400">{result.credits} MCs</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 group-hover:text-primary/70 line-clamp-1">{result.title}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {searchQuery.length > 0 && searchResults.length === 0 && (
                                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
                                    <div className="px-3 py-4 text-center text-xs text-slate-500">
                                      No modules found for "{searchQuery}" in {sem.name}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })() : (
                            <button
                              onClick={() => setAddingModuleSemId(sem.id)}
                              className={`w-full border-2 border-slate-200 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 bg-slate-50/50 text-slate-400 hover:bg-slate-100 hover:border-slate-300 transition-all cursor-pointer group ${sem.modules.length === 0 ? 'h-20' : 'h-14'}`}
                            >
                              <span className="material-symbols-outlined text-[22px] group-hover:scale-110 transition-transform">add_circle</span>
                              <span className="text-xs font-medium">Add Modules</span>
                            </button>
                          )}

                          {/* SEP Information Bar */}
                          {sem.isExchange && (
                            <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-3">
                              <span className="material-symbols-outlined text-orange-500 text-[20px] shrink-0 mt-0.5">smart_toy</span>
                              <div>
                                <p className="text-xs font-bold text-orange-800">AI Assistant Available</p>
                                <p className="text-[10px] text-orange-700 leading-relaxed mt-1">
                                  Please use AI Assistant to help you with your SEP planning. AI Assistant can let you know what course can be mapped in that school.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Add Special Term Button */}
                <div className="relative mt-4 pointer-events-auto">
                  <button
                    onClick={() => setSpecialTermMenuYear(specialTermMenuYear === year.year ? null : year.year)}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-primary hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors w-full justify-center border border-dashed border-slate-200 hover:border-primary/30"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Special Term</span>
                  </button>

                  {/* Dropdown Menu */}
                  {specialTermMenuYear === year.year && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                      <button
                        onClick={() => addSpecialTerm(year.year, 'Special Term 1')}
                        className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-primary transition-colors flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[16px]">sunny</span>
                        Special Term 1 (May-Jun)
                      </button>
                      <button
                        onClick={() => addSpecialTerm(year.year, 'Special Term 2')}
                        className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-primary transition-colors flex items-center gap-2 border-t border-slate-100"
                      >
                        <span className="material-symbols-outlined text-[16px]">wb_sunny</span>
                        Special Term 2 (Jun-Jul)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div key={year.year} className="w-10 pointer-events-none"></div>
            )
          })}
        </div>
      </div >

      {/* Bottom Part: Exempted Courses */}
      <div
        style={{ height: isBottomOpen ? (isBottomExpanded ? 224 : bottomHeight) : 36 }}
        className="bg-white border-t border-slate-200 shrink-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-all duration-100 ease-out flex flex-col"
      >
        {/* Resize Handle */}
        {isBottomOpen && !isBottomExpanded && (
          <div
            onMouseDown={handleBottomResize}
            className="h-3 w-full bg-slate-100 hover:bg-primary/10 cursor-ns-resize flex items-center justify-center transition-colors group shrink-0 border-b border-slate-200"
            title="Drag to resize"
          >
            <div className="h-1 w-12 bg-slate-300 rounded-full group-hover:bg-primary transition-colors"></div>
          </div>
        )}

        {/* Header with Minimize/Expand Buttons */}
        <div
          className={`h-10 flex items-center justify-center relative bg-slate-50 border-b border-slate-200 transition-colors group shrink-0 ${!isBottomOpen ? 'cursor-pointer hover:bg-slate-100' : ''}`}
          onClick={() => !isBottomOpen && setIsBottomOpen(true)}
        >
          {!isBottomOpen && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[18px]">expand_less</span>
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Exempted Courses</span>
            </div>
          )}

          {isBottomOpen && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsBottomOpen(false); }}
              className="flex items-center justify-center w-12 h-8 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded transition-colors"
              title="Minimize"
            >
              <span className="material-symbols-outlined text-[20px]">expand_more</span>
            </button>
          )}

          {isBottomOpen && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsBottomExpanded(!isBottomExpanded); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-slate-500 rounded hover:bg-slate-200/50 transition-colors"
              title={isBottomExpanded ? "Restore Height" : "Maximize Height"}
            >
              <span className="material-symbols-outlined text-[20px]">{isBottomExpanded ? 'unfold_less' : 'unfold_more'}</span>
            </button>
          )}
        </div>

        <div className={`p-6 flex-1 overflow-hidden flex flex-col ${!isBottomOpen ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}>
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-base font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-500 text-[24px]">verified</span>
              Exempted Courses
            </h3>
          </div>

          <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar h-full items-start">
            {/* Dynamic Exempted Modules - Not draggable, with delete button */}
            {stagedModules.map(mod => (
              <div
                key={mod.id}
                className="w-48 h-32 shrink-0 border border-cyan-200 border-b-4 border-b-cyan-400 rounded-xl bg-white flex flex-col items-center justify-center gap-1 shadow-sm transition-all relative group"
              >
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setStagedModules(prev => prev.filter(m => m.id !== mod.id));
                    showToast(`${mod.code} removed from exempted courses`, 'success');
                  }}
                  className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
                  title="Remove exempted course"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
                <div className="text-base font-bold text-slate-800">{mod.code}</div>
                <div className="text-xs font-medium text-cyan-600">Exempted</div>
                <div className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 mt-1">{mod.mcs} MCs</div>
              </div>
            ))}

            {/* Add Exempted Course Box */}
            <div className="relative h-32 shrink-0">
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-40 h-32 border-2 border-slate-300 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-cyan-400 hover:text-cyan-500 hover:bg-cyan-50/10 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[24px]">add_circle</span>
                <span className="text-sm font-bold">Add Exemption</span>
              </button>
            </div>
          </div>
        </div>
      </div >

      {/* Edit Module Modal */}
      {
        isEditModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-96 p-6 space-y-6 animate-in zoom-in-95 slide-in-from-bottom-5 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Edit Course</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Module Code</label>
                  <input
                    type="text"
                    value={newModuleCode}
                    onChange={e => setNewModuleCode(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setNewModuleType('taken')}
                      className={`p-3 rounded-lg border text-sm font-medium flex flex-col items-center gap-2 transition-all ${newModuleType === 'taken' ? 'bg-cyan-50 border-cyan-500 text-cyan-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                      Course Taken
                    </button>
                    <button
                      onClick={() => setNewModuleType('exempted')}
                      className={`p-3 rounded-lg border text-sm font-medium flex flex-col items-center gap-2 transition-all ${newModuleType === 'exempted' ? 'bg-cyan-50 border-cyan-500 text-cyan-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                      <span className="material-symbols-outlined text-[20px]">verified</span>
                      Exempted
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={saveEditedModule}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 rounded-lg shadow-lg shadow-cyan-500/30 transition-all active:scale-[0.98]"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Add Exempted Course Modal with Dropdown Search */}
      {
        isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-96 p-6 space-y-4 animate-in zoom-in-95 slide-in-from-bottom-5 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Add Exempted Course</h3>
                <button onClick={() => {
                  setIsModalOpen(false);
                  setExemptedSearchQuery('');
                  setExemptedSearchResults([]);
                }} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="space-y-1.5 relative">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Search Course</label>
                <input
                  type="text"
                  value={exemptedSearchQuery}
                  onChange={async (e) => {
                    const query = e.target.value;
                    setExemptedSearchQuery(query);
                    if (query.length >= 2) {
                      setIsExemptedSearching(true);
                      try {
                        const results = await searchModules(query, 10);
                        setExemptedSearchResults(results);
                      } catch (err) {
                        console.error('Search error:', err);
                      } finally {
                        setIsExemptedSearching(false);
                      }
                    } else {
                      setExemptedSearchResults([]);
                    }
                  }}
                  placeholder="Type to search courses..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                  autoFocus
                />

                {/* Search Results Dropdown */}
                {exemptedSearchQuery.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 max-h-64 overflow-y-auto">
                    {isExemptedSearching ? (
                      <div className="px-4 py-3 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <span className="animate-spin material-symbols-outlined text-[16px]">progress_activity</span>
                        Searching...
                      </div>
                    ) : exemptedSearchResults.length > 0 ? (
                      exemptedSearchResults.map((result) => (
                        <button
                          key={result.code}
                          onClick={() => {
                            // Add the selected course as exempted
                            const newModule: StagedModule = {
                              id: Date.now().toString(),
                              code: result.code,
                              type: 'exempted',
                              mcs: result.credits || 4
                            };
                            setStagedModules(prev => [...prev, newModule]);
                            setIsModalOpen(false);
                            setExemptedSearchQuery('');
                            setExemptedSearchResults([]);
                            showToast(`${result.code} added as exempted course`, 'success');
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-cyan-50 transition-colors border-b border-slate-100 last:border-b-0 group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-800 group-hover:text-cyan-700">{result.code}</span>
                            <span className="text-[9px] font-medium text-slate-400">{result.credits} MCs</span>
                          </div>
                          <span className="text-[10px] text-slate-500 group-hover:text-cyan-600 line-clamp-1">{result.title}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-center text-xs text-slate-500">
                        No courses found for "{exemptedSearchQuery}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-400 text-center pt-2">
                <span className="material-symbols-outlined text-[14px] align-middle mr-1">info</span>
                Select a course from the dropdown to add it as exempted
              </div>
            </div>
          </div>
        )
      }

      {/* Toast Notification */}
      {
        toast && (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300 ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
            } text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-2`}>
            <span className="material-symbols-outlined text-[20px]">
              {toast.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        )
      }

      {/* Course Details Modal */}
      {
        selectedModuleCode && (
          <CourseDetailsModal
            moduleCode={selectedModuleCode}
            onClose={() => setSelectedModuleCode(null)}
          />
        )
      }
    </main>
  );
};

export default MainBoard;