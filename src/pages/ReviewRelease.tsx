import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, CheckCircle, XCircle, AlertTriangle, Clock,
  FileText, Download, RefreshCw, Send, Layers, Edit2, Plus,
  Shield, Info, ChevronRight, Check, ArrowRight
} from 'lucide-react';
import { useStore, useActiveEnquiry, useAllFiles } from '../store/appStore';
import { exportBOMasCSV, exportChangeSummaryJSON } from '../services/exportService';
import { generateBOMFromAssembly } from '../services/comparisonService';
import type {
  EngineeringReview, ValidationCheck, DrawingReview,
  BOM, BOMItem, ReviewerDecision, ValidationStatus
} from '../types/engineering';
import {
  StatusBadge, ValidationIcon, SectionPanel, EmptyState,
  AlertBanner, TabBar, cn, formatDate, formatDateTime,
  ScrollPane, ProgressBar, DataPair
} from '../components/shared';

const REVIEW_TABS = [
  { id: 'checks', label: 'Validation Checks' },
  { id: 'drawings', label: 'Drawing Review' },
  { id: 'bom', label: 'BOM Validation' },
  { id: 'handoff', label: 'Downstream Hand-off' },
];

export default function ReviewRelease() {
  const navigate = useNavigate();
  const { state, dispatch } = useStore();
  const enquiry = useActiveEnquiry();
  const allFiles = useAllFiles();

  const [activeTab, setActiveTab] = useState('checks');
  const [filterCheckStatus, setFilterCheckStatus] = useState<string>('all');
  const [newDecisionReviewer, setNewDecisionReviewer] = useState(state.currentUser);
  const [newDecisionType, setNewDecisionType] = useState<'approved' | 'rejected' | 'revision_requested'>('approved');
  const [newDecisionComment, setNewDecisionComment] = useState('');
  const [newDecisionScope, setNewDecisionScope] = useState('Full Assembly Scope');

  const review: EngineeringReview = state.reviews[0];
  const bom: BOM = state.boms[0];
  const sourceAssembly = state.assemblies.find(a => a.id === review?.sourceFileId);

  // Statistics
  const checkStats = useMemo(() => {
    const list = review?.validationChecks || [];
    return {
      total: list.length,
      passed: list.filter(c => c.status === 'passed').length,
      failed: list.filter(c => c.status === 'failed').length,
      reviewReq: list.filter(c => c.status === 'review_required').length,
      notRun: list.filter(c => c.status === 'not_run').length,
    };
  }, [review]);

  const filteredChecks = useMemo(() => {
    if (!review) return [];
    if (filterCheckStatus === 'all') return review.validationChecks;
    return review.validationChecks.filter(c => c.status === filterCheckStatus);
  }, [review, filterCheckStatus]);

  // Handle Check Status updates
  const handleUpdateCheckStatus = (checkId: string, newStatus: ValidationStatus) => {
    if (!review) return;
    const updatedChecks = review.validationChecks.map(chk =>
      chk.id === checkId ? { ...chk, status: newStatus, timestamp: new Date().toISOString() } : chk
    );
    const updatedReview: EngineeringReview = {
      ...review,
      validationChecks: updatedChecks,
      updatedAt: new Date().toISOString()
    };
    dispatch({ type: 'UPSERT_REVIEW', review: updatedReview });
  };

  // Handle Add Review Decision
  const handleAddDecision = () => {
    if (!review || !newDecisionComment.trim()) return;
    const now = new Date().toISOString();
    const newDecision: ReviewerDecision = {
      id: `rd-${Date.now()}`,
      reviewer: newDecisionReviewer,
      decision: newDecisionType,
      comment: newDecisionComment,
      timestamp: now,
      scope: newDecisionScope,
    };

    const updatedDecisions = [...review.reviewerDecisions, newDecision];
    const isReadyForRelease = newDecisionType === 'approved' && checkStats.failed === 0;

    const updatedReview: EngineeringReview = {
      ...review,
      reviewerDecisions: updatedDecisions,
      releaseReadiness: isReadyForRelease ? 'approved_for_release' : review.releaseReadiness,
      updatedAt: now,
    };

    dispatch({ type: 'UPSERT_REVIEW', review: updatedReview });
    dispatch({
      type: 'ADD_AUDIT_EVENT',
      event: {
        id: `audit-${Date.now()}`,
        timestamp: now,
        actor: newDecisionReviewer,
        action: `Engineering Review Decision: ${newDecisionType.toUpperCase()}`,
        entityType: 'EngineeringReview',
        entityId: review.id,
        detail: newDecisionComment,
        enquiryId: enquiry?.id,
      }
    });

    setNewDecisionComment('');
  };

  // BOM Actions
  const handleExportBOM = () => {
    if (!bom) return;
    exportBOMasCSV(bom, bom.items);
  };

  const handleExportJSON = () => {
    if (!enquiry || !review) return;
    exportChangeSummaryJSON(enquiry, state.proposedChanges, state.executions, review);
  };

  const handleRegenerateBOM = () => {
    if (!sourceAssembly || !enquiry) return;
    const freshBOM = generateBOMFromAssembly(sourceAssembly, enquiry.id);
    dispatch({ type: 'UPSERT_BOM', bom: freshBOM });
    dispatch({
      type: 'ADD_AUDIT_EVENT',
      event: {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: state.currentUser,
        action: 'BOM Regenerated',
        entityType: 'BOM',
        entityId: freshBOM.id,
        detail: `Regenerated from assembly ${sourceAssembly.fileName}`,
        enquiryId: enquiry.id,
      }
    });
  };

  const handleSetReadiness = (readiness: EngineeringReview['releaseReadiness']) => {
    if (!review) return;
    const updatedReview: EngineeringReview = {
      ...review,
      releaseReadiness: readiness,
      updatedAt: new Date().toISOString()
    };
    dispatch({ type: 'UPSERT_REVIEW', review: updatedReview });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#F4F5F6' }}>
      {/* Top Header */}
      <div className="bg-white border-b border-[#DDE2E6] px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-[#315D78] bg-[#EBF2F7] px-2 py-0.5 rounded-sm">
                {enquiry?.reference || 'ENQ-2025-0047'}
              </span>
              <span className="text-[13px] font-semibold text-[#20272E]">
                Engineering Review, Validation & Release
              </span>
              <StatusBadge status={review?.releaseReadiness || 'pending_checks'} />
            </div>
            <p className="text-[12px] text-[#68737D] mt-0.5">
              Source Assembly: <strong className="text-[#20272E]">{sourceAssembly?.fileName || 'PUMP_UNIT_STD_A.SLDASM'}</strong> · 
              Changes Proposed: <strong className="text-[#20272E]">{review?.changesProposed ?? state.proposedChanges.length}</strong> · 
              Executed: <strong className="text-[#20272E]">{state.executions.filter(e => e.status === 'complete').length}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn-secondary"
              onClick={handleExportBOM}
            >
              <Download size={13} /> Export BOM CSV
            </button>
            <button
              className="btn-primary"
              onClick={handleExportJSON}
            >
              <FileText size={13} /> Export Review Summary JSON
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-white">
        <TabBar tabs={REVIEW_TABS} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tab Contents */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* TAB 1: VALIDATION CHECKS */}
        {activeTab === 'checks' && (
          <ScrollPane className="h-full p-4 space-y-4">
            {/* Validation Metrics Banner */}
            <div className="grid grid-cols-4 gap-3">
              <div className="eng-panel p-3 border-l-4 border-l-[#2D7A4F]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#68737D] uppercase">Passed Checks</span>
                  <CheckCircle size={15} className="text-[#2D7A4F]" />
                </div>
                <div className="text-[20px] font-bold text-[#20272E] mt-1">{checkStats.passed}</div>
                <div className="text-[11px] text-[#68737D]">of {checkStats.total} total verified</div>
              </div>

              <div className="eng-panel p-3 border-l-4 border-l-[#B42318]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#68737D] uppercase">Failed Checks</span>
                  <XCircle size={15} className="text-[#B42318]" />
                </div>
                <div className="text-[20px] font-bold text-[#B42318] mt-1">{checkStats.failed}</div>
                <div className="text-[11px] text-[#68737D]">Block release clearance</div>
              </div>

              <div className="eng-panel p-3 border-l-4 border-l-[#9A6A00]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#68737D] uppercase">Review Required</span>
                  <AlertTriangle size={15} className="text-[#9A6A00]" />
                </div>
                <div className="text-[20px] font-bold text-[#9A6A00] mt-1">{checkStats.reviewReq}</div>
                <div className="text-[11px] text-[#68737D]">Manual engineering signoff</div>
              </div>

              <div className="eng-panel p-3 border-l-4 border-l-[#68737D]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#68737D] uppercase">Pending / Not Run</span>
                  <Clock size={15} className="text-[#68737D]" />
                </div>
                <div className="text-[20px] font-bold text-[#68737D] mt-1">{checkStats.notRun}</div>
                <div className="text-[11px] text-[#68737D]">Outstanding assessments</div>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11.5px] font-medium text-[#68737D]">Filter by Status:</span>
              {['all', 'passed', 'failed', 'review_required', 'not_run'].map(st => (
                <button
                  key={st}
                  onClick={() => setFilterCheckStatus(st)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-medium rounded border transition-colors',
                    filterCheckStatus === st
                      ? 'bg-[#315D78] text-white border-[#315D78]'
                      : 'bg-white text-[#68737D] border-[#DDE2E6] hover:bg-[#F4F5F6]'
                  )}
                >
                  {st.replace(/_/g, ' ').toUpperCase()}
                </button>
              ))}
            </div>

            {/* Validation Checks Table */}
            <div className="eng-panel">
              <table className="eng-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Check Description</th>
                    <th>Category</th>
                    <th>Source Validation Tool</th>
                    <th>Evidence / Finding</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChecks.map(chk => (
                    <tr key={chk.id}>
                      <td className="w-28">
                        <div className="flex items-center gap-1.5">
                          <ValidationIcon status={chk.status} />
                          <StatusBadge status={chk.status} />
                        </div>
                      </td>
                      <td className="font-medium text-[#20272E]">
                        {chk.description}
                      </td>
                      <td className="text-[11px] text-[#68737D] uppercase font-mono">
                        {chk.checkType}
                      </td>
                      <td className="text-[11.5px] text-[#315D78]">
                        {chk.source}
                      </td>
                      <td className="text-[11.5px] text-[#68737D] max-w-xs truncate" title={chk.evidence}>
                        {chk.evidence || '—'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            className="btn-ghost p-1 text-[#2D7A4F] hover:bg-[#EBF5EF]"
                            title="Mark as Passed"
                            onClick={() => handleUpdateCheckStatus(chk.id, 'passed')}
                          >
                            <Check size={12} />
                          </button>
                          <button
                            className="btn-ghost p-1 text-[#9A6A00] hover:bg-[#FEF8E6]"
                            title="Flag Review Required"
                            onClick={() => handleUpdateCheckStatus(chk.id, 'review_required')}
                          >
                            <AlertTriangle size={12} />
                          </button>
                          <button
                            className="btn-ghost p-1 text-[#B42318] hover:bg-[#FEF0EE]"
                            title="Mark as Failed"
                            onClick={() => handleUpdateCheckStatus(chk.id, 'failed')}
                          >
                            <XCircle size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Non-conformance alert */}
            {checkStats.failed > 0 && (
              <AlertBanner
                type="error"
                message="Critical validation non-conformances detected."
                detail="BOM ERP mapping or structural checks must be resolved or formally exempted before release authorization."
              />
            )}
          </ScrollPane>
        )}

        {/* TAB 2: DRAWING REVIEW */}
        {activeTab === 'drawings' && (
          <ScrollPane className="h-full p-4 space-y-4">
            <div className="p-3 bg-[#EBF2F7] border border-[#315D78] rounded text-[#1A3D52] text-[12px] flex items-start gap-2.5">
              <Info size={16} className="text-[#315D78] mt-0.5 flex-shrink-0" />
              <div>
                <strong>Drawing Traceability Notice:</strong> Drawing records are derived from the associated CAD models. In industrial CAD practice, 3D model changes do not automatically update 2D drafting sheets or title blocks until an engineer conducts visual view inspection and updates annotation callouts.
              </div>
            </div>

            <div className="eng-panel">
              <div className="eng-panel-header">
                <FileText size={13} className="text-[#315D78]" />
                <span className="eng-panel-title">Associated Drawing Sheets & Impact Analysis</span>
              </div>
              <div className="divide-y divide-[#EEF1F4]">
                {review?.drawingReviews.map(drw => (
                  <div key={drw.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13px] font-bold text-[#315D78]">{drw.drawingNumber}</span>
                        <span className="text-[11.5px] text-[#68737D]">(Sheets: {drw.sheetCount})</span>
                        <StatusBadge status={drw.updateStatus} />
                      </div>
                      <span className="text-[11.5px] text-[#68737D]">
                        Reviewer: <strong className="text-[#20272E]">{drw.reviewer || 'Unassigned'}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-[12px] bg-[#F8FAFB] p-3 rounded border border-[#EEF1F4]">
                      <div>
                        <strong className="text-[#68737D] uppercase text-[10.5px] block mb-1">Affected Views:</strong>
                        <div className="flex gap-1.5 flex-wrap">
                          {drw.affectedViews.map((v, i) => (
                            <span key={i} className="bg-white border border-[#DDE2E6] px-1.5 py-0.5 rounded text-[11px] font-medium text-[#20272E]">
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <strong className="text-[#68737D] uppercase text-[10.5px] block mb-1">Dimensions Requiring Review:</strong>
                        <ul className="list-disc ml-3.5 space-y-0.5 text-[#20272E]">
                          {drw.dimensionsToReview.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="text-[11.5px]">
                      <strong className="text-[#68737D] uppercase text-[10.5px] block mb-1">Validation Findings:</strong>
                      <ul className="space-y-1">
                        {drw.validationFindings.map((f, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-[#20272E]">
                            <ChevronRight size={11} className="text-[#315D78]" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollPane>
        )}

        {/* TAB 3: BOM VALIDATION */}
        {activeTab === 'bom' && (
          <ScrollPane className="h-full p-4 space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-[#20272E]">Engineering Bill of Materials (EBOM)</h3>
                <p className="text-[11.5px] text-[#68737D]">{bom?.sourceLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary"
                  onClick={handleRegenerateBOM}
                >
                  <RefreshCw size={12} /> Regenerate from Assembly
                </button>
                <button
                  className="btn-primary"
                  onClick={handleExportBOM}
                >
                  <Download size={12} /> Export CSV
                </button>
              </div>
            </div>

            {/* Validation errors summary */}
            {bom?.validationErrors && bom.validationErrors.length > 0 && (
              <div className="space-y-1.5">
                {bom.validationErrors.map(err => (
                  <div
                    key={err.id}
                    className={cn(
                      'p-2.5 rounded text-[11.5px] flex items-start gap-2 border',
                      err.severity === 'warning' ? 'bg-[#FEF8E6] border-[#F5D78A] text-[#7A5400]' :
                      err.severity === 'error' ? 'bg-[#FEF0EE] border-[#F4A9A4] text-[#8B1A12]' :
                      'bg-[#EBF2F7] border-[#B8D5E5] text-[#1A3D52]'
                    )}
                  >
                    <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* BOM Table */}
            <div className="eng-panel">
              <table className="eng-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Part Number</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Material</th>
                    <th>Rev</th>
                    <th>Config</th>
                    <th>Validation</th>
                    <th>ERP Mapping</th>
                  </tr>
                </thead>
                <tbody>
                  {bom?.items.map(item => (
                    <tr key={item.id} className={!item.erpMapping ? 'bg-[#FFFDF0]' : ''}>
                      <td className="font-mono text-[#68737D]">{item.itemNumber}</td>
                      <td className="font-mono text-[11.5px] font-bold text-[#315D78]">
                        {item.partNumber}
                      </td>
                      <td className="font-medium text-[#20272E] max-w-xs truncate">
                        {item.description}
                      </td>
                      <td className="font-bold">{item.quantity}</td>
                      <td className="text-[#68737D]">{item.unit}</td>
                      <td className="text-[11.5px] text-[#68737D]">{item.material || '—'}</td>
                      <td className="font-mono">{item.revision}</td>
                      <td className="text-[11px] text-[#68737D]">{item.sourceConfiguration || '—'}</td>
                      <td>
                        <StatusBadge status={item.validationStatus} />
                      </td>
                      <td>
                        {item.erpMapping ? (
                          <span className="font-mono text-[11px] text-[#2D7A4F] bg-[#EBF5EF] px-1.5 py-0.5 rounded">
                            {item.erpMapping}
                          </span>
                        ) : (
                          <span className="text-[10.5px] text-[#9A6A00] bg-[#FEF8E6] px-1.5 py-0.5 rounded italic">
                            Unmapped
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollPane>
        )}

        {/* TAB 4: DOWNSTREAM HAND-OFF */}
        {activeTab === 'handoff' && (
          <ScrollPane className="h-full p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Release Sign-off Panel */}
              <div className="eng-panel p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-[#EEF1F4]">
                  <Shield size={16} className="text-[#315D78]" />
                  <span className="text-[13px] font-bold text-[#20272E]">Formal Release Sign-off</span>
                </div>

                <div className="space-y-2 text-[12px]">
                  <div>
                    <label className="text-[10.5px] font-semibold text-[#68737D] uppercase block mb-1">
                      Lead Reviewer Name
                    </label>
                    <input
                      className="eng-input"
                      value={newDecisionReviewer}
                      onChange={e => setNewDecisionReviewer(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase block mb-1">
                        Review Decision
                      </label>
                      <select
                        className="eng-select w-full"
                        value={newDecisionType}
                        onChange={e => setNewDecisionType(e.target.value as any)}
                      >
                        <option value="approved">Approve for Release</option>
                        <option value="revision_requested">Request Revision</option>
                        <option value="rejected">Reject</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-[#68737D] uppercase block mb-1">
                        Scope
                      </label>
                      <input
                        className="eng-input"
                        value={newDecisionScope}
                        onChange={e => setNewDecisionScope(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10.5px] font-semibold text-[#68737D] uppercase block mb-1">
                      Engineering Comments & Release Notes *
                    </label>
                    <textarea
                      className="eng-input"
                      rows={3}
                      placeholder="Specify verification basis, remaining external tests, or release authorizations..."
                      value={newDecisionComment}
                      onChange={e => setNewDecisionComment(e.target.value)}
                    />
                  </div>

                  <button
                    className="btn-primary w-full justify-center py-2"
                    disabled={!newDecisionComment.trim()}
                    onClick={handleAddDecision}
                  >
                    <CheckSquare size={13} /> Record Formal Decision
                  </button>
                </div>
              </div>

              {/* Downstream ERP & PLM Boundary */}
              <div className="eng-panel p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-[#EEF1F4]">
                  <Send size={16} className="text-[#315D78]" />
                  <span className="text-[13px] font-bold text-[#20272E]">Downstream Hand-off Interface</span>
                </div>

                <div className="p-3 bg-[#FEF8E6] border border-[#F5D78A] text-[#7A5400] text-[11.5px] rounded">
                  <strong>ERP / PLM Boundary:</strong> Direct writes to production SAP / Windchill / Teamcenter are locked until authorised connector endpoints are provisioned. Use verified exports below.
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    className="btn-secondary w-full justify-between"
                    onClick={handleExportBOM}
                  >
                    <span className="flex items-center gap-2">
                      <Download size={13} className="text-[#315D78]" />
                      Download Verified BOM (.CSV)
                    </span>
                    <span className="font-mono text-[11px] text-[#68737D]">RFC 4180</span>
                  </button>

                  <button
                    className="btn-secondary w-full justify-between"
                    onClick={handleExportJSON}
                  >
                    <span className="flex items-center gap-2">
                      <FileText size={13} className="text-[#315D78]" />
                      Download Engineering Audit Dossier (.JSON)
                    </span>
                    <span className="font-mono text-[11px] text-[#68737D]">JSON Schema</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-[#EEF1F4] text-[11px] text-[#68737D]">
                  Current Status: <strong className="text-[#20272E]">{review?.releaseReadiness.replace(/_/g, ' ').toUpperCase()}</strong>
                </div>
              </div>
            </div>

            {/* Past Decisions Log */}
            <div className="eng-panel">
              <div className="eng-panel-header">
                <Shield size={13} className="text-[#315D78]" />
                <span className="eng-panel-title">Recorded Reviewer Decisions</span>
              </div>
              <div className="divide-y divide-[#EEF1F4]">
                {review?.reviewerDecisions.length === 0 && (
                  <div className="p-4 text-center text-[#9AAAB5] text-[12px]">
                    No formal sign-off decisions recorded yet.
                  </div>
                )}
                {review?.reviewerDecisions.map(dec => (
                  <div key={dec.id} className="p-3 text-[12px]">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-[#20272E]">{dec.reviewer}</strong>
                        <StatusBadge status={dec.decision} />
                        <span className="text-[11px] text-[#68737D]">({dec.scope})</span>
                      </div>
                      <span className="text-[11px] text-[#9AAAB5]">{formatDateTime(dec.timestamp)}</span>
                    </div>
                    <p className="text-[#20272E] mt-1">{dec.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollPane>
        )}
      </div>
    </div>
  );
}
