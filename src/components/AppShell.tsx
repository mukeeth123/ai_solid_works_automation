// ============================================================
// VOLM Engineering Intelligence — Application Shell
// ============================================================

import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  FileText,
  Library,
  GitCompare,
  Settings2,
  RotateCcw,
  ChevronDown,
  User,
  Search,
  Database,
  AlertTriangle,
  Layers,
  CheckSquare,
  History,
  Activity,
  Circle,
  Terminal,
  MessageSquare,
} from 'lucide-react';
import { useStore, useActiveEnquiry } from '../store/appStore';
import { cn, Breadcrumb } from './shared';
import { EngineeringChatDrawer } from './EngineeringChatDrawer';

// ---- Navigation items ----

const NAV_ITEMS = [
  { path: '/library', label: 'Engineering Library', icon: Library },
  { path: '/compare', label: 'Reuse & Comparison', icon: GitCompare },
  { path: '/cad-change', label: 'CAD Change Centre', icon: Settings2 },
  { path: '/main-assembly', label: 'Main Assembly', icon: Layers, highlight: true, badge: '10' },
  { path: '/review', label: 'Review & Release', icon: CheckSquare },
  { path: '/history', label: 'Activity History', icon: History },
  { path: '/enquiries', label: 'Project Brief', icon: FileText },
];

// ---- Breadcrumb mapping ----

const ROUTE_BREADCRUMBS: Record<string, string[]> = {
  '/library': ['VOLM Engineering Intelligence', 'Engineering Library'],
  '/compare': ['VOLM Engineering Intelligence', 'Reuse & Comparison (10 Assemblies)'],
  '/reuse-comparison': ['VOLM Engineering Intelligence', 'Reuse & Comparison (10 Assemblies)'],
  '/cad-change': ['VOLM Engineering Intelligence', 'CAD Change Centre'],
  '/main-assembly': ['VOLM Engineering Intelligence', 'Main Assembly (Master Skid Coordination)'],
  '/review': ['VOLM Engineering Intelligence', 'Engineering Validation & Release'],
  '/history': ['VOLM Engineering Intelligence', 'Activity History'],
  '/enquiries': ['VOLM Engineering Intelligence', 'Project Brief & Specifications'],
};

// ---- Shell Layout ----

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { state, dispatch } = useStore();
  const activeEnquiry = useActiveEnquiry();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const breadcrumbItems = (ROUTE_BREADCRUMBS[location.pathname] ?? ['VOLM Engineering Intelligence']).map(
    (label, idx, arr) => ({
      label,
      onClick: idx < arr.length - 1 ? () => {} : undefined,
    })
  );

  const handleReset = () => {
    if (confirm('Reset all demo data to initial state?')) {
      dispatch({ type: 'RESET_DEMO' });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F4F5F6' }}>
      {/* Left Navigation */}
      <aside
        className="flex flex-col w-52 flex-shrink-0 h-full overflow-hidden"
        style={{ background: '#202830' }}
      >
        {/* App Identity */}
        <div className="px-4 py-4 border-b border-[#2D3A47]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#315D78' }}>
              <Layers size={15} className="text-white" />
            </div>
            <div>
              <div className="text-[12px] font-bold text-white leading-tight">VOLM Engineering</div>
              <div className="text-[10px] text-[#68737D] leading-tight">Intelligence</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ path, label, icon: Icon, badge, highlight }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                cn(
                  'nav-item flex items-center justify-between',
                  isActive ? 'active' : '',
                  highlight && !isActive ? 'text-[#58A6FF] hover:text-white' : ''
                )
              }
            >
              <div className="flex items-center gap-2 truncate">
                <Icon size={14} className="flex-shrink-0" />
                <span className="truncate">{label}</span>
              </div>
              {badge && (
                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold font-mono bg-[#315D78] text-white">
                  {badge}
                </span>
              )}
            </NavLink>
          ))}

          {/* Quick NL Copilot Trigger in Sidebar */}
          <div className="pt-2 px-1">
            <button
              onClick={() => setIsCopilotOpen(true)}
              className="w-full text-left px-2.5 py-2 rounded text-[11.5px] font-medium text-[#C9D1D9] hover:text-white bg-[#26303B] hover:bg-[#2E3B48] flex items-center gap-2 border border-[#3A4856] transition-colors"
            >
              <Terminal size={13} className="text-[#58A6FF]" />
              <span>Engineering Copilot</span>
            </button>
          </div>
        </nav>

        {/* Bottom status */}
        <div className="border-t border-[#2D3A47] px-3 py-3 space-y-2">
          {/* Data Source */}
          <div className="flex items-start gap-2">
            <Database size={12} className="text-[#68737D] mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-[10.5px] font-medium text-[#9AAAB5]">Data Source</div>
              <div className="text-[10.5px] text-[#68737D]">Demo Engineering Library</div>
            </div>
          </div>

          {/* Workspace */}
          <div className="flex items-start gap-2">
            <Activity size={12} className="text-[#68737D] mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-[10.5px] font-medium text-[#9AAAB5]">Workspace</div>
              <div className="text-[10.5px] text-[#68737D]">{state.currentWorkspace}</div>
            </div>
          </div>

          {/* Connection status — explicitly noting no live connection */}
          <div className="flex items-center gap-1.5 pt-1">
            <Circle size={7} className="text-[#9A6A00] fill-[#9A6A00]" />
            <span className="text-[10px] text-[#68737D]">Demo mode — no live CAD connection</span>
          </div>

          {/* Reset button */}
          <button
            onClick={handleReset}
            className="w-full flex items-center gap-1.5 text-[10.5px] text-[#68737D] hover:text-[#9AAAB5] mt-1 transition-colors"
          >
            <RotateCcw size={11} />
            Reset demo data
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header
          className="flex items-center gap-3 px-4 h-11 flex-shrink-0 border-b border-[#DDE2E6]"
          style={{ background: '#FFFFFF' }}
        >
          {/* Breadcrumb */}
          <div className="flex-1 min-w-0">
            <Breadcrumb items={breadcrumbItems} />
          </div>

          {/* Enquiry ref selector */}
          {activeEnquiry && (
            <div className="hidden md:flex items-center gap-1.5 border-x border-[#DDE2E6] px-3 py-1">
              <span className="text-[10.5px] text-[#68737D]">Enquiry:</span>
              <select
                className="text-[11.5px] font-semibold text-[#315D78] bg-transparent outline-none cursor-pointer"
                value={state.activeEnquiryId}
                onChange={e => dispatch({ type: 'SET_ACTIVE_ENQUIRY', id: e.target.value })}
              >
                {state.enquiries.map(enq => (
                  <option key={enq.id} value={enq.id} className="text-[#20272E] font-normal">
                    {enq.reference} — {enq.title.slice(0, 32)}...
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Natural Language Engineering Copilot Header Button */}
          <button
            onClick={() => setIsCopilotOpen(true)}
            className="btn-secondary py-1 px-2.5 text-[11.5px] flex items-center gap-1.5 border-[#315D78] text-[#315D78] hover:bg-[#EBF2F7]"
            title="Ask questions in natural language"
          >
            <Terminal size={12} className="text-[#315D78]" />
            <span className="font-medium">Engineering Copilot</span>
            <span className="text-[9.5px] font-mono bg-[#EBF2F7] text-[#315D78] px-1 rounded border border-[#C5D9E8]">
              NL
            </span>
          </button>

          {/* Data source indicator */}
          <div className="hidden lg:flex items-center gap-1.5">
            <Database size={12} className="text-[#9AAAB5]" />
            <span className="text-[11px] text-[#9AAAB5]">Demo workspace</span>
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 btn-ghost px-2"
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#315D78' }}>
                {state.currentUser.split(' ').map(n => n[0]).join('')}
              </div>
              <span className="text-[12px] text-[#20272E] hidden sm:block">{state.currentUser}</span>
              <ChevronDown size={12} className="text-[#68737D]" />
            </button>

            {showUserMenu && (
              <div
                className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#DDE2E6] rounded shadow-lg z-50"
                onBlur={() => setShowUserMenu(false)}
              >
                <div className="p-3 border-b border-[#DDE2E6]">
                  <p className="text-[12px] font-semibold text-[#20272E]">{state.currentUser}</p>
                  <p className="text-[11px] text-[#68737D]">Mechanical Engineer / Reviewer</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={() => { setIsCopilotOpen(true); setShowUserMenu(false); }}
                    className="w-full text-left px-3 py-2 text-[12.5px] text-[#20272E] hover:bg-[#F4F5F6] rounded flex items-center gap-2"
                  >
                    <Terminal size={13} className="text-[#315D78]" />
                    Engineering Copilot
                  </button>
                  <button
                    onClick={handleReset}
                    className="w-full text-left px-3 py-2 text-[12.5px] text-[#68737D] hover:bg-[#F4F5F6] rounded flex items-center gap-2"
                  >
                    <RotateCcw size={13} />
                    Reset Demo State
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Demo notice */}
        <div className="demo-notice flex-shrink-0">
          <AlertTriangle size={11} />
          <span>Demonstration workspace — sample engineering data. Illustrative only — not VOLM source data. Simulated CAD operations only.</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-hidden relative">
          {children}

          {/* Natural Language Engineering Copilot Drawer */}
          <EngineeringChatDrawer
            isOpen={isCopilotOpen}
            onClose={() => setIsCopilotOpen(false)}
          />
        </main>
      </div>
    </div>
  );
}
