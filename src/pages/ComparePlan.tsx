import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, AlertTriangle, Clock, Plus, Edit2, Trash2,
  ChevronRight, GitCompare, ThumbsUp, ThumbsDown, RotateCcw, Settings2, Layers
} from 'lucide-react';
import { useStore, useActiveEnquiry, useEnquiryChanges, useEnquiryComparison, useAllFiles } from '../store/appStore';
import { runComparison } from '../services/comparisonService';
import type { ProposedChange, ChangeOperation, ApprovalStatus } from '../types/engineering';
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
  { id: 'comparison', label: 'Comparison' },
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
  const comparison = useEnquiryComparison(enquiry?.id);
  const allFiles = useAllFiles();

  const [activeTab, setActiveTab] = useState('comparison');
  const [changeFilter, setChangeFilter] = useState('all');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [editingChange, setEditingChange] = useState<ProposedChange | null>(null);
  const [isAddingChange, setIsAddingChange] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');

  const sourceFile = comparison ? allFiles.find(f => f.id === comparison.sourceFileId) : null;
  const selectedRow = comparison?.rows.find(r => r.id === selectedRowId);
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

  function handleProposeChange(rowId: string) {
    if (!enquiry) return;
    const row = comparison?.rows.find(r => r.id === rowId);
    if (!row) return;
    const newChange = { ...emptyChange(enquiry.id), requirementId: row.requirementId, targetFileId: row.sourceFileId };
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
      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-[#DDE2E6] px-5 py-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {enquiry && <span className="text-[11px] font-bold text-[#315D78] bg-[#EBF2F7] px-2 py-0.5 rounded-sm">{enquiry.reference}</span>}
                {sourceFile && <span className="text-[12px] font-medium text-[#20272E]">{sourceFile.fileName}</span>}
                {comparison && <StatusBadge status={comparison.outcome} />}
              </div>
              <p className="text-[12px] text-[#68737D] mt-0.5">
                {comparison ? `Compared ${formatDate(comparison.comparedAt)}` : 'No comparison available'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-secondary" onClick={() => navigate('/library')}>
                <Layers size={13} /> Library
              </button>
              <button className="btn-primary" onClick={() => navigate('/cad-change')}>
                <Settings2 size={13} /> CAD Change Centre
              </button>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0">
          <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {activeTab === 'comparison' && (
          <ScrollPane className="flex-1 p-4 space-y-3">
            {!comparison && (
              <div className="eng-panel p-6 text-center space-y-3">
                <GitCompare size={28} className="mx-auto text-[#315D78]" />
                <h3 className="font-bold text-[14px] text-[#20272E]">Ready to Run Parameter Comparison</h3>
                <p className="text-[12px] text-[#68737D] max-w-md mx-auto">
                  Compare requirements from <strong>{enquiry?.reference}</strong> against candidate assembly <strong>PUMP_UNIT_STD_A.SLDASM</strong> to determine reusability.
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    className="btn-primary"
                    onClick={() => {
                      if (!enquiry) return;
                      const candidate = allFiles.find(f => f.id === enquiry.selectedCandidateId) || allFiles.find(f => f.fileType === 'SLDASM') || allFiles[0];
                      if (candidate) {
                        const cmp = runComparison(enquiry, candidate);
                        dispatch({ type: 'UPSERT_COMPARISON', result: cmp });
                      }
                    }}
                  >
                    <GitCompare size={13} /> Run Comparison with Candidate Assembly
                  </button>
                  <button className="btn-secondary" onClick={() => navigate('/library')}>
                    <Layers size={13} /> Browse Library
                  </button>
                </div>
              </div>
            )}

            {comparison && (
              <>
                {/* Outcome Summary */}
                <div className={cn('p-4 border rounded-sm', OUTCOME_STYLES[comparison.outcome])}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[13px] font-bold">{comparison.outcome === 'reuse_candidate' ? 'Reuse Candidate' : comparison.outcome === 'modify_candidate' ? 'Modify Candidate' : 'New Design Required'}</p>
                      <p className="text-[12px] mt-1 opacity-90">{comparison.outcomeRationale}</p>
                    </div>
                    <div className="flex gap-4 text-center flex-shrink-0">
                      {[['Match', comparison.matchCount, '#2D7A4F'], ['Mismatch', comparison.mismatchCount, '#B42318'], ['Unknown', comparison.unknownCount, '#68737D']].map(([l, v, c]) => (
                        <div key={String(l)}>
                          <p className="text-[16px] font-bold" style={{ color: String(c) }}>{v}</p>
                          <p className="text-[10.5px] opacity-80">{l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-medium opacity-80">Coverage</span>
                      <span className="text-[11px] font-bold">{comparison.coveragePercent}%</span>
                    </div>
                    <ProgressBar value={comparison.coveragePercent} />
                  </div>
                </div>

                {/* Two-column header */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="eng-panel p-3">
                    <p className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide mb-1">Source Design</p>
                    <p className="text-[12.5px] font-semibold text-[#20272E]">{sourceFile?.fileName ?? comparison.sourceFileId}</p>
                    <p className="text-[11.5px] text-[#68737D]">{sourceFile?.partNumber} · Rev {sourceFile?.revision}</p>
                  </div>
                  <div className="eng-panel p-3">
                    <p className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide mb-1">Enquiry Requirements</p>
                    <p className="text-[12.5px] font-semibold text-[#20272E]">{enquiry?.reference}</p>
                    <p className="text-[11.5px] text-[#68737D]">{enquiry?.requirements.length} requirements · {enquiry?.requirements.filter(r => r.status === 'confirmed').length} confirmed</p>
                  </div>
                </div>

                {/* Comparison Table */}
                <div className="eng-panel">
                  <div className="eng-panel-header">
                    <GitCompare size={13} className="text-[#315D78]" />
                    <span className="eng-panel-title">Parameter Comparison</span>
                  </div>
                  <table className="eng-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Req ID</th>
                        <th>Parameter</th>
                        <th>Source File</th>
                        <th>Current Value</th>
                        <th>Required Value</th>
                        <th>Unit</th>
                        <th>Difference</th>
                        <th>Status</th>
                        <th>Note</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.rows.map(row => (
                        <tr
                          key={row.id}
                          className={cn('cursor-pointer',
                            row.matchStatus === 'match' ? 'bg-[#F7FCF9] hover:bg-[#F0F9F3]' :
                            row.matchStatus === 'mismatch' ? 'bg-[#FFF8F7] hover:bg-[#FFF0EE]' :
                            row.matchStatus === 'review_required' ? 'bg-[#FFFDF0] hover:bg-[#FFFBE0]' : '',
                            selectedRowId === row.id ? 'ring-1 ring-[#315D78]' : ''
                          )}
                          onClick={() => setSelectedRowId(row.id === selectedRowId ? null : row.id)}
                        >
                          <td><MatchIcon status={row.matchStatus} /></td>
                          <td className="font-mono text-[11px] text-[#315D78]">{row.requirementId}</td>
                          <td className="font-medium">{row.parameterName}</td>
                          <td className="text-[11px] text-[#68737D]">{allFiles.find(f => f.id === row.sourceFileId)?.partNumber ?? row.sourceFileId}</td>
                          <td className="font-mono">{row.currentValue !== undefined ? String(row.currentValue) : <span className="text-[#9AAAB5]">—</span>}</td>
                          <td className="font-mono font-bold">{row.requiredValue !== undefined ? String(row.requiredValue) : <span className="text-[#9AAAB5]">—</span>}</td>
                          <td className="text-[#68737D]">{row.unit ?? '—'}</td>
                          <td className={cn('font-mono font-bold', typeof row.difference === 'number' && row.difference !== 0 ? 'text-[#B42318]' : '')}>
                            {row.difference !== undefined ? (typeof row.difference === 'number' ? `${row.difference > 0 ? '+' : ''}${row.difference}` : row.difference) : '—'}
                          </td>
                          <td><StatusBadge status={row.matchStatus} /></td>
                          <td className="text-[11px] text-[#68737D] max-w-[140px] truncate">{row.engineeringNote ?? '—'}</td>
                          <td>
                            {(row.matchStatus === 'mismatch' || row.matchStatus === 'unknown' || row.matchStatus === 'review_required') && (
                              <button
                                className="btn-ghost py-0.5 px-2 text-[11px]"
                                onClick={e => { e.stopPropagation(); handleProposeChange(row.id); }}
                              >
                                <Plus size={11} /> Change
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Selected row detail */}
                {selectedRow && (
                  <div className="eng-panel p-3 border-[#315D78]">
                    <div className="flex items-center gap-2 mb-2">
                      <MatchIcon status={selectedRow.matchStatus} />
                      <span className="text-[12.5px] font-semibold text-[#20272E]">{selectedRow.parameterName}</span>
                      <StatusBadge status={selectedRow.matchStatus} />
                    </div>
                    {selectedRow.sourceEvidence && (
                      <p className="text-[11.5px] text-[#68737D] mb-1"><strong>Evidence:</strong> {selectedRow.sourceEvidence}</p>
                    )}
                    {selectedRow.engineeringNote && (
                      <p className="text-[11.5px] text-[#20272E]"><strong>Note:</strong> {selectedRow.engineeringNote}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </ScrollPane>
        )}

        {activeTab === 'changes' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="bg-white border-b border-[#DDE2E6] px-4 py-2 flex items-center gap-3 flex-shrink-0">
              <TabBar tabs={changeFilterTabs} activeTab={changeFilter} onChange={setChangeFilter} />
              <button className="btn-primary ml-auto py-1 px-3 text-xs" onClick={() => { if (!enquiry) return; setEditingChange(emptyChange(enquiry.id)); setIsAddingChange(true); }}>
                <Plus size={12} /> Add Change
              </button>
            </div>
            <ScrollPane className="flex-1 p-4">
              {/* Add/Edit Form */}
              {editingChange && (
                <div className="eng-panel mb-3 border-[#315D78]">
                  <div className="eng-panel-header bg-[#EBF2F7]">
                    <Edit2 size={12} className="text-[#315D78]" />
                    <span className="eng-panel-title text-[#315D78]">{isAddingChange ? 'Propose Change' : 'Edit Change'}</span>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Operation *</label>
                      <select className="eng-select w-full" value={editingChange.operation} onChange={e => setEditingChange({ ...editingChange, operation: e.target.value as ChangeOperation })}>
                        {Object.entries(OPERATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Target File *</label>
                      <select className="eng-select w-full" value={editingChange.targetFileId} onChange={e => setEditingChange({ ...editingChange, targetFileId: e.target.value })}>
                        <option value="">Select file…</option>
                        {allFiles.map(f => <option key={f.id} value={f.id}>{f.fileName} (Rev {f.revision})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Target Configuration</label>
                      <input className="eng-input" value={editingChange.targetConfiguration ?? ''} onChange={e => setEditingChange({ ...editingChange, targetConfiguration: e.target.value })} placeholder="Config name" />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Requirement ID</label>
                      <select className="eng-select w-full" value={editingChange.requirementId} onChange={e => setEditingChange({ ...editingChange, requirementId: e.target.value })}>
                        <option value="">Select requirement…</option>
                        {enquiry?.requirements.map(r => <option key={r.id} value={r.id}>{r.id}: {r.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Current Value</label>
                      <input className="eng-input" value={editingChange.currentValue !== undefined ? String(editingChange.currentValue) : ''} onChange={e => setEditingChange({ ...editingChange, currentValue: e.target.value })} placeholder="Current" />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Proposed Value *</label>
                      <div className="flex gap-2">
                        <input className="eng-input flex-1" value={String(editingChange.proposedValue)} onChange={e => setEditingChange({ ...editingChange, proposedValue: e.target.value })} placeholder="Proposed" />
                        <input className="eng-input w-20" value={editingChange.unit ?? ''} onChange={e => setEditingChange({ ...editingChange, unit: e.target.value })} placeholder="Unit" />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Reason *</label>
                      <textarea className="eng-input" rows={2} value={editingChange.reason} onChange={e => setEditingChange({ ...editingChange, reason: e.target.value })} placeholder="Engineering rationale for this change" />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Expected Result</label>
                      <input className="eng-input" value={editingChange.expectedResult} onChange={e => setEditingChange({ ...editingChange, expectedResult: e.target.value })} placeholder="Expected outcome" />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1">Reviewer</label>
                      <input className="eng-input" value={editingChange.reviewer ?? ''} onChange={e => setEditingChange({ ...editingChange, reviewer: e.target.value })} placeholder="Reviewer name" />
                    </div>
                    <div className="col-span-2 flex gap-2 pt-1">
                      <button className="btn-primary" onClick={handleSaveChange}><ChevronRight size={12} /> Save Change</button>
                      <button className="btn-secondary" onClick={() => { setEditingChange(null); setIsAddingChange(false); }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Changes table */}
              <div className="eng-panel">
                <table className="eng-table">
                  <thead>
                    <tr>
                      <th>Change ID</th>
                      <th>Operation</th>
                      <th>Target File</th>
                      <th>Change</th>
                      <th>Approval</th>
                      <th>Reviewer</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChanges.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-[#9AAAB5] text-[12px]">No proposed changes.</td></tr>
                    )}
                    {filteredChanges.map(change => (
                      <tr
                        key={change.id}
                        className={cn('cursor-pointer', selectedChangeId === change.id ? 'selected' : '')}
                        onClick={() => setSelectedChangeId(change.id === selectedChangeId ? null : change.id)}
                      >
                        <td className="font-mono text-[11px] text-[#315D78]">{change.id}</td>
                        <td className="text-[11.5px]">{OPERATION_LABELS[change.operation]}</td>
                        <td className="text-[11.5px] max-w-[140px] truncate">{allFiles.find(f => f.id === change.targetFileId)?.fileName ?? change.targetFileId}</td>
                        <td className="font-mono text-[12px]">
                          <span className="text-[#68737D]">{change.currentValue !== undefined ? String(change.currentValue) : '—'}</span>
                          <span className="mx-1 text-[#9AAAB5]">→</span>
                          <span className="font-bold text-[#20272E]">{String(change.proposedValue)}</span>
                          {change.unit && <span className="text-[#68737D] ml-1">{change.unit}</span>}
                        </td>
                        <td><StatusBadge status={change.approvalStatus} /></td>
                        <td className="text-[11.5px] text-[#68737D]">{change.reviewer ?? '—'}</td>
                        <td>
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button className="btn-ghost p-1" onClick={() => { setEditingChange({ ...change }); setIsAddingChange(false); }} title="Edit"><Edit2 size={12} /></button>
                            <button className="btn-ghost p-1 text-[#B42318]" onClick={() => handleDeleteChange(change.id)} title="Delete"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Selected change inspector */}
              {selectedChange && !editingChange && (
                <div className="eng-panel mt-3">
                  <div className="eng-panel-header">
                    <Settings2 size={12} className="text-[#315D78]" />
                    <span className="eng-panel-title">Change Details — {selectedChange.id}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <StatusBadge status={selectedChange.approvalStatus} />
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
                    <div><DataPair label="Operation" value={OPERATION_LABELS[selectedChange.operation]} /></div>
                    <div><DataPair label="Target File" value={allFiles.find(f => f.id === selectedChange.targetFileId)?.fileName ?? selectedChange.targetFileId} /></div>
                    <div><DataPair label="Configuration" value={selectedChange.targetConfiguration || '—'} /></div>
                    <div><DataPair label="Reviewer" value={selectedChange.reviewer || '—'} /></div>
                    <div className="col-span-2">
                      <p className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide mb-1">Change</p>
                      <div className="flex items-center gap-2 font-mono text-[13px]">
                        <span className="text-[#68737D]">{selectedChange.currentValue !== undefined ? String(selectedChange.currentValue) : '(none)'}</span>
                        <span className="text-[#9AAAB5]">→</span>
                        <span className="font-bold text-[#315D78]">{String(selectedChange.proposedValue)}</span>
                        {selectedChange.unit && <span className="text-[#68737D]">{selectedChange.unit}</span>}
                      </div>
                    </div>
                    <div className="col-span-2"><DataPair label="Reason" value={selectedChange.reason} /></div>
                    <div className="col-span-2"><DataPair label="Expected Result" value={selectedChange.expectedResult} /></div>
                    {selectedChange.requiredValidation.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide mb-1">Required Validation</p>
                        <ul className="space-y-1">
                          {selectedChange.requiredValidation.map((v, i) => <li key={i} className="flex items-start gap-1.5 text-[12px]"><ChevronRight size={12} className="text-[#315D78] mt-0.5 flex-shrink-0" />{v}</li>)}
                        </ul>
                      </div>
                    )}
                    {selectedChange.dependencies.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide mb-1">Dependencies ({selectedChange.dependencies.length})</p>
                        <ul className="space-y-1">
                          {selectedChange.dependencies.map((dep, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[11.5px]">
                              <AlertTriangle size={11} className={dep.isKnown ? 'text-[#9A6A00] mt-0.5' : 'text-[#B42318] mt-0.5'} />
                              <span className={dep.isKnown ? 'text-[#20272E]' : 'text-[#B42318]'}>{dep.description}</span>
                              {!dep.isKnown && <span className="text-[10px] text-[#B42318] font-semibold">(Unknown)</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Approval/Rejection actions */}
                    <div className="col-span-2 border-t border-[#EEF1F4] pt-3 mt-1">
                      <p className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide mb-2">Review Action</p>
                      <textarea
                        className="eng-input mb-2"
                        rows={2}
                        placeholder="Approval note (optional)…"
                        value={approvalNote}
                        onChange={e => setApprovalNote(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          className="btn-primary flex-1"
                          onClick={() => handleApproval(selectedChange.id, 'approved')}
                        >
                          <ThumbsUp size={12} /> Approve
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => handleApproval(selectedChange.id, 'revision_requested')}
                        >
                          <RotateCcw size={12} /> Revision
                        </button>
                        <button
                          className="btn-danger"
                          onClick={() => handleApproval(selectedChange.id, 'rejected')}
                        >
                          <ThumbsDown size={12} /> Reject
                        </button>
                        {selectedChange.approvalStatus === 'approved' && (
                          <button className="btn-primary" onClick={() => handleExecute(selectedChange.id)}>
                            <Settings2 size={12} /> Execute
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ScrollPane>
          </div>
        )}
      </div>
    </div>
  );
}
