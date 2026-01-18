import React, { useState, useEffect } from 'react';
import { generatePlan, GeneratePlanResponse } from '../api';

interface SidebarLeftProps {
  onGeneratePlan: (plan: GeneratePlanResponse) => void;
  onAcademicYearChange?: (startYear: string) => void;
  onCurrentSemesterChange?: (semester: string) => void;
  initialAcademicYear?: string;
  onDegreeChange?: (degree: 'computing' | 'bba') => void;
  onMajorChange?: (major: string) => void;
}

// Major options based on degree
const COMPUTING_MAJORS = [
  'Computer Science',
  'Artificial Intelligence',
  'Information Security',
  'Computer Engineering',
  'Business Analytics',
  'Business Artificial Intelligence System'
];

const BBA_MAJORS = [
  'Applied Business Analytics',
  'Business Economics',
  'Finance',
  'Innovation & Entrepreneurship',
  'Leadership & Human Capital Management',
  'Marketing',
  'Operations & Supply Chain Management',
  'Accountancy',
  'Real Estate'
];

// SEP semester options (Year 2 Sem 1 to Year 4 Sem 1)
const SEP_OPTIONS = [
  'Year 2 Semester 1',
  'Year 2 Semester 2',
  'Year 3 Semester 1',
  'Year 3 Semester 2',
  'Year 4 Semester 1'
];

// CS Focus Areas / Specialisations
const CS_FOCUS_AREAS = [
  'Algorithms & Theory',
  'Artificial Intelligence',
  'Computer Graphics and Games',
  'Computer Security',
  'Database Systems',
  'Multimedia Computing',
  'Networking and Distributed Systems',
  'Parallel Computing',
  'Programming Languages',
  'Software Engineering',
  "None/Haven't Decided"
];

const SidebarLeft: React.FC<SidebarLeftProps> = ({ onGeneratePlan, onAcademicYearChange, onCurrentSemesterChange, initialAcademicYear = '2024/2025', onDegreeChange, onMajorChange }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [width, setWidth] = useState(288); // Default w-72 = 288px
  const [hasExchange, setHasExchange] = useState(false);
  const [degree, setDegree] = useState<'computing' | 'bba'>('computing');
  const [yearOfStudy, setYearOfStudy] = useState('Y1S1');
  const [primaryMajor, setPrimaryMajor] = useState(COMPUTING_MAJORS[0]);
  const [focusArea, setFocusArea] = useState(CS_FOCUS_AREAS[0]);
  const [sepSemester, setSepSemester] = useState(SEP_OPTIONS[0]);
  const [academicYear, setAcademicYear] = useState(initialAcademicYear);
  const [maxMCs, setMaxMCs] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);

  // Tooltip states
  const [showLockedTooltip, setShowLockedTooltip] = useState<'major' | 'minor' | 'acadYear' | null>(null);

  // Resize handler for left sidebar
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, 220), 450); // Min 220px, Max 450px
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Get majors based on selected degree
  const currentMajors = degree === 'computing' ? COMPUTING_MAJORS : BBA_MAJORS;

  // Notify parent when current semester changes
  useEffect(() => {
    onCurrentSemesterChange?.(yearOfStudy);
  }, [yearOfStudy, onCurrentSemesterChange]);

  // Update primary major when degree changes
  const handleDegreeChange = (newDegree: 'computing' | 'bba') => {
    setDegree(newDegree);
    const newMajor = newDegree === 'computing' ? COMPUTING_MAJORS[0] : BBA_MAJORS[0];
    setPrimaryMajor(newMajor);
    onDegreeChange?.(newDegree);
    onMajorChange?.(newMajor);
  };

  // Notify parent when major changes
  const handleMajorChange = (newMajor: string) => {
    setPrimaryMajor(newMajor);
    onMajorChange?.(newMajor);
  };

  // Handle academic year change
  const handleAcademicYearChange = (newYear: string) => {
    setAcademicYear(newYear);
    onAcademicYearChange?.(newYear);
  };

  // Generate academic year options (current year + 5 years back) in AY format
  const currentYear = new Date().getFullYear();
  const academicYearOptions = Array.from({ length: 6 }, (_, i) => {
    const year = currentYear - 2 + i;
    const shortYear = year % 100;
    const nextShortYear = (year + 1) % 100;
    return `AY${shortYear.toString().padStart(2, '0')}/${nextShortYear.toString().padStart(2, '0')}`;
  });

  // Handle generate plan button click
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Map focus area name to backend format
      const focusAreaMap: Record<string, string> = {
        'Artificial Intelligence': 'AI',
        'Computer Graphics and Games': 'Graphics',
        'Computer Security': 'Security',
        'Database Systems': 'Database',
        'Multimedia Computing': 'Multimedia',
        'Networking and Distributed Systems': 'Networks',
        'Parallel Computing': 'Parallel',
        'Programming Languages': 'PL',
        'Software Engineering': 'SoftwareEngineering'
      };
      const focusAreaCode = focusAreaMap[focusArea] || 'AI';

      // Format SEP semester if enabled
      let formattedSepSemester = undefined;
      if (hasExchange) {
        const match = sepSemester.match(/Year (\d) Semester (\d)/);
        if (match) {
          formattedSepSemester = `y${match[1]}s${match[2]}`;
        }
      }

      // Default fixed courses for CS
      const fixedCourses = (degree === 'computing' && primaryMajor === 'Computer Science')
        ? { 'CS1101S': 'y1s1' }
        : undefined;

      const result = await generatePlan({
        degree: degree,
        major: primaryMajor,
        focus_area: focusAreaCode,
        max_mcs: maxMCs,
        sep_semester: formattedSepSemester,
        fixed_courses: fixedCourses,
        max_hard_per_sem: 4 // optimized default
      });

      if (result.success) {
        onGeneratePlan(result);
      } else {
        console.error('Failed to generate plan:', result.message);
      }
    } catch (error) {
      console.error('Error generating plan:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative z-20 shrink-0 h-full flex items-start">
      {/* Sidebar Container */}
      <div
        style={{ width: isOpen ? width : 0 }}
        className={`h-full bg-white border-r border-slate-200 transition-all duration-100 ease-out overflow-hidden flex flex-col ${isOpen ? 'opacity-100' : 'opacity-0 border-none'}`}
      >
        <div style={{ width: width }} className="flex flex-col h-full"> {/* Inner fixed width container */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-500 tracking-widest uppercase">Academic Plan</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-100"
                title="Collapse sidebar"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-6 custom-scrollbar">
            {/* Form Group */}
            <div className="space-y-4">
              {/* Matriculated In (Start Year) */}
              <div className="space-y-1.5 relative">
                <div className="flex items-center gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 block">Matriculated in</label>
                  <button
                    onMouseEnter={() => setShowLockedTooltip('acadYear')}
                    onMouseLeave={() => setShowLockedTooltip(null)}
                    className="text-slate-400 hover:text-slate-500"
                  >
                    <span className="material-symbols-outlined text-[14px]">info</span>
                  </button>
                  {showLockedTooltip === 'acadYear' && (
                    <div className="absolute left-0 top-full mt-2 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-lg z-50 w-64 animate-in fade-in slide-in-from-top-1">
                      <p>Select the academic year when you <strong>started Year 1</strong>. This sets the base year for your 4-year study plan.</p>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <select
                    value={academicYear}
                    onChange={(e) => handleAcademicYearChange(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 pr-8 cursor-pointer hover:border-slate-300 transition-colors outline-none font-medium"
                  >
                    {academicYearOptions.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Current Semester */}
              <div className="space-y-1.5 relative">
                <div className="flex items-center gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 block">Current Semester</label>
                  <button
                    onMouseEnter={() => setShowLockedTooltip('year' as any)}
                    onMouseLeave={() => setShowLockedTooltip(null)}
                    className="text-slate-400 hover:text-slate-500"
                  >
                    <span className="material-symbols-outlined text-[14px]">info</span>
                  </button>
                  {showLockedTooltip === ('year' as any) && (
                    <div className="absolute left-0 top-full mt-2 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-lg z-50 w-64 animate-in fade-in slide-in-from-top-1">
                      <p>The study plan will only update modules from the <strong>next semester onwards</strong>. Semesters before your current one are considered completed.</p>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <select
                    value={yearOfStudy}
                    onChange={(e) => setYearOfStudy(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 pr-8 cursor-pointer hover:border-slate-300 transition-colors outline-none font-medium"
                  >
                    <option value="Y0S0">Incoming Freshman</option>
                    <option value="Y1S1">Year 1 Semester 1</option>
                    <option value="Y1S2">Year 1 Semester 2</option>
                    <option value="Y2S1">Year 2 Semester 1</option>
                    <option value="Y2S2">Year 2 Semester 2</option>
                    <option value="Y3S1">Year 3 Semester 1</option>
                    <option value="Y3S2">Year 3 Semester 2</option>
                    <option value="Y4S1">Year 4 Semester 1</option>
                    <option value="Y4S2">Year 4 Semester 2</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Faculty */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 block">Faculty</label>
                <div className="relative">
                  <select
                    value={degree}
                    onChange={(e) => handleDegreeChange(e.target.value as 'computing' | 'bba')}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 pr-8 cursor-pointer hover:border-slate-300 transition-colors outline-none font-medium"
                  >
                    <option value="computing">Computing</option>
                    <option value="bba">Business</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Primary Major - Conditional based on degree */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 block">Primary Major</label>
                <div className="relative">
                  <select
                    value={primaryMajor}
                    onChange={(e) => handleMajorChange(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 pr-8 cursor-pointer hover:border-slate-300 transition-colors outline-none font-medium"
                  >
                    {currentMajors.map((major) => {
                      const isAllowed = ['Computer Science', 'Business Analytics', 'Finance', 'Accountancy'].includes(major);
                      return (
                        <option key={major} value={major} disabled={!isAllowed}>
                          {isAllowed ? major : `🔒 ${major}`}
                        </option>
                      );
                    })}
                    <option value="" disabled>More coming soon...</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Focus Area / Specialization */}
              {degree === 'computing' && primaryMajor === 'Computer Science' && (
                <div className="space-y-1.5 relative">
                  <div className="flex items-center gap-1.5">
                    <label className="text-sm font-semibold text-slate-700 block">Focus Area / Specialization</label>
                    <button
                      onMouseEnter={() => setShowLockedTooltip('focusArea' as any)}
                      onMouseLeave={() => setShowLockedTooltip(null)}
                      className="text-slate-400 hover:text-slate-500"
                    >
                      <span className="material-symbols-outlined text-[14px]">info</span>
                    </button>
                    {showLockedTooltip === ('focusArea' as any) && (
                      <div className="absolute left-0 top-full mt-2 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-lg z-50 w-64 animate-in fade-in slide-in-from-top-1">
                        <p className="mb-2"><strong>Choose your primary focus area.</strong></p>
                        <p>You can only select one here for plan generation. Add additional focus areas manually by dragging courses to your plan.</p>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      value={focusArea}
                      onChange={(e) => setFocusArea(e.target.value)}
                      className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 pr-8 cursor-pointer hover:border-slate-300 transition-colors outline-none font-medium"
                    >
                      {CS_FOCUS_AREAS.map((area) => (
                        <option key={area} value={area}>{area}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                      <span className="material-symbols-outlined text-[20px]">expand_more</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Max MCs per Semester */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 block">Max MCs per Semester</label>
                  <button
                    onMouseEnter={() => setShowLockedTooltip('maxMCs' as any)}
                    onMouseLeave={() => setShowLockedTooltip(null)}
                    className="text-slate-400 hover:text-slate-500"
                  >
                    <span className="material-symbols-outlined text-[14px]">info</span>
                  </button>
                  {showLockedTooltip === ('maxMCs' as any) && (
                    <div className="absolute left-0 top-full mt-2 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-lg z-50 w-64 animate-in fade-in slide-in-from-top-1">
                      <p>Maximum module credits (MCs) to schedule per semester. Default is <strong>20 MCs</strong> (5 modules). Increase for heavier workload.</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="16"
                    max="99"
                    step="4"
                    value={maxMCs}
                    onChange={(e) => setMaxMCs(parseInt(e.target.value) || 20)}
                    className="w-16 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 text-center font-bold outline-none hover:border-slate-300 transition-colors"
                  />
                  <span className="text-xs text-slate-500">MCs</span>
                  <div className="flex gap-0.5 ml-auto">
                    <button
                      onClick={() => setMaxMCs(16)}
                      className={`px-1.5 py-1 text-[9px] font-bold rounded transition-colors ${maxMCs === 16 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      Light
                    </button>
                    <button
                      onClick={() => setMaxMCs(20)}
                      className={`px-1.5 py-1 text-[9px] font-bold rounded transition-colors ${maxMCs === 20 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => setMaxMCs(24)}
                      className={`px-1.5 py-1 text-[9px] font-bold rounded transition-colors ${maxMCs === 24 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      Heavy
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-slate-100"></div>

            {/* Locked Toggles */}
            <div className="space-y-5">
              {/* 2nd Major - Locked */}
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-400">2nd Major?</label>
                  <button
                    onMouseEnter={() => setShowLockedTooltip('major')}
                    onMouseLeave={() => setShowLockedTooltip(null)}
                    className="text-slate-400 hover:text-slate-500"
                  >
                    <span className="material-symbols-outlined text-[16px]">info</span>
                  </button>
                  {showLockedTooltip === 'major' && (
                    <div className="absolute left-0 top-full mt-2 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-lg z-50 w-56 animate-in fade-in slide-in-from-top-1">
                      <p>This feature is currently unavailable while we collect the required data. Check back soon!</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-300 text-[18px]">lock</span>
                  <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-100 cursor-not-allowed opacity-50">
                    <span className="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white" />
                  </div>
                </div>
              </div>

              {/* Minor - Locked */}
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-400">Minor(s)</label>
                  <button
                    onMouseEnter={() => setShowLockedTooltip('minor')}
                    onMouseLeave={() => setShowLockedTooltip(null)}
                    className="text-slate-400 hover:text-slate-500"
                  >
                    <span className="material-symbols-outlined text-[16px]">info</span>
                  </button>
                  {showLockedTooltip === 'minor' && (
                    <div className="absolute left-0 top-full mt-2 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-lg z-50 w-56 animate-in fade-in slide-in-from-top-1">
                      <p>This feature is currently unavailable while we collect the required data. Check back soon!</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-300 text-[18px]">lock</span>
                  <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-100 cursor-not-allowed opacity-50">
                    <span className="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white" />
                  </div>
                </div>
              </div>

              {/* Exchange Program */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">Going on SEP?</label>
                  <button
                    onClick={() => setHasExchange(!hasExchange)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${hasExchange ? 'bg-green-500' : 'bg-slate-200'}`}
                  >
                    <span className={`${hasExchange ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                  </button>
                </div>
                {hasExchange && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Target Semester</label>
                      <div className="relative">
                        <select
                          value={sepSemester}
                          onChange={(e) => setSepSemester(e.target.value)}
                          className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 pr-8 outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          {SEP_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                          <span className="material-symbols-outlined text-[18px]">expand_more</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 bg-white">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full font-bold py-3 px-4 rounded-lg shadow-sm transition-all text-sm active:scale-95 flex items-center justify-center gap-2 ${isGenerating ? 'bg-orange-400 cursor-not-allowed' : 'bg-accent hover:bg-orange-600'} text-white`}
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-[18px]">progress_activity</span>
                  Generating...
                </>
              ) : (
                'Generate Study Plan'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Resize Handle & Toggle */}
      {isOpen ? (
        <div
          onMouseDown={handleMouseDown}
          className="h-full w-3 bg-slate-100 hover:bg-primary/10 cursor-ew-resize flex items-center justify-center transition-colors group border-l border-slate-200"
          title="Drag to resize"
        >
          <div className="w-1 h-12 bg-slate-300 rounded-full group-hover:bg-primary transition-colors"></div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="h-full w-8 bg-white border-r border-y border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all duration-300 z-50 focus:outline-none border-l-0 group"
          title="Expand Sidebar"
        >
          <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-600 transition-all text-[16px] rotate-180">chevron_left</span>
        </button>
      )}
    </div>
  );
};

export default SidebarLeft;