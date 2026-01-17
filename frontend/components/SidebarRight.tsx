import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface SidebarRightProps {
    isOpen: boolean;
    toggle: () => void;
    currentPlan?: any;
    userId?: string;
    userMajor?: string;
    userDegree?: string;
    currentSemester?: string;
    startYear?: string;
    hasExchange?: boolean;
}

interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    tool_calls?: any[];
}

const SidebarRight: React.FC<SidebarRightProps> = ({ isOpen, toggle, currentPlan, userId, userMajor, userDegree, currentSemester, startYear, hasExchange }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: 1, role: 'assistant', content: "Hi there! 👋 I'm **Steve**, your AI study planner. How can I help you with your plan today?" }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [width, setWidth] = useState(320); // Resizable width
    const [conversationSummary, setConversationSummary] = useState(''); // Stores summary of old messages

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: Date.now(),
            role: 'user',
            content: inputValue.trim()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Simplify plan for AI context (reduce tokens)
            const simplifiedPlan = currentPlan ? {
                years: currentPlan.academicYears.map((y: any) => ({
                    year: y.label,
                    semesters: y.semesters.map((s: any) => ({
                        name: s.name,
                        modules: s.modules.map((m: any) => m.code)
                    }))
                })),
                exempted: currentPlan.stagedModules?.filter((m: any) => m.type === 'exempted').map((m: any) => m.code)
            } : {};

            // Build conversation history (exclude welcome, keep last 10)
            const allMessages = [...messages, userMessage].filter(m => m.id !== 1);

            // If we have more than 10 messages, summarize the oldest ones
            let currentSummary = conversationSummary;
            let recentMessages = allMessages;

            if (allMessages.length > 10) {
                // Take messages that will be "pushed out" and add to summary
                const oldestMessages = allMessages.slice(0, allMessages.length - 10);
                const oldestContent = oldestMessages.map(m => `${m.role}: ${m.content}`).join(' | ');

                // Update summary (append to existing)
                currentSummary = conversationSummary
                    ? `${conversationSummary} | ${oldestContent}`
                    : oldestContent;

                // Keep only last 100 chars of summary to avoid token bloat
                if (currentSummary.length > 200) {
                    currentSummary = '...' + currentSummary.slice(-200);
                }

                setConversationSummary(currentSummary);
                recentMessages = allMessages.slice(-10);
            }

            const conversationHistory = recentMessages.map(m => ({ role: m.role, content: m.content }));

            const response = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId || "guest",
                    message: userMessage.content,
                    current_plan: simplifiedPlan,
                    user_major: userMajor || "Undeclared",
                    user_degree: userDegree || "Undeclared",
                    current_semester: currentSemester || "Y1S1",
                    start_year: startYear || "2024/2025",
                    has_exchange: hasExchange || false,
                    conversation_history: conversationHistory,
                    conversation_summary: currentSummary
                })
            });

            const data = await response.json();

            const assistantMessage: ChatMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: data.reply || 'Sorry, I could not process your request.'
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: ChatMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: 'Sorry, there was an error connecting to the AI service.'
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Resize handler
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = width;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const delta = startX - moveEvent.clientX;
            const newWidth = Math.min(Math.max(startWidth + delta, 280), 600); // Min 280px, Max 600px
            setWidth(newWidth);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div className="relative z-30 shrink-0 h-full flex items-start">
            {/* Visible Resize Divider (Windows Explorer style) */}
            {isOpen && (
                <div
                    onMouseDown={handleMouseDown}
                    className="h-full w-1.5 bg-slate-200 hover:bg-primary cursor-ew-resize flex items-center justify-center transition-colors group"
                    title="Drag to resize"
                >
                    <div className="w-0.5 h-8 bg-slate-400 rounded-full group-hover:bg-white transition-colors"></div>
                </div>
            )}

            <aside style={{ width: isOpen ? width : 0 }} className={`h-full bg-white border-l border-slate-200 shadow-xl transition-all duration-100 ease-out overflow-hidden flex flex-col ${isOpen ? '' : 'border-none'}`}>
                <div style={{ width: width }} className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0 bg-slate-50/50">
                        <div className="flex items-center gap-2 text-primary">
                            <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                            <h2 className="text-sm font-bold uppercase tracking-wider">AI Assistant</h2>
                        </div>
                        <button onClick={toggle} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <span className="material-symbols-outlined text-[20px]">close_fullscreen</span>
                        </button>
                    </div>

                    {/* Chat Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30">
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${msg.role === 'user'
                                    ? 'bg-orange-100 border border-white shadow-sm overflow-hidden'
                                    : 'bg-primary/10 text-primary'
                                    }`}>
                                    {msg.role === 'user' ? (
                                        <img src="https://picsum.photos/100/100" alt="User" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                                    )}
                                </div>
                                <div className={`flex-1 ${msg.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                                    <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm max-w-[90%] ${msg.role === 'user'
                                        ? 'bg-primary text-white rounded-tr-none'
                                        : 'bg-slate-100 text-slate-700 rounded-tl-none border border-slate-200'
                                        }`}>
                                        {msg.role === 'assistant' ? (
                                            <div className="prose prose-sm prose-slate max-w-none prose-headings:text-sm prose-headings:font-bold prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-table:border prose-th:border prose-td:border prose-th:bg-slate-200">
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                                    <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                                </div>
                                <div className="flex-1">
                                    <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none text-sm text-slate-500 border border-slate-200 inline-block">
                                        <span className="animate-pulse">Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-slate-200 bg-white shrink-0">
                        <div className="relative">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Ask about module mapping or workload..."
                                className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none shadow-sm"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={isLoading || !inputValue.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-[20px] filled">send</span>
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Collapsed Toggle Button */}
            {!isOpen && (
                <button
                    onClick={toggle}
                    className="h-full w-10 bg-white border-l border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all z-50 focus:outline-none group shadow-lg"
                    title="Open AI Assistant"
                >
                    <span className="material-symbols-outlined text-primary group-hover:text-primary/80 transition-all text-[20px]">smart_toy</span>
                </button>
            )}
        </div>
    );
};

export default SidebarRight;