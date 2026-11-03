import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Edit2, Trash2, ArrowRight, AlertTriangle,
  CheckCircle, XCircle, Clock, Save, ChevronRight, List, Info,
  Upload, Sparkles, X, Check, FileUp, RefreshCw, Eye
} from 'lucide-react';
import { useStore, useActiveEnquiry } from '../store/appStore';
import { SAMPLE_SPEC_REQUIREMENTS, SAMPLE_SPEC_DOCUMENTS } from '../data/sampleData';
import type { Requirement, ConfirmationStatus, Priority, RequirementCategory, Enquiry } from '../types/engineering';
import {
  StatusBadge, SectionPanel, EmptyState, AlertBanner, TabBar,
  cn, formatDateTime, ScrollPane, ProgressBar
} from '../components/shared';

const CATEGORY_LABELS: Record<RequirementCategory, string> = {
  dimensions: 'Dimensions',
  capacity_load: 'Capacity & Load',
  operating_conditions: 'Operating Conditions',
  materials: 'Materials',
  interfaces: 'Interfaces',
  geometry_clearance: 'Geometry & Clearance',
  safety_guarding: 'Safety & Guarding',
  documentation: 'Documentation',
  manufacturing_constraints: 'Manufacturing',
  other: 'Other',
};

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'unconfirmed', label: 'Unconfirmed' },
  { id: 'missing', label: 'Missing' },
  { id: 'conflicting', label: 'Conflicting' },
];

function emptyReq(enquiryId: string): Requirement {
  return {
    id: `req-${Date.now().toString().slice(-4)}`,
    enquiryId,
    name: '',
    description: '',
    value: '',
    unit: '',
    category: 'dimensions',
    source: 'Customer Engineering Specification',
    sourceLocation: 'Section 1.0',
    status: 'confirmed',
    priority: 'high',
    notes: '',
    relatedDesignParameters: [],
    validationRule: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function EnquiryWorkspace() {
  const navigate = useNavigate();
  const { state, dispatch } = useStore();
  const enquiry = useActiveEnquiry();

  const [activeTab, setActiveTab] = useState('all');
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);

  // Modal State for adding/editing requirements
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalReq, setModalReq] = useState<Requirement | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Ingestion simulation state
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestProgress, setIngestProgress] = useState(0);
  const [ingestStatusText, setIngestStatusText] = useState('');
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);

  // Modal for New Enquiry creation
  const [isNewEnquiryModalOpen, setIsNewEnquiryModalOpen] = useState(false);
  const [newEnquiryRef, setNewEnquiryRef] = useState(`ENQ-${new Date().getFullYear()}-00${state.enquiries.length + 1}`);
  const [newEnquiryTitle, setNewEnquiryTitle] = useState('');
  const [newEnquiryDesc, setNewEnquiryDesc] = useState('');
  const [newEnquiryPriority, setNewEnquiryPriority] = useState<Priority>('high');

  const requirements = enquiry?.requirements ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: requirements.length };
    for (const r of requirements) {
      c[r.status] = (c[r.status] ?? 0) + 1;
    }
    return c;
  }, [requirements]);

  const tabs = STATUS_TABS.map(t => ({ ...t, count: counts[t.id] ?? 0 }));

  const filtered = useMemo(() => {
    if (activeTab === 'all') return requirements;
    return requirements.filter(r => r.status === activeTab);
  }, [requirements, activeTab]);

  const criticalMissing = requirements.filter(r => r.priority === 'critical' && (r.status === 'missing' || r.status === 'unconfirmed'));
  const selectedReq = requirements.find(r => r.id === selectedReqId) ?? null;
  const auditEvents = state.auditEvents.filter(e => e.enquiryId === enquiry?.id);

  // Clear brief to show the client the completely empty starting state
  function handleClearToEmpty() {
    if (!enquiry) return;
    const now = new Date().toISOString();
    const clearedEnquiry: Enquiry = {
      ...enquiry,
      title: 'New Customer Equipment Enquiry',
      description: 'Awaiting customer specification document. Ingest customer specification document (PDF/CSV) or enter requirements manually to initialize the engineering brief.',
      status: 'open',
      requirements: [],
      sourceDocuments: [],
      updatedAt: now,
    };

    dispatch({ type: 'UPSERT_ENQUIRY', enquiry: clearedEnquiry });
    setSelectedReqId(null);
    dispatch({
      type: 'ADD_AUDIT_EVENT',
      event: {
        id: `audit-${Date.now()}`,
        timestamp: now,
        actor: state.currentUser,
        action: 'Brief Reset to Empty',
        entityType: 'Enquiry',
        entityId: enquiry.id,
        detail: `Cleared all requirements and documents from ${enquiry.reference} to demonstrate live document ingestion`,
        enquiryId: enquiry.id,
      }
    });
  }

  // Realistic document ingestion simulation
  async function handleIngestDocument(docName = 'Customer_Spec_Rev1.pdf') {
    if (!enquiry) return;
    setIsIngesting(true);
    setIngestProgress(15);
    setIngestStatusText(`Reading binary structure of ${docName} (4.2 MB)...`);

    await new Promise(r => setTimeout(r, 400));
    setIngestProgress(45);
    setIngestStatusText(`Parsing Section 3 (Hydraulic Duty) & Section 4 (Metallurgy)...`);

    await new Promise(r => setTimeout(r, 500));
    setIngestProgress(80);
    setIngestStatusText(`Extracting parameters and evaluating ATEX Group II Zone 1 criteria...`);

    await new Promise(r => setTimeout(r, 400));
    setIngestProgress(100);
    setIngestStatusText(`Completed: 10 structured engineering requirements extracted.`);

    await new Promise(r => setTimeout(r, 300));

    const now = new Date().toISOString();
    const populatedEnquiry: Enquiry = {
      ...enquiry,
      title: 'Stainless Steel Pump Unit — Chemical Dosing Service',
      description: 'Customer requires a centrifugal pump unit for chemical dosing service. Key differences from standard product: stainless steel wetted parts, increased flow rate, higher discharge pressure, and ATEX-rated motor. Preliminary customer specification received; structural and ATEX assessments are outstanding.',
      status: 'in_progress',
      requirements: SAMPLE_SPEC_REQUIREMENTS,
      sourceDocuments: [
        {
          id: `doc-${Date.now()}`,
          enquiryId: enquiry.id,
          name: docName,
          type: 'pdf',
          importedAt: now,
          status: 'imported',
          extractedRequirements: 10,
        }
      ],
      updatedAt: now,
    };

    dispatch({ type: 'UPSERT_ENQUIRY', enquiry: populatedEnquiry });
    dispatch({
      type: 'ADD_AUDIT_EVENT',
      event: {
        id: `audit-${Date.now()}`,
        timestamp: now,
        actor: state.currentUser,
        action: 'Customer Specification Ingested',
        entityType: 'SourceDocument',
        entityId: `doc-${Date.now()}`,
        detail: `Ingested ${docName} — extracted 10 requirements into ${enquiry.reference}`,
        enquiryId: enquiry.id,
      }
    });

    setIsIngesting(false);
    setIsIngestModalOpen(false);
    setSelectedReqId(SAMPLE_SPEC_REQUIREMENTS[0]?.id || null);
  }

  // Open modal for creating a new requirement manually
  function handleOpenAddModal() {
    if (!enquiry) return;
    const fresh = emptyReq(enquiry.id);
    setModalReq(fresh);
    setIsAddingNew(true);
    setIsModalOpen(true);
  }

  // Open modal for editing an existing requirement
  function handleOpenEditModal(req: Requirement) {
    setModalReq({ ...req });
    setIsAddingNew(false);
    setIsModalOpen(true);
  }

  // Quick Demo Templates to prefill fields instantly for the client
  function applyTemplate(type: 'inlet' | 'flow' | 'pressure' | 'material' | 'temp') {
    if (!modalReq) return;
    if (type === 'inlet') {
      setModalReq({
        ...modalReq,
        name: 'Inlet Port Nominal Diameter',
        category: 'dimensions',
        value: 125,
        unit: 'mm (DN125)',
        priority: 'critical',
        status: 'confirmed',
        source: 'Process Flow Diagram P&ID-402',
        sourceLocation: 'Sheet 2',
        description: 'Suction nozzle connection must match plant header size.',
        notes: 'Requires DN125 PN16 flange rating per EN 1092-1.',
      });
    } else if (type === 'flow') {
      setModalReq({
        ...modalReq,
        name: 'Design Volumetric Flow Rate',
        category: 'capacity_load',
        value: 65,
        unit: 'm³/h',
        priority: 'critical',
        status: 'confirmed',
        source: 'Customer Data Sheet Rev B',
        sourceLocation: 'Item 4.1',
        description: 'Continuous duty volumetric transfer rate.',
        notes: 'Customer confirms no duty margin included in this rate.',
      });
    } else if (type === 'pressure') {
      setModalReq({
        ...modalReq,
        name: 'Minimum Discharge Head',
        category: 'capacity_load',
        value: 48,
        unit: 'm (4.7 bar)',
        priority: 'critical',
        status: 'confirmed',
        source: 'System Hydraulic Curve Sheet',
        sourceLocation: 'Page 3',
        description: 'Total dynamic head required at operating flow.',
      });
    } else if (type === 'material') {
      setModalReq({
        ...modalReq,
        name: 'Wetted Metallurgy Specification',
        category: 'materials',
        value: '316L Stainless Steel (1.4404)',
        unit: '',
        priority: 'critical',
        status: 'confirmed',
        source: 'Corrosion Management Spec',
        sourceLocation: 'Section 4.1',
        description: 'All wetted casing, impeller and shaft components.',
        notes: 'Cast iron not acceptable due to chemical dosing acid content.',
      });
    } else if (type === 'temp') {
      setModalReq({
        ...modalReq,
        name: 'Maximum Fluid Temperature',
        category: 'operating_conditions',
        value: 75,
        unit: '°C',
        priority: 'high',
        status: 'confirmed',
        source: 'Process Condition Sheet',
        sourceLocation: 'Section 2.2',
        description: 'Sustained liquid temperature at pump intake.',
      });
    }
  }

  // Save the requirement from modal into application state
  function handleSaveModalReq() {
    if (!modalReq || !enquiry || !modalReq.name.trim()) return;
    const now = new Date().toISOString();
    const updated = { ...modalReq, updatedAt: now };

    if (isAddingNew) {
      dispatch({ type: 'ADD_REQUIREMENT', enquiryId: enquiry.id, requirement: updated });
      dispatch({
        type: 'ADD_AUDIT_EVENT',
        event: {
          id: `audit-${Date.now()}`,
          timestamp: now,
          actor: state.currentUser,
          action: 'Requirement Added Manually',
          entityType: 'Requirement',
          entityId: updated.id,
          detail: `Added "${updated.name}" (${updated.value} ${updated.unit || ''}) to ${enquiry.reference}`,
          enquiryId: enquiry.id,
        }
      });
    } else {
      dispatch({ type: 'UPDATE_REQUIREMENT', enquiryId: enquiry.id, requirement: updated });
      dispatch({
        type: 'ADD_AUDIT_EVENT',
        event: {
          id: `audit-${Date.now()}`,
          timestamp: now,
          actor: state.currentUser,
          action: 'Requirement Updated',
          entityType: 'Requirement',
          entityId: updated.id,
          detail: `Updated "${updated.name}" to ${updated.value} ${updated.unit || ''}`,
          enquiryId: enquiry.id,
        }
      });
    }

    setIsModalOpen(false);
    setSelectedReqId(updated.id);
  }

  function handleDeleteReq(reqId: string) {
    if (!enquiry) return;
    if (!confirm('Are you sure you want to delete this requirement?')) return;
    dispatch({ type: 'DELETE_REQUIREMENT', enquiryId: enquiry.id, requirementId: reqId });
    if (selectedReqId === reqId) setSelectedReqId(null);
  }

  // Create a brand new enquiry
  function handleCreateNewEnquiry() {
    if (!newEnquiryTitle.trim()) return;
    const now = new Date().toISOString();
    const newEnq: Enquiry = {
      id: `enq-${Date.now().toString().slice(-4)}`,
      reference: newEnquiryRef || `ENQ-${Date.now().toString().slice(-4)}`,
      title: newEnquiryTitle,
      description: newEnquiryDesc || 'Customer equipment enquiry created manually during client intake session.',
      priority: newEnquiryPriority,
      status: 'in_progress',
      requirements: [],
      sourceDocuments: [],
      selectedCandidateId: 'asm-001',
      createdAt: now,
      updatedAt: now,
      createdBy: state.currentUser,
    };

    dispatch({ type: 'UPSERT_ENQUIRY', enquiry: newEnq });
    dispatch({ type: 'SET_ACTIVE_ENQUIRY', id: newEnq.id });
    dispatch({
      type: 'ADD_AUDIT_EVENT',
      event: {
        id: `audit-${Date.now()}`,
        timestamp: now,
        actor: state.currentUser,
        action: 'New Enquiry Created',
        entityType: 'Enquiry',
        entityId: newEnq.id,
        detail: `Created ${newEnq.reference}: ${newEnq.title}`,
        enquiryId: newEnq.id,
      }
    });

    setIsNewEnquiryModalOpen(false);
    setNewEnquiryTitle('');
    setNewEnquiryDesc('');
  }

  function handleContinue() {
    navigate('/library');
  }

  if (!enquiry) return (
    <div className="flex items-center justify-center h-full">
      <EmptyState
        icon={<FileText size={32} />}
        title="No active enquiry"
        description="Create a new equipment brief to begin capturing requirements."
        action={
          <button className="btn-primary" onClick={() => setIsNewEnquiryModalOpen(true)}>
            <Plus size={13} /> Create New Equipment Enquiry
          </button>
        }
      />
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#F4F5F6' }}>
      {/* Main Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Enquiry Header */}
        <div className="bg-white border-b border-[#DDE2E6] px-5 py-3 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-white bg-[#315D78] px-2 py-0.5 rounded-sm">
                  1. Requirements Brief
                </span>
                <span className="text-[11px] font-mono font-bold text-[#315D78] bg-[#EBF2F7] px-2 py-0.5 rounded-sm">
                  {enquiry.reference}
                </span>
                <StatusBadge status={enquiry.status} />
                <StatusBadge status={enquiry.priority} />
                {requirements.length === 0 && (
                  <span className="text-[10px] font-semibold text-[#9A6A00] bg-[#FEF8E6] border border-[#F5D78A] px-1.5 py-0.5 rounded">
                    EMPTY BRIEF — Awaiting Document Ingestion
                  </span>
                )}
              </div>
              <h1 className="text-[15px] font-semibold text-[#20272E] mt-1 leading-snug">
                {enquiry.title}
              </h1>
              <p className="text-[12px] text-[#68737D] mt-1 leading-snug">
                {enquiry.description}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* TOGGLE: CLEAR BRIEF VS INGEST CUSTOMER SPEC */}
              {requirements.length > 0 ? (
                <button
                  className="btn-secondary text-[11.5px]"
                  onClick={handleClearToEmpty}
                  title="Clear all requirements to show client the empty intake state"
                >
                  <RefreshCw size={12} /> Clear Brief (Show Empty)
                </button>
              ) : (
                <button
                  className="btn-primary text-[11.5px] bg-[#2D7A4F] hover:bg-[#236340]"
                  onClick={() => setIsIngestModalOpen(true)}
                  title="Simulate ingesting the customer specification document"
                >
                  <Upload size={12} /> Ingest Customer_Spec_Rev1.pdf
                </button>
              )}

              <button
                className="btn-secondary"
                onClick={() => setIsNewEnquiryModalOpen(true)}
                title="Create a fresh equipment enquiry"
              >
                <Plus size={13} /> New Enquiry
              </button>

              <button
                className="btn-secondary"
                onClick={() => dispatch({ type: 'UPSERT_ENQUIRY', enquiry: { ...enquiry, updatedAt: new Date().toISOString() } })}
              >
                <Save size={13} /> Save Brief
              </button>

              <button className="btn-primary" onClick={handleContinue}>
                Proceed to 2. Engineering Library <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Completion bar */}
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[11px] text-[#68737D] w-32 flex-shrink-0">
              {requirements.length === 0 ? '0/0 confirmed' : `${counts['confirmed'] ?? 0}/${requirements.length} confirmed`}
            </span>
            <ProgressBar value={counts['confirmed'] ?? 0} max={Math.max(requirements.length, 1)} className="flex-1" />
          </div>
        </div>

        {/* Warnings */}
        {criticalMissing.length > 0 && requirements.length > 0 && (
          <div className="mx-4 mt-3 flex-shrink-0">
            <AlertBanner
              type="warning"
              message={`${criticalMissing.length} critical requirement${criticalMissing.length > 1 ? 's' : ''} are missing or unconfirmed.`}
              detail="Progress to library and candidate comparison is permitted, but formal release requires all critical requirements to be confirmed."
            />
          </div>
        )}

        {/* Requirements Table Section */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-4 pt-3 pb-4">
          <div className="eng-panel flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Table Header Bar */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#DDE2E6] bg-[#F8FAFB] flex-shrink-0">
              <div className="flex items-center gap-2">
                <List size={14} className="text-[#315D78]" />
                <span className="eng-panel-title">
                  Requirements Specification ({requirements.length})
                </span>
              </div>

              <div className="flex items-center gap-2">
                {requirements.length === 0 && (
                  <button
                    className="btn-secondary py-1 px-2.5 text-[11.5px]"
                    onClick={() => setIsIngestModalOpen(true)}
                  >
                    <Upload size={12} className="text-[#315D78]" /> Ingest Customer Specification
                  </button>
                )}
                <button
                  className="btn-primary py-1.5 px-3 text-[12px] font-semibold shadow-xs"
                  onClick={handleOpenAddModal}
                  title="Click to enter a new requirement manually"
                >
                  <Plus size={13} /> + Add Requirement (Manual Entry)
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex-shrink-0">
              <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
            </div>

            {/* Requirements Data Table / Empty State Dropzone */}
            <ScrollPane className="flex-1">
              {requirements.length === 0 ? (
                /* EMPTY STATE: READY FOR LIVE DOCUMENT INGESTION */
                <div className="p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-full bg-[#EBF2F7] flex items-center justify-center mb-3 border border-[#C5D9E8]">
                    <FileUp size={24} className="text-[#315D78]" />
                  </div>
                  <h3 className="text-[15px] font-bold text-[#20272E]">
                    Enquiry Brief is Ready — No Requirements Ingested Yet
                  </h3>
                  <p className="text-[12px] text-[#68737D] max-w-md mt-1 leading-relaxed">
                    To start the engineering workflow, ingest a customer specification document (e.g., PDF/CSV data sheet) or enter requirements manually one by one.
                  </p>

                  <div className="flex items-center gap-3 mt-5">
                    <button
                      className="btn-primary py-2 px-4 text-[12.5px] bg-[#315D78] hover:bg-[#264A62] shadow-sm flex items-center gap-2"
                      onClick={() => setIsIngestModalOpen(true)}
                    >
                      <Upload size={14} />
                      Ingest "Customer_Spec_Rev1.pdf" (10 Requirements)
                    </button>

                    <button
                      className="btn-secondary py-2 px-4 text-[12.5px]"
                      onClick={handleOpenAddModal}
                    >
                      <Plus size={13} />
                      Enter Requirement Manually
                    </button>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#EEF1F4] text-[11px] text-[#9AAAB5] flex items-center gap-2">
                    <Clock size={12} />
                    <span>Enquiry: {enquiry.reference} · Client: Chemical Dosing Service</span>
                  </div>
                </div>
              ) : (
                /* POPULATED REQUIREMENTS TABLE */
                <table className="eng-table">
                  <thead>
                    <tr>
                      <th>Req ID</th>
                      <th>Requirement Name</th>
                      <th>Category</th>
                      <th>Required Value</th>
                      <th>Unit</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Source Document / Section</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(req => (
                      <tr
                        key={req.id}
                        className={cn(
                          'cursor-pointer transition-colors',
                          selectedReqId === req.id ? 'selected' : ''
                        )}
                        onClick={() => setSelectedReqId(req.id)}
                      >
                        <td className="font-mono text-[11px] text-[#315D78] font-semibold">{req.id}</td>
                        <td className="font-medium text-[#20272E] max-w-[200px] truncate">
                          {req.name || <span className="text-[#9AAAB5] italic">Unnamed</span>}
                        </td>
                        <td className="text-[#68737D] text-[11.5px]">{CATEGORY_LABELS[req.category]}</td>
                        <td className="font-mono font-bold text-[#20272E]">
                          {req.value !== undefined && req.value !== '' ? String(req.value) : <span className="text-[#9AAAB5] font-normal">—</span>}
                        </td>
                        <td className="text-[#68737D] font-mono text-[11.5px]">{req.unit || '—'}</td>
                        <td><StatusBadge status={req.status} /></td>
                        <td><StatusBadge status={req.priority} /></td>
                        <td className="text-[11px] text-[#68737D] max-w-[160px] truncate">
                          {req.source ? `${req.source}${req.sourceLocation ? ` (${req.sourceLocation})` : ''}` : '—'}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              className="btn-ghost p-1 text-[#315D78] hover:bg-[#EBF2F7]"
                              onClick={() => handleOpenEditModal(req)}
                              title="Edit Requirement"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              className="btn-ghost p-1 text-[#B42318] hover:bg-[#FEF0EE]"
                              onClick={() => handleDeleteReq(req.id)}
                              title="Delete Requirement"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ScrollPane>
          </div>
        </div>
      </div>

      {/* Side Panel: Selected Requirement Inspector & Project Artifacts */}
      <div className="w-80 flex-shrink-0 border-l border-[#DDE2E6] bg-white flex flex-col overflow-hidden">
        <div className="p-3 border-b border-[#DDE2E6] bg-[#F8FAFB] flex items-center justify-between">
          <span className="eng-panel-title flex items-center gap-1.5">
            <Info size={13} className="text-[#315D78]" />
            Requirement Dossier
          </span>
          <button
            className="btn-primary py-1 px-2 text-[11px]"
            onClick={handleOpenAddModal}
          >
            <Plus size={11} /> + Add
          </button>
        </div>

        <ScrollPane className="flex-1 p-3 space-y-3">
          {/* Selected Requirement Detail Inspector */}
          {selectedReq ? (
            <div className="eng-panel p-3 border-[#315D78] bg-[#FDFDFE]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#EEF1F4]">
                <span className="font-mono text-[11px] font-bold text-[#315D78]">{selectedReq.id}</span>
                <div className="flex items-center gap-1">
                  <StatusBadge status={selectedReq.status} />
                  <StatusBadge status={selectedReq.priority} />
                </div>
              </div>

              <div className="space-y-2 text-[12px]">
                <div>
                  <strong className="text-[#68737D] uppercase text-[10px] block">Requirement Name</strong>
                  <span className="font-semibold text-[#20272E]">{selectedReq.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-[#F8FAFB] p-2 rounded border border-[#EEF1F4]">
                  <div>
                    <strong className="text-[#68737D] uppercase text-[10px] block">Required Value</strong>
                    <span className="font-mono font-bold text-[#315D78]">
                      {selectedReq.value !== undefined ? String(selectedReq.value) : 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <strong className="text-[#68737D] uppercase text-[10px] block">Unit of Measure</strong>
                    <span className="font-mono text-[#20272E]">{selectedReq.unit || '—'}</span>
                  </div>
                </div>

                <div>
                  <strong className="text-[#68737D] uppercase text-[10px] block">Category</strong>
                  <span className="text-[#20272E]">{CATEGORY_LABELS[selectedReq.category]}</span>
                </div>

                <div>
                  <strong className="text-[#68737D] uppercase text-[10px] block">Source Document Reference</strong>
                  <span className="text-[#20272E]">
                    {selectedReq.source || 'Manual Client Input'}{selectedReq.sourceLocation ? ` (${selectedReq.sourceLocation})` : ''}
                  </span>
                </div>

                {selectedReq.description && (
                  <div>
                    <strong className="text-[#68737D] uppercase text-[10px] block">Description & Intent</strong>
                    <p className="text-[#20272E] text-[11.5px] leading-relaxed">{selectedReq.description}</p>
                  </div>
                )}

                {selectedReq.notes && (
                  <div>
                    <strong className="text-[#68737D] uppercase text-[10px] block">Engineering Notes</strong>
                    <p className="text-[#68737D] text-[11.5px] italic">{selectedReq.notes}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 mt-2 border-t border-[#EEF1F4]">
                <button
                  className="btn-primary flex-1 justify-center py-1.5 text-xs"
                  onClick={() => handleOpenEditModal(selectedReq)}
                >
                  <Edit2 size={12} /> Edit Requirement
                </button>
                <button
                  className="btn-danger p-1.5"
                  onClick={() => handleDeleteReq(selectedReq.id)}
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-[12px] text-[#9AAAB5] border border-dashed border-[#DDE2E6] rounded">
              <List size={22} className="mx-auto mb-2 text-[#9AAAB5]" />
              <p className="font-medium text-[#20272E]">No requirement selected</p>
              <p className="text-[11px] text-[#68737D] mt-1">
                {requirements.length === 0
                  ? 'Ingest the specification document to populate requirements.'
                  : 'Click any row in the table to inspect details.'}
              </p>
              <button
                className="btn-primary text-xs mt-3 w-full justify-center"
                onClick={handleOpenAddModal}
              >
                <Plus size={12} /> Enter Requirement Manually
              </button>
            </div>
          )}

          {/* Source Documents Section with Ingest Button */}
          <SectionPanel
            title="Source Documents"
            icon={<FileText size={12} className="text-[#315D78]" />}
            defaultOpen
            actions={
              <button
                className="text-[10px] bg-[#EBF2F7] text-[#315D78] hover:bg-[#D5E3EE] px-1.5 py-0.5 rounded font-medium flex items-center gap-1"
                onClick={() => setIsIngestModalOpen(true)}
              >
                <Upload size={10} /> + Ingest
              </button>
            }
          >
            {enquiry.sourceDocuments.length === 0 ? (
              <div className="p-4 text-center text-[11.5px] text-[#9AAAB5]">
                <FileText size={18} className="mx-auto mb-1 text-[#9AAAB5] opacity-50" />
                <p>No documents attached yet.</p>
                <button
                  className="text-[#315D78] font-semibold text-[11px] underline mt-1"
                  onClick={() => setIsIngestModalOpen(true)}
                >
                  Ingest Customer_Spec_Rev1.pdf
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#EEF1F4]">
                {enquiry.sourceDocuments.map(doc => (
                  <div key={doc.id} className="px-3 py-2.5 flex items-start gap-2">
                    <FileText size={13} className="text-[#315D78] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-[#20272E] truncate">{doc.name}</p>
                      <p className="text-[11px] text-[#68737D]">{doc.extractedRequirements} extracted · {doc.type.toUpperCase()}</p>
                      <p className="text-[10px] text-[#9AAAB5]">{formatDateTime(doc.importedAt)}</p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                ))}
              </div>
            )}
          </SectionPanel>

          {/* Audit Activity Trail */}
          <SectionPanel title="Audit Trail" icon={<Clock size={12} className="text-[#315D78]" />} defaultOpen={false}>
            {auditEvents.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-[#9AAAB5] text-center">No activity recorded.</div>
            ) : (
              <div className="divide-y divide-[#EEF1F4]">
                {auditEvents.slice(0, 6).map(event => (
                  <div key={event.id} className="px-3 py-2 text-[11px]">
                    <div className="flex items-start gap-1.5">
                      <Clock size={11} className="text-[#9AAAB5] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-[#20272E]">{event.action}</p>
                        <p className="text-[#68737D] leading-tight">{event.detail}</p>
                        <p className="text-[10px] text-[#9AAAB5] mt-0.5">{event.actor} · {formatDateTime(event.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionPanel>
        </ScrollPane>
      </div>

      {/* ======================================================== */}
      {/* MODAL: DOCUMENT INGESTION SIMULATION DIALOG               */}
      {/* ======================================================== */}
      {isIngestModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-md border border-[#DDE2E6] shadow-2xl max-w-lg w-full flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#DDE2E6] bg-[#202830] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload size={16} className="text-[#315D78]" />
                <h3 className="font-bold text-[14px]">Ingest Customer Engineering Specification</h3>
              </div>
              <button
                onClick={() => !isIngesting && setIsIngestModalOpen(false)}
                className="text-[#9AAAB5] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-[12px]">
              <div className="p-3 bg-[#EBF2F7] border border-[#B8D5E5] text-[#1A3D52] rounded">
                <strong>Specification Parser:</strong> Ingests technical data sheets, P&IDs, and customer RFQ specifications to extract structured dimensional, hydraulic, and metallurgical constraints.
              </div>

              {/* Progress state when ingesting */}
              {isIngesting ? (
                <div className="p-6 bg-[#F8FAFB] border border-[#DDE2E6] rounded text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-[#315D78] font-semibold text-[13px]">
                    <Upload size={16} className="animate-bounce" />
                    <span>Ingesting Document...</span>
                  </div>
                  <ProgressBar value={ingestProgress} />
                  <p className="text-[11px] font-mono text-[#68737D]">{ingestStatusText}</p>
                </div>
              ) : (
                /* Select file / One-click simulate */
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-[#DDE2E6] hover:border-[#315D78] rounded-md p-6 text-center cursor-pointer bg-[#FAFBFB] transition-colors">
                    <FileUp size={28} className="mx-auto text-[#68737D] mb-2" />
                    <p className="font-medium text-[#20272E]">Drag & Drop Customer RFP Specification (PDF, CSV, JSON)</p>
                    <p className="text-[11px] text-[#9AAAB5] mt-1">Accepts vendor equipment data sheets up to 50 MB</p>
                  </div>

                  <div className="pt-2">
                    <p className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide mb-2">
                      Demonstration Sample File:
                    </p>
                    <button
                      className="w-full btn-primary justify-between py-2.5 px-3 bg-[#315D78] hover:bg-[#264A62]"
                      onClick={() => handleIngestDocument('Customer_Spec_Rev1.pdf')}
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <FileText size={14} />
                        Customer_Spec_Rev1.pdf (Chemical Dosing Skid Spec)
                      </span>
                      <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded font-mono">
                        10 Extracted Reqs
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[#DDE2E6] bg-[#F8FAFB] flex justify-end gap-2">
              <button
                className="btn-secondary"
                disabled={isIngesting}
                onClick={() => setIsIngestModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: MANUAL REQUIREMENT ENTRY & EDIT                   */}
      {/* ======================================================== */}
      {isModalOpen && modalReq && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-md border border-[#DDE2E6] shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#DDE2E6] bg-[#202830] text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#315D78] flex items-center justify-center">
                  <Plus size={14} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-[13.5px] leading-tight">
                    {isAddingNew ? 'Enter New Engineering Requirement' : `Edit Requirement [${modalReq.id}]`}
                  </h3>
                  <p className="text-[11px] text-[#9AAAB5] leading-tight">
                    Enquiry Context: {enquiry.reference} — {enquiry.title}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#9AAAB5] hover:text-white p-1 rounded hover:bg-[#2D3A47]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Demo Templates Bar */}
            {isAddingNew && (
              <div className="px-5 py-2.5 bg-[#F4F5F6] border-b border-[#DDE2E6] flex items-center gap-2 flex-shrink-0 overflow-x-auto">
                <span className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide whitespace-nowrap flex items-center gap-1">
                  <Sparkles size={11} className="text-[#315D78]" /> Quick Demo Templates:
                </span>
                <button
                  type="button"
                  onClick={() => applyTemplate('inlet')}
                  className="text-[11px] bg-white hover:bg-[#EBF2F7] text-[#315D78] px-2 py-0.5 rounded border border-[#C5D9E8] font-medium whitespace-nowrap"
                >
                  Inlet DN125
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('flow')}
                  className="text-[11px] bg-white hover:bg-[#EBF2F7] text-[#315D78] px-2 py-0.5 rounded border border-[#C5D9E8] font-medium whitespace-nowrap"
                >
                  Flow 65 m³/h
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('pressure')}
                  className="text-[11px] bg-white hover:bg-[#EBF2F7] text-[#315D78] px-2 py-0.5 rounded border border-[#C5D9E8] font-medium whitespace-nowrap"
                >
                  Head 48 m
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('material')}
                  className="text-[11px] bg-white hover:bg-[#EBF2F7] text-[#315D78] px-2 py-0.5 rounded border border-[#C5D9E8] font-medium whitespace-nowrap"
                >
                  316L SS Wetted
                </button>
              </div>
            )}

            {/* Modal Form Body */}
            <div className="p-5 overflow-y-auto space-y-3.5 text-[12px]">
              <div>
                <label className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide block mb-1">
                  Requirement Name *
                </label>
                <input
                  className="eng-input text-[13px] font-medium"
                  placeholder="e.g. Inlet Connection Size, Design Flow Rate, Operating Temp..."
                  value={modalReq.name}
                  onChange={e => setModalReq({ ...modalReq, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide block mb-1">
                    Engineering Category *
                  </label>
                  <select
                    className="eng-select w-full"
                    value={modalReq.category}
                    onChange={e => setModalReq({ ...modalReq, category: e.target.value as RequirementCategory })}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide block mb-1">
                    Confirmation Status
                  </label>
                  <select
                    className="eng-select w-full"
                    value={modalReq.status}
                    onChange={e => setModalReq({ ...modalReq, status: e.target.value as ConfirmationStatus })}
                  >
                    <option value="confirmed">Confirmed (Verified with Customer)</option>
                    <option value="unconfirmed">Unconfirmed (Provisional)</option>
                    <option value="missing">Missing (Not Specified)</option>
                    <option value="conflicting">Conflicting (Requires Alignment)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide block mb-1">
                    Target Required Value
                  </label>
                  <input
                    className="eng-input font-mono font-bold"
                    placeholder="e.g. 125, 65, 316L Stainless Steel..."
                    value={modalReq.value !== undefined ? String(modalReq.value) : ''}
                    onChange={e => setModalReq({ ...modalReq, value: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide block mb-1">
                    Unit of Measure
                  </label>
                  <input
                    className="eng-input font-mono"
                    placeholder="mm, m³/h, bar, °C..."
                    value={modalReq.unit ?? ''}
                    onChange={e => setModalReq({ ...modalReq, unit: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide block mb-1">
                    Engineering Priority
                  </label>
                  <select
                    className="eng-select w-full"
                    value={modalReq.priority}
                    onChange={e => setModalReq({ ...modalReq, priority: e.target.value as Priority })}
                  >
                    <option value="critical">Critical (Blocks Release)</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide block mb-1">
                    Source Document Reference
                  </label>
                  <input
                    className="eng-input"
                    placeholder="e.g. Customer Spec Rev 1, Section 3.1"
                    value={modalReq.source ?? ''}
                    onChange={e => setModalReq({ ...modalReq, source: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide block mb-1">
                  Description & Functional Intent
                </label>
                <textarea
                  className="eng-input"
                  rows={2}
                  placeholder="Provide mechanical explanation of why this parameter is required..."
                  value={modalReq.description}
                  onChange={e => setModalReq({ ...modalReq, description: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide block mb-1">
                  Engineering Notes / Downstream Constraints
                </label>
                <input
                  className="eng-input"
                  placeholder="e.g. Requires DN125 PN16 flange rating, verify casing wall stress..."
                  value={modalReq.notes ?? ''}
                  onChange={e => setModalReq({ ...modalReq, notes: e.target.value })}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3 border-t border-[#DDE2E6] bg-[#F8FAFB] flex items-center justify-between flex-shrink-0">
              <span className="text-[11px] text-[#68737D]">
                Updates live in-memory store & triggers comparison recalculations.
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!modalReq.name.trim()}
                  onClick={handleSaveModalReq}
                >
                  <Check size={13} /> {isAddingNew ? 'Add Requirement to Brief' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE BRAND NEW ENQUIRY                          */}
      {/* ======================================================== */}
      {isNewEnquiryModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-md border border-[#DDE2E6] shadow-2xl max-w-lg w-full flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#DDE2E6] bg-[#202830] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-[#315D78]" />
                <h3 className="font-bold text-[14px]">Create New Customer Enquiry</h3>
              </div>
              <button
                onClick={() => setIsNewEnquiryModalOpen(false)}
                className="text-[#9AAAB5] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-[12px]">
              <div>
                <label className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide block mb-1">
                  Enquiry Reference Code *
                </label>
                <input
                  className="eng-input font-mono font-semibold"
                  value={newEnquiryRef}
                  onChange={e => setNewEnquiryRef(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide block mb-1">
                  Equipment Project Title *
                </label>
                <input
                  className="eng-input font-medium"
                  placeholder="e.g. High-Pressure Boiler Feed Pump Unit..."
                  value={newEnquiryTitle}
                  onChange={e => setNewEnquiryTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide block mb-1">
                  Project Description
                </label>
                <textarea
                  className="eng-input"
                  rows={3}
                  placeholder="Enter initial customer scope, plant location, process media..."
                  value={newEnquiryDesc}
                  onChange={e => setNewEnquiryDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-[#68737D] uppercase tracking-wide block mb-1">
                  Project Priority
                </label>
                <select
                  className="eng-select w-full"
                  value={newEnquiryPriority}
                  onChange={e => setNewEnquiryPriority(e.target.value as Priority)}
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#DDE2E6] bg-[#F8FAFB] flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => setIsNewEnquiryModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={!newEnquiryTitle.trim()}
                onClick={handleCreateNewEnquiry}
              >
                <Plus size={13} /> Initialize Enquiry Brief
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
