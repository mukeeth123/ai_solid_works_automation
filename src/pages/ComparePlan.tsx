// ============================================================
// VOLM Engineering Intelligence — Reuse & Comparison + Change Planner
// Evaluates all 10 equipment assemblies: 8 standard reuse + 2 modified
// Detailed compatibility, parameter differences, and change approvals
// ============================================================

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, AlertTriangle, Clock, Plus, Edit2, Trash2,
  ChevronRight, GitCompare, ThumbsUp, ThumbsDown, RotateCcw, Settings2,
  Layers, Box, ArrowRight, Shield, Check, Info, FileText, Sliders
} from 'lucide-react';
import {
  useStore, useActiveEnquiry, useEnquiryChanges, useAllFiles,
  useEquipmentComparisons, useMainAssemblyItems
} from '../store/appStore';
import { runComparison } from '../services/comparisonService';
import type { ProposedChange, ChangeOperation, ApprovalStatus, ComparisonResult } from '../types/engineering';
import {
  StatusBadge, MatchIcon, SectionPanel, EmptyState, AlertBanner, TabBar,
  cn, formatDate, formatDateTime, ScrollPane, ProgressBar, DataPair
} from '../components/shared';

const OPERATION_LABELS: Record<ChangeOperation, string> = {
  change_dimension: 'Change Dimension',
  change_parameter: 'Change Parameter',
  modify_feature: 'Modify Feature',
  add_feature: 'Add Feature',
  suppress_feature: 'Suppress Feature',
  update_configuration: 'Update Configuration',
  replace_component: 'Replace Component',
  manual_engineering: 'Manual Engineering',
};

const TABS = [
  { id: 'comparison', label: 'Reuse & Comparison (10 Assemblies)' },
  { id: 'changes', label: 'Change Planner' },
];

const CHANGE_FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'revision_requested', label: 'Revision Req.' },
];

function emptyChange(enquiryId: string): ProposedChange {
  return {
    id: `chg-${Date.now()}`,
    enquiryId,
    requirementId: '',
    targetFileId: '',
    targetConfiguration: '',
    targetFeatureId: '',
    targetParameterId: '',
    operation: 'change_dimension',
    currentValue: '',
    proposedValue: '',
    unit: '',
    reason: '',
    dependencies: [],
    expectedResult: '',
    requiredValidation: [],
    reviewer: '',
    approvalStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function ComparePlan() {
  const navigate = useNavigate();
  const { state, dispatch } = useStore();
  const enquiry = useActiveEnquiry();
  const changes = useEnquiryChanges(enquiry?.id);
  const allFiles = useAllFiles();
  const comparisons = useEquipmentComparisons();
  const mainItems = useMainAssemblyItems();

  const [activeTab, setActiveTab] = useState('comparison');
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string>('asm-001');
  const [assemblyFilter, setAssemblyFilter] = useState<'all' | 'standard_reuse' | 'modified'>('all');
  const [changeFilter, setChangeFilter] = useState('all');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [editingChange, setEditingChange] = useState<ProposedChange | null>(null);
  const [isAddingChange, setIsAddingChange] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');

  // Active comparison record for selected assembly
  const currentComparison: ComparisonResult | undefined = comparisons[selectedAssemblyId] || state.comparisonResults[0];
  const sourceAssembly = state.assemblies.find(a => a.id === selectedAssemblyId) || state.assemblies[0];
  const selectedRow = currentComparison?.rows.find(r => r.id === selectedRowId);
  const selectedChange = changes.find(c => c.id === selectedChangeId);

  const filteredChanges = useMemo(() => {
    if (changeFilter === 'all') return changes;
    return changes.filter(c => c.approvalStatus === changeFilter);
  }, [changes, changeFilter]);

  const changeCounts = useMemo(() => {
    const c: Record<string, number> = { all: changes.length };
    for (const ch of changes) { c[ch.approvalStatus] = (c[ch.approvalStatus] ?? 0) + 1; }
    return c;
  }, [changes]);

  const changeFilterTabs = CHANGE_FILTER_TABS.map(t => ({ ...t, count: changeCounts[t.id] ?? 0 }));

  // Filter assemblies in selection carousel
  const filteredAssemblies = useMemo(() => {
    return mainItems.filter(item => {
      if (assemblyFilter === 'all') return true;
      return item.category === assemblyFilter;
    });
  }, [mainItems, assemblyFilter]);

  function handleProposeChange(rowId: string) {
    if (!enquiry || !currentComparison) return;
    const row = currentComparison.rows.find(r => r.id === rowId);
    if (!row) return;
    const newChange: ProposedChange = {
      ...emptyChange(enquiry.id),
      requirementId: row.requirementId,
      targetFileId: row.sourceFileId,
      currentValue: row.currentValue ?? '',
      proposedValue: row.requiredValue ?? '',
      unit: row.unit ?? '',
      reason: `Resolving parameter difference for ${row.parameterName}.`,
    };
    setEditingChange(newChange);
    setIsAddingChange(true);
    setActiveTab('changes');
  }

  function handleSaveChange() {
    if (!editingChange || !enquiry) return;
    const now = new Date().toISOString();
    const updated = { ...editingChange, updatedAt: now };
    dispatch({ type: 'UPSERT_CHANGE', change: updated });
    dispatch({
      type: 'ADD_AUDIT_EVENT',
      event: {
        id: `audit-${Date.now()}`, timestamp: now, actor: state.currentUser,
        action: isAddingChange ? 'Change proposed' : 'Change updated',
        entityType: 'ProposedChange', entityId: updated.id,
        detail: `${updated.operation} on ${updated.targetFileId}: ${updated.currentValue} → ${updated.proposedValue}`,
        enquiryId: enquiry.id,
      }
    });
    setEditingChange(null);
    setIsAddingChange(false);
    setSelectedChangeId(updated.id);
  }

  function handleDeleteChange(changeId: string) {
    if (!confirm('Delete this proposed change?')) return;
    dispatch({ type: 'DELETE_CHANGE', changeId });
    if (selectedChangeId === changeId) setSelectedChangeId(null);
  }

  function handleApproval(changeId: string, status: ApprovalStatus) {
    dispatch({
      type: 'SET_CHANGE_APPROVAL',
      changeId,
      status,
      note: approvalNote || undefined,
      reviewer: state.currentUser,
    });
    dispatch({
      type: 'ADD_AUDIT_EVENT',
      event: {
        id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), actor: state.currentUser,
        action: `Change ${status}`,
        entityType: 'ProposedChange', entityId: changeId,
        detail: `${changeId} ${status} by ${state.currentUser}${approvalNote ? ': ' + approvalNote : ''}`,
        enquiryId: enquiry?.id ?? '',
      }
    });
    setApprovalNote('');
  }

  function handleExecute(changeId: string) {
    dispatch({ type: 'SET_SELECTED_CHANGE', id: changeId });
    navigate('/cad-change');
  }

  const OUTCOME_STYLES: Record<string, string> = {
    reuse_candidate: 'bg-[#EBF5EF] border-[#85C9A1] text-[#1A5433]',
    modify_candidate: 'bg-[#FEF8E6] border-[#F5D78A] text-[#7A5400]',
    new_design_required: 'bg-[#FEF0EE] border-[#F4A9A4] text-[#8B1A12]',
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#F4F5F6' }}>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Header */}
        <div className="bg-white border-b border-[#DDE2E6] px-5 py-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[11px] font-bold text-white bg-[#315D78] px-2 py-0.5 rounded-sm">
                  3. Reuse & Comparison
                </span>
                <span className="text-[12px] font-mono font-bold text-[#315D78] bg-[#EBF2F7] px-2 py-0.5 rounded">
                  {enquiry?.reference || 'ENQ-2025-0047'}
                </span>
                <h1 className="text-[14px] font-bold text-[#20272E]">
                  Component Reuse & Parameter Comparison
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">
                  10 Equipment Assemblies Evaluated
                </span>
              </div>
              <p className="text-[11.5px] text-[#68737D] mt-0.5">
                Demonstration Scenario: 8 Standard Direct Reuse Candidates (100% match) + 2 Modification Candidates (Parameter Delta).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button className="btn-secondary text-[11.5px]" onClick={() => navigate('/library')}>
                ← 2. Engineering Library
              </button>
              <button className="btn-primary text-[11.5px]" onClick={() => navigate('/cad-change')}>
                <Settings2 size={13} /> Proceed to 4. CAD Change Centre →
              </button>
              <button className="btn-secondary text-[11.5px]" onClick={() => navigate('/main-assembly')}>
                <Box size={13} /> 5. Main Assembly
              </button>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex-shrink-0 bg-[#F8FAFC] border-b border-[#DDE2E6] px-4 pt-1">
          <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {/* TAB 1: REUSE & COMPARISON */}
        {activeTab === 'comparison' && (
          <ScrollPane className="flex-1 p-4 space-y-4">
            {/* Top 10-Assemblies High-Level Status Dashboard */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-white border border-[#DDE2E6] rounded flex items-center gap-3 shadow-xs">
                <div className="w-9 h-9 rounded bg-[#DCFCE7] flex items-center justify-center text-[#16A34A] flex-shrink-0 font-bold">
                  8
                </div>
                <div>
                  <div className="text-[12px] font-bold text-[#166534]">Standard Reuse Candidates</div>
                  <div className="text-[10.5px] text-[#64748B]">100% compatible • Direct library reuse • Zero CAD modifications</div>
                </div>
              </div>

              <div className="p-3 bg-white border border-[#DDE2E6] rounded flex items-center gap-3 shadow-xs">
                <div className="w-9 h-9 rounded bg-[#FEF3C7] flex items-center justify-center text-[#D97706] flex-shrink-0 font-bold">
                  2
                </div>
                <div>
                  <div className="text-[12px] font-bold text-[#92400E]">Modification Candidates</div>
                  <div className="text-[10.5px] text-[#64748B]">Multi-Head Weigher (450mm chute) & VFFS Bagging Unit (600mm jaw width)</div>
                </div>
              </div>

              <div className="p-3 bg-white border border-[#DDE2E6] rounded flex items-center gap-3 shadow-xs">
                <div className="w-9 h-9 rounded bg-[#E0F2FE] flex items-center justify-center text-[#0284C7] flex-shrink-0 font-bold">
                  10
                </div>
                <div>
                  <div className="text-[12px] font-bold text-[#0369A1]">Main Assembly Integration</div>
                  <div className="text-[10.5px] text-[#64748B]">All 10 assemblies integrated into master skid coordinate frame</div>
                </div>
              </div>
            </div>

            {/* Assembly Selector Cards Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11.5px] font-bold text-[#20272E] uppercase tracking-wider flex items-center gap-2">
                  <Box size={13} className="text-[#315D78]" />
                  <span>Select Assembly to Inspect Parameter Comparison ({filteredAssemblies.length})</span>
                </div>

                {/* Filter Pills */}
                <div className="flex rounded border border-[#DDE2E6] p-0.5 bg-[#F4F5F6] text-[10.5px]">
                  <button
                    onClick={() => setAssemblyFilter('all')}
                    className={cn('px-2.5 py-0.5 rounded font-medium transition-colors', assemblyFilter === 'all' ? 'bg-white text-[#20272E] shadow-xs' : 'text-[#68737D] hover:text-[#20272E]')}
                  >
                    All (10)
                  </button>
                  <button
                    onClick={() => setAssemblyFilter('standard_reuse')}
                    className={cn('px-2.5 py-0.5 rounded font-medium transition-colors', assemblyFilter === 'standard_reuse' ? 'bg-white text-[#16A34A] shadow-xs' : 'text-[#68737D] hover:text-[#20272E]')}
                  >
                    Standard Reuse (8)
                  </button>
                  <button
                    onClick={() => setAssemblyFilter('modified')}
                    className={cn('px-2.5 py-0.5 rounded font-medium transition-colors', assemblyFilter === 'modified' ? 'bg-white text-[#D97706] shadow-xs' : 'text-[#68737D] hover:text-[#20272E]')}
                  >
                    Modification Required (2)
                  </button>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                {filteredAssemblies.map(item => {
                  const isSelected = item.assemblyRefId === selectedAssemblyId;
                  const isMod = item.category === 'modified';
                  const comp = comparisons[item.assemblyRefId];
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedAssemblyId(item.assemblyRefId)}
                      className={cn(
                        'p-2.5 rounded border text-[11px] cursor-pointer transition-all flex flex-col justify-between gap-1.5',
                        isSelected
                          ? 'bg-[#EBF2F7] border-[#315D78] shadow-sm ring-1 ring-[#315D78]'
                          : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={cn('font-mono font-bold truncate text-[11px]', isSelected ? 'text-[#1A3D6A]' : 'text-[#334155]')}>
                            {item.partNumber}
                          </span>
                          <span className={cn(
                            'px-1.5 py-0.2 rounded text-[8.5px] font-bold uppercase',
                            isMod ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#DCFCE7] text-[#166534]'
                          )}>
                            {isMod ? 'Modify' : '100% Reuse'}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#64748B] line-clamp-1">
                          {item.description}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[#F1F5F9] text-[9.5px] text-[#94A3B8]">
                        <span>Rev {item.revision}</span>
                        <span className="font-mono font-bold text-[#475569]">
                          {comp ? `${comp.coveragePercent}% Match` : '100% Match'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Selected Assembly Comparison Detail */}
            {currentComparison && (
              <div className="space-y-3">
                {/* Outcome Rationale Banner */}
                <div className={cn('p-4 border rounded shadow-xs', OUTCOME_STYLES[currentComparison.outcome])}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold">
                          {currentComparison.outcome === 'reuse_candidate' ? 'Standard Reuse Candidate (100% Verified)' : 'Engineering Modification Required'}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/70 border border-current">
                          {sourceAssembly?.fileName} (Rev {sourceAssembly?.revision})
                        </span>
                      </div>
                      <p className="text-[12px] mt-1 opacity-90 leading-relaxed">
                        {currentComparison.outcomeRationale}
                      </p>
                    </div>

                    <div className="flex gap-4 text-center flex-shrink-0">
                      <div>
                        <p className="text-[16px] font-bold text-[#16A34A]">{currentComparison.matchCount}</p>
                        <p className="text-[10.5px] opacity-80">Direct Match</p>
                      </div>
                      <div>
                        <p className="text-[16px] font-bold text-[#B42318]">{currentComparison.mismatchCount}</p>
                        <p className="text-[10.5px] opacity-80">Differences</p>
                      </div>
                      <div>
                        <p className="text-[16px] font-bold text-[#0284C7]">{currentComparison.coveragePercent}%</p>
                        <p className="text-[10.5px] opacity-80">Compatibility</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Comparison Table */}
                <div className="eng-panel">
                  <div className="eng-panel-header flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitCompare size={13} className="text-[#315D78]" />
                      <span className="eng-panel-title">
                        Requirement vs CAD Parameter Matrix ({currentComparison.rows.length} Parameters Evaluated)
                      </span>
                    </div>

                    {currentComparison.outcome === 'modify_candidate' && (
                      <button
                        onClick={() => navigate('/cad-change')}
                        className="btn-primary py-1 px-2.5 text-[11px] flex items-center gap-1.5"
                      >
                        <Settings2 size={12} />
                        <span>Inspect in CAD Change Centre</span>
                      </button>
                    )}
                  </div>

                  <table className="eng-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Req ID</th>
                        <th>Parameter Name</th>
                        <th>Baseline Model Value</th>
                        <th>Project Required Value</th>
                        <th>Unit</th>
                        <th>Variance</th>
                        <th>Engineering Evaluation / Findings</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentComparison.rows.map(row => (
                        <tr
                          key={row.id}
                          className={cn(
                            'cursor-pointer',
                            row.matchStatus === 'match' ? 'bg-[#F7FCF9] hover:bg-[#F0F9F3]' :
                            row.matchStatus === 'mismatch' ? 'bg-[#FFF8F7] hover:bg-[#FFF0EE]' :
                            'bg-[#FFFDF0] hover:bg-[#FFFBE0]'
                          )}
                          onClick={() => setSelectedRowId(row.id === selectedRowId ? null : row.id)}
                        >
                          <td><MatchIcon status={row.matchStatus} /></td>
                          <td className="font-mono text-[11px] text-[#315D78] font-bold">{row.requirementId}</td>
                          <td className="font-semibold text-[#20272E]">{row.parameterName}</td>
                          <td className="font-mono">
                            {row.currentValue !== undefined ? String(row.currentValue) : <span className="text-[#9AAAB5]">—</span>}
                          </td>
                          <td className="font-mono font-bold text-[#1A3D6A]">
                            {row.requiredValue !== undefined ? String(row.requiredValue) : <span className="text-[#9AAAB5]">—</span>}
                          </td>
                          <td className="text-[#68737D] font-mono text-[10.5px]">{row.unit ?? '—'}</td>
                          <td className={cn(
                            'font-mono font-bold',
                            typeof row.difference === 'number' && row.difference !== 0 ? 'text-[#B42318]' : 'text-[#16A34A]'
                          )}>
                            {row.difference !== undefined
                              ? (typeof row.difference === 'number' ? `${row.difference > 0 ? '+' : ''}${row.difference}` : row.difference)
                              : '0 (Exact)'}
                          </td>
                          <td className="text-[11px] text-[#475569] max-w-xs">{row.engineeringNote ?? '—'}</td>
                          <td>
                            {row.matchStatus === 'mismatch' && (
                              <button
                                className="btn-secondary py-0.5 px-2 text-[10.5px] flex items-center gap-1 text-[#315D78]"
                                onClick={e => { e.stopPropagation(); handleProposeChange(row.id); }}
                              >
                                <Plus size={10} /> Propose Change
                              </button>
                            )}
                            {row.matchStatus === 'match' && (
                              <span className="text-[10px] text-[#16A34A] font-semibold flex items-center gap-1">
                                <Check size={11} /> Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </ScrollPane>
        )}

        {/* TAB 2: CHANGE PLANNER */}
        {activeTab === 'changes' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Filter toolbar */}
            <div className="bg-white border-b border-[#DDE2E6] px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0">
              <TabBar tabs={changeFilterTabs} activeTab={changeFilter} onChange={setChangeFilter} />
              <button
                className="btn-primary py-1 px-3 text-xs flex items-center gap-1.5"
                onClick={() => {
                  if (!enquiry) return;
                  setEditingChange(emptyChange(enquiry.id));
                  setIsAddingChange(true);
                }}
              >
                <Plus size={12} /> Propose New Change
              </button>
            </div>

            <ScrollPane className="flex-1 p-4 space-y-3">
              {/* Add / Edit Form */}
              {editingChange && (
                <div className="eng-panel border-[#315D78] shadow-md">
                  <div className="eng-panel-header bg-[#EBF2F7] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Edit2 size={13} className="text-[#315D78]" />
                      <span className="eng-panel-title text-[#315D78]">
                        {isAddingChange ? 'Propose Engineering Change' : 'Edit Proposed Change'}
                      </span>
                    </div>
                    <button
                      onClick={() => setEditingChange(null)}
                      className="text-[#68737D] hover:text-[#20272E] text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="p-4 grid grid-cols-2 gap-3 text-[11.5px]">
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Operation *</label>
                      <select
                        className="eng-select w-full"
                        value={editingChange.operation}
                        onChange={e => setEditingChange({ ...editingChange, operation: e.target.value as ChangeOperation })}
                      >
                        {Object.entries(OPERATION_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Target Engineering File *</label>
                      <select
                        className="eng-select w-full"
                        value={editingChange.targetFileId}
                        onChange={e => setEditingChange({ ...editingChange, targetFileId: e.target.value })}
                      >
                        <option value="">Select target file…</option>
                        {allFiles.map(f => (
                          <option key={f.id} value={f.id}>{f.fileName} (Rev {f.revision})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Current Baseline Value</label>
                      <input
                        className="eng-input"
                        value={editingChange.currentValue !== undefined ? String(editingChange.currentValue) : ''}
                        onChange={e => setEditingChange({ ...editingChange, currentValue: e.target.value })}
                        placeholder="Current value"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Proposed Value & Unit *</label>
                      <div className="flex gap-2">
                        <input
                          className="eng-input flex-1"
                          value={String(editingChange.proposedValue)}
                          onChange={e => setEditingChange({ ...editingChange, proposedValue: e.target.value })}
                          placeholder="Proposed value"
                        />
                        <input
                          className="eng-input w-24"
                          value={editingChange.unit ?? ''}
                          onChange={e => setEditingChange({ ...editingChange, unit: e.target.value })}
                          placeholder="Unit"
                        />
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Engineering Justification / Reason *</label>
                      <textarea
                        className="eng-input w-full h-16 py-1.5"
                        value={editingChange.reason}
                        onChange={e => setEditingChange({ ...editingChange, reason: e.target.value })}
                        placeholder="Explain technical necessity, duty point calculation, or safety rules..."
                      />
                    </div>

                    <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-[#DDE2E6]">
                      <button className="btn-secondary" onClick={() => setEditingChange(null)}>
                        Cancel
                      </button>
                      <button className="btn-primary" onClick={handleSaveChange}>
                        Save Proposed Change
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Changes List */}
              <div className="space-y-3">
                {filteredChanges.map(change => {
                  const targetFile = allFiles.find(f => f.id === change.targetFileId);
                  const isSelected = change.id === selectedChangeId;
                  return (
                    <div
                      key={change.id}
                      className={cn(
                        'p-4 bg-white border rounded shadow-xs space-y-3 transition-all',
                        isSelected ? 'border-[#315D78] ring-1 ring-[#315D78]' : 'border-[#DDE2E6]'
                      )}
                    >
                      {/* Change Top Header */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-[13px] text-[#1A3D6A]">
                            {change.id.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EBF2F7] text-[#315D78] uppercase border border-[#CBD5E1]">
                            {OPERATION_LABELS[change.operation]}
                          </span>
                          <span className="text-[12px] font-mono text-[#334155]">
                            Target: <strong>{targetFile?.fileName ?? change.targetFileId}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge status={change.approvalStatus} />

                          {change.approvalStatus === 'approved' && (
                            <button
                              onClick={() => handleExecute(change.id)}
                              className="px-2.5 py-1 rounded bg-[#238636] text-white hover:bg-[#2EA043] text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <Settings2 size={12} /> Execute CAD Rebuild
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Delta Spec Banner */}
                      <div className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded flex items-center justify-between text-[11.5px]">
                        <div>
                          <span className="text-[#64748B]">Parameter Delta: </span>
                          <span className="font-mono font-semibold text-[#64748B] line-through mr-2">
                            {change.currentValue ? String(change.currentValue) : 'Baseline'}
                          </span>
                          <span className="font-mono font-bold text-[#16A34A] text-[12px]">
                            {String(change.proposedValue)} {change.unit}
                          </span>
                        </div>

                        <div className="text-[11px] text-[#64748B]">
                          Req Link: <strong className="font-mono text-[#315D78]">{change.requirementId || 'Project Brief'}</strong>
                        </div>
                      </div>

                      <div className="text-[12px] text-[#334155]">
                        <strong>Reason:</strong> {change.reason}
                      </div>

                      {/* Dependencies & Impacts Breakdown */}
                      {change.dependencies && change.dependencies.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10.5px] font-bold text-[#64748B] uppercase tracking-wider">
                            Traceable Downstream Dependencies ({change.dependencies.length})
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {change.dependencies.map((dep, idx) => (
                              <div key={idx} className="p-2 bg-[#F1F5F9] border border-[#CBD5E1] rounded text-[10.5px] flex items-center gap-1.5 text-[#334155]">
                                <ChevronRight size={12} className="text-[#315D78] flex-shrink-0" />
                                <span>{dep.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Engineer Approval Controls */}
                      <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between gap-3">
                        <div className="text-[11px] text-[#64748B] flex items-center gap-2">
                          <span>Reviewer: <strong>{change.reviewer || 'Pending Assignment'}</strong></span>
                          {change.approvedAt && <span>• Approved at {formatDate(change.approvedAt)}</span>}
                          {change.approvalNote && <span>• Note: <em>"{change.approvalNote}"</em></span>}
                        </div>

                        {change.approvalStatus !== 'approved' && (
                          <div className="flex items-center gap-1.5">
                            <input
                              className="eng-input py-1 text-[11px] w-48"
                              placeholder="Reviewer note..."
                              value={approvalNote}
                              onChange={e => setApprovalNote(e.target.value)}
                            />
                            <button
                              onClick={() => handleApproval(change.id, 'approved')}
                              className="px-2.5 py-1 rounded bg-[#238636] text-white hover:bg-[#2EA043] text-[11px] font-semibold flex items-center gap-1 transition-colors"
                            >
                              <ThumbsUp size={11} /> Approve
                            </button>
                            <button
                              onClick={() => handleApproval(change.id, 'revision_requested')}
                              className="px-2.5 py-1 rounded bg-[#D97706] text-white hover:bg-[#B45309] text-[11px] font-semibold flex items-center gap-1 transition-colors"
                            >
                              Request Rev
                            </button>
                            <button
                              onClick={() => handleApproval(change.id, 'rejected')}
                              className="px-2 py-1 rounded bg-[#EF4444] text-white hover:bg-[#DC2626] text-[11px] font-semibold transition-colors"
                            >
                              <ThumbsDown size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollPane>
          </div>
        )}
      </div>
    </div>
  );
}
