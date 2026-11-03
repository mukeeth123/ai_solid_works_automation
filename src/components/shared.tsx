// ============================================================
// VOLM Engineering Intelligence — Shared UI Components
// ============================================================

import { type ReactNode, useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle, Clock, Info } from 'lucide-react';
import type { ValidationStatus, MatchStatus, ConfirmationStatus, Priority, ApprovalStatus } from '../types/engineering';

// ---- cn utility ----

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ---- StatusBadge ----

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
}

const STATUS_STYLES: Record<string, string> = {
  match: 'status-match',
  mismatch: 'status-mismatch',
  unknown: 'status-unknown',
  review_required: 'status-review',
  not_applicable: 'status-unknown',
  confirmed: 'status-confirmed',
  missing: 'status-missing',
  unconfirmed: 'status-unconfirmed',
  conflicting: 'status-conflicting',
  passed: 'status-match',
  failed: 'status-mismatch',
  not_run: 'status-unknown',
  pending: 'status-unconfirmed',
  approved: 'status-confirmed',
  rejected: 'status-mismatch',
  revision_requested: 'status-review',
  complete: 'status-confirmed',
  executing: 'status-unconfirmed',
  preparing: 'status-unconfirmed',
  cancelled: 'status-unknown',
  critical: 'status-mismatch',
  high: 'status-review',
  medium: 'status-unconfirmed',
  low: 'status-unknown',
  released: 'status-confirmed',
  draft: 'status-unconfirmed',
  in_review: 'status-review',
  obsolete: 'status-unknown',
  archived: 'status-unknown',
  reuse_candidate: 'status-confirmed',
  modify_candidate: 'status-review',
  new_design_required: 'status-mismatch',
  update_required: 'status-review',
  current: 'status-confirmed',
  not_required: 'status-unknown',
  updated: 'status-confirmed',
};

const STATUS_LABELS: Record<string, string> = {
  match: 'Match',
  mismatch: 'Mismatch',
  unknown: 'Unknown',
  review_required: 'Review',
  not_applicable: 'N/A',
  confirmed: 'Confirmed',
  missing: 'Missing',
  unconfirmed: 'Unconfirmed',
  conflicting: 'Conflicting',
  passed: 'Passed',
  failed: 'Failed',
  not_run: 'Not Run',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  revision_requested: 'Revision Req.',
  complete: 'Complete',
  executing: 'Executing',
  preparing: 'Preparing',
  rebuilding: 'Rebuilding',
  verifying: 'Verifying',
  cancelled: 'Cancelled',
  idle: 'Idle',
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  released: 'Released',
  draft: 'Draft',
  in_review: 'In Review',
  obsolete: 'Obsolete',
  archived: 'Archived',
  reuse_candidate: 'Reuse Candidate',
  modify_candidate: 'Modify Candidate',
  new_design_required: 'New Design',
  update_required: 'Update Required',
  current: 'Current',
  not_required: 'Not Required',
  updated: 'Updated',
  superseded: 'Superseded',
  in_progress: 'In Progress',
  open: 'Open',
  pending_review: 'Pending Review',
  completed: 'Completed',
  cancelled_enq: 'Cancelled',
  not_ready: 'Not Ready',
  pending_checks: 'Pending Checks',
  ready_for_review: 'Ready for Review',
  approved_for_release: 'Approved',
};

export function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const styleClass = STATUS_STYLES[status] ?? 'status-unknown';
  const displayLabel = label ?? STATUS_LABELS[status] ?? status;
  const sizeClass = size === 'sm' ? 'text-[10.5px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span className={cn('inline-flex items-center font-medium rounded-sm', sizeClass, styleClass)}>
      {displayLabel}
    </span>
  );
}

// ---- ValidationIcon ----

export function ValidationIcon({ status }: { status: ValidationStatus }) {
  switch (status) {
    case 'passed': return <CheckCircle size={14} className="check-pass flex-shrink-0" />;
    case 'failed': return <XCircle size={14} className="check-fail flex-shrink-0" />;
    case 'review_required': return <AlertTriangle size={14} className="check-warn flex-shrink-0" />;
    case 'not_run': return <Clock size={14} className="check-pending flex-shrink-0" />;
    case 'not_applicable': return <Info size={14} className="check-pending flex-shrink-0" />;
  }
}

// ---- MatchIcon ----

export function MatchIcon({ status }: { status: MatchStatus }) {
  switch (status) {
    case 'match': return <CheckCircle size={13} className="check-pass flex-shrink-0" />;
    case 'mismatch': return <XCircle size={13} className="check-fail flex-shrink-0" />;
    case 'review_required': return <AlertTriangle size={13} className="check-warn flex-shrink-0" />;
    default: return <Clock size={13} className="check-pending flex-shrink-0" />;
  }
}

// ---- Section Panel ----

interface SectionPanelProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
  className?: string;
  headerClassName?: string;
}

export function SectionPanel({ title, icon, children, defaultOpen = true, actions, className, headerClassName }: SectionPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('eng-panel', className)}>
      <div
        className={cn('eng-panel-header cursor-pointer select-none', headerClassName)}
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={13} className="text-[#68737D] flex-shrink-0" /> : <ChevronRight size={13} className="text-[#68737D] flex-shrink-0" />}
        {icon}
        <span className="eng-panel-title flex-1">{title}</span>
        {actions && <div onClick={e => e.stopPropagation()}>{actions}</div>}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}

// ---- Info Row ----

interface InfoRowProps {
  label: string;
  value?: string | number | ReactNode;
  mono?: boolean;
  missing?: boolean;
}

export function InfoRow({ label, value, mono, missing }: InfoRowProps) {
  const isEmpty = value === undefined || value === null || value === '';
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-[#EEF1F4] last:border-0">
      <span className="text-[11px] font-medium text-[#68737D] uppercase tracking-wide w-36 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className={cn(
        'text-[12.5px] flex-1',
        mono ? 'font-mono' : '',
        isEmpty || missing ? 'text-[#9AAAB5] italic' : 'text-[#20272E]'
      )}>
        {isEmpty || missing ? 'Not available' : value}
      </span>
    </div>
  );
}

// ---- Empty State ----

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      {icon && <div className="text-[#C5CDD4]">{icon}</div>}
      <div>
        <p className="text-[13px] font-semibold text-[#68737D]">{title}</p>
        {description && <p className="text-[12px] text-[#9AAAB5] mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ---- Alert Banner ----

interface AlertBannerProps {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  detail?: string;
}

export function AlertBanner({ type, message, detail }: AlertBannerProps) {
  const styles = {
    info: 'bg-[#EBF2F7] border-[#315D78] text-[#1A3D52]',
    warning: 'bg-[#FEF8E6] border-[#F5D78A] text-[#7A5400]',
    error: 'bg-[#FEF0EE] border-[#F4A9A4] text-[#8B1A12]',
    success: 'bg-[#EBF5EF] border-[#85C9A1] text-[#1A5433]',
  };
  const icons = {
    info: <Info size={14} className="flex-shrink-0 mt-0.5" />,
    warning: <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />,
    error: <XCircle size={14} className="flex-shrink-0 mt-0.5" />,
    success: <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />,
  };

  return (
    <div className={cn('flex gap-2 p-3 border-l-2 rounded-sm text-[12.5px]', styles[type])}>
      {icons[type]}
      <div>
        <p className="font-medium">{message}</p>
        {detail && <p className="mt-0.5 opacity-80">{detail}</p>}
      </div>
    </div>
  );
}

// ---- Tabs ----

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  return (
    <div className="flex border-b border-[#DDE2E6] bg-white">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'px-4 py-2.5 text-[12.5px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
            activeTab === tab.id
              ? 'border-[#315D78] text-[#315D78]'
              : 'border-transparent text-[#68737D] hover:text-[#20272E] hover:border-[#C5CDD4]'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'ml-1.5 text-[10.5px] px-1.5 py-0.5 rounded-full font-semibold',
              activeTab === tab.id ? 'bg-[#EBF2F7] text-[#315D78]' : 'bg-[#F4F5F6] text-[#68737D]'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---- Breadcrumb ----

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1 text-[11.5px]">
      {items.map((item, idx) => (
        <span key={idx} className="flex items-center gap-1">
          {idx > 0 && <ChevronRight size={11} className="text-[#C5CDD4]" />}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="text-[#315D78] hover:text-[#20272E] font-medium transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-[#68737D] font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ---- Spinner ----

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="animate-spin text-[#315D78]"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ---- Tooltip wrapper ----

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[11px] text-white bg-[#20272E] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 max-w-xs text-center">
        {content}
      </div>
    </div>
  );
}

// ---- Divider ----

export function Divider({ className }: { className?: string }) {
  return <div className={cn('border-t border-[#DDE2E6]', className)} />;
}

// ---- Label + Value pair for dense displays ----

export function DataPair({ label, value, className }: { label: string; value?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide">{label}</span>
      <span className="text-[12.5px] text-[#20272E]">{value ?? <span className="text-[#9AAAB5] italic text-[12px]">—</span>}</span>
    </div>
  );
}

// ---- Format utilities ----

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatNumber(val?: number, decimals = 2): string {
  if (val === undefined || val === null) return '—';
  return val.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ---- Priority badge ----

export function PriorityBadge({ priority }: { priority: Priority | string }) {
  return <StatusBadge status={priority} />;
}

// ---- Confirmation status badge ----

export function ConfirmationBadge({ status }: { status: ConfirmationStatus }) {
  return <StatusBadge status={status} />;
}

// ---- Approval status badge ----

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  return <StatusBadge status={status} />;
}

// ---- Scrollable pane ----

export function ScrollPane({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-y-auto', className)}>
      {children}
    </div>
  );
}

// ---- Progress bar ----

export function ProgressBar({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 80 ? '#2D7A4F' : pct >= 50 ? '#9A6A00' : '#B42318';
  return (
    <div className={cn('h-1.5 bg-[#DDE2E6] rounded-full overflow-hidden', className)}>
      <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all" />
    </div>
  );
}
