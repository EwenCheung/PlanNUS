import React, { useEffect, useState } from 'react';
import { getModuleDetails, ModuleDetails } from '../api';

interface CourseDetailsModalProps {
    moduleCode: string;
    onClose: () => void;
}

const CourseDetailsModal: React.FC<CourseDetailsModalProps> = ({ moduleCode, onClose }) => {
    const [details, setDetails] = useState<ModuleDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await getModuleDetails(moduleCode);
                setDetails(data);
            } catch (err) {
                setError('Failed to load module details');
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [moduleCode]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-primary to-blue-600 text-white p-6 shrink-0">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">{moduleCode}</h2>
                            {details && (
                                <p className="text-blue-100 mt-1 text-sm font-medium">{details.title}</p>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    {details && (
                        <div className="flex flex-wrap gap-2 mt-4">
                            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
                                {details.module_credit} MCs
                            </span>
                            {details.offered_semesters.map((sem) => (
                                <span key={sem} className="bg-green-400/30 px-3 py-1 rounded-full text-xs font-bold">
                                    {sem}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-12 text-red-500">
                            <span className="material-symbols-outlined text-4xl mb-2">error</span>
                            <p>{error}</p>
                        </div>
                    )}

                    {details && !loading && (
                        <div className="space-y-6">
                            {/* Description */}
                            {details.description && (
                                <section>
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-[18px]">description</span>
                                        Description
                                    </h3>
                                    <p className="text-sm text-slate-600 leading-relaxed">{details.description}</p>
                                </section>
                            )}

                            {/* Department & Faculty */}
                            <section className="grid grid-cols-2 gap-4">
                                {details.department && (
                                    <div className="bg-slate-50 p-4 rounded-xl">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Department</h4>
                                        <p className="text-sm font-medium text-slate-700">{details.department}</p>
                                    </div>
                                )}
                                {details.faculty && (
                                    <div className="bg-slate-50 p-4 rounded-xl">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Faculty</h4>
                                        <p className="text-sm font-medium text-slate-700">{details.faculty}</p>
                                    </div>
                                )}
                            </section>

                            {/* Workload */}
                            {details.workload_description && (
                                <section>
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-[18px]">schedule</span>
                                        Workload
                                    </h3>
                                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                                        <p className="text-sm text-amber-800 font-medium">{details.workload_description}</p>
                                    </div>
                                </section>
                            )}

                            {/* Prerequisites */}
                            {details.prerequisite_rule && (
                                <section>
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-[18px]">account_tree</span>
                                        Prerequisites
                                    </h3>
                                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                                        <p className="text-sm text-blue-800">{details.prerequisite_rule}</p>
                                    </div>
                                </section>
                            )}

                            {/* Corequisites */}
                            {details.corequisite && (
                                <section>
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-[18px]">link</span>
                                        Corequisites
                                    </h3>
                                    <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl">
                                        <p className="text-sm text-purple-800">{details.corequisite}</p>
                                    </div>
                                </section>
                            )}

                            {/* Preclusions */}
                            {details.preclusion && (
                                <section>
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-[18px]">block</span>
                                        Preclusions
                                    </h3>
                                    <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
                                        <p className="text-sm text-red-800">{details.preclusion}</p>
                                    </div>
                                </section>
                            )}

                            {/* Reviews */}
                            <section>
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-[18px]">rate_review</span>
                                    Student Reviews ({details.reviews.length})
                                </h3>
                                {details.reviews.length > 0 ? (
                                    <div className="space-y-3">
                                        {details.reviews.map((review, idx) => (
                                            <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-slate-400 text-[16px]">person</span>
                                                        <span className="text-xs font-medium text-slate-500">
                                                            {review.academic_year || 'Anonymous'}
                                                        </span>
                                                    </div>
                                                    {review.timestamp && (
                                                        <span className="text-[10px] text-slate-400">
                                                            {new Date(review.timestamp).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-700 leading-relaxed">{review.comment}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-slate-400">
                                        <span className="material-symbols-outlined text-3xl mb-2">chat_bubble_outline</span>
                                        <p className="text-sm">No reviews available yet</p>
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CourseDetailsModal;
