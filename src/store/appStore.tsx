// ============================================================
// VOLM Engineering Intelligence — Application State Store
// ============================================================

import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type {
  Enquiry,
  Requirement,
  EngineeringFile,
  Assembly,
  ComparisonResult,
  ProposedChange,
  CADExecution,
  BOM,
  EngineeringReview,
  AuditEvent,
  DataSource,
  IntegrationStatus,
  ID,
  ApprovalStatus,
  ExecutionStatus,
} from '../types/engineering';
import {
  DEMO_ENQUIRIES,
  DEMO_PARTS,
  DEMO_ASSEMBLIES,
  DEMO_SUB_ASSEMBLIES,
  DEMO_COMPARISON,
  DEMO_CHANGES,
  DEMO_EXECUTIONS,
  DEMO_BOM,
  DEMO_REVIEW,
  DEMO_AUDIT,
  DEMO_DATA_SOURCES,
  DEMO_INTEGRATIONS,
} from '../data/sampleData';

// ---- State Shape ----

export interface StoreState {
  // Entities
  enquiries: Enquiry[];
  files: EngineeringFile[];
  assemblies: Assembly[];
  comparisonResults: ComparisonResult[];
  proposedChanges: ProposedChange[];
  executions: CADExecution[];
  boms: BOM[];
  reviews: EngineeringReview[];
  auditEvents: AuditEvent[];
  dataSources: DataSource[];
  integrations: IntegrationStatus[];

  // Navigation / selection context
  activeEnquiryId?: ID;
  selectedFileId?: ID;
  selectedChangeId?: ID;
  activeExecutionId?: ID;
  activeReviewId?: ID;
  activeBOMId?: ID;

  // UI
  currentUser: string;
  currentWorkspace: string;
  isDemoMode: boolean;
}

// ---- Actions ----

export type StoreAction =
  | { type: 'SET_ACTIVE_ENQUIRY'; id: ID }
  | { type: 'SET_SELECTED_FILE'; id?: ID }
  | { type: 'SET_SELECTED_CHANGE'; id?: ID }
  | { type: 'SET_ACTIVE_EXECUTION'; id?: ID }
  | { type: 'SET_ACTIVE_REVIEW'; id?: ID }
  | { type: 'SET_ACTIVE_BOM'; id?: ID }
  | { type: 'UPSERT_ENQUIRY'; enquiry: Enquiry }
  | { type: 'UPDATE_REQUIREMENT'; enquiryId: ID; requirement: Requirement }
  | { type: 'ADD_REQUIREMENT'; enquiryId: ID; requirement: Requirement }
  | { type: 'DELETE_REQUIREMENT'; enquiryId: ID; requirementId: ID }
  | { type: 'UPSERT_CHANGE'; change: ProposedChange }
  | { type: 'DELETE_CHANGE'; changeId: ID }
  | { type: 'SET_CHANGE_APPROVAL'; changeId: ID; status: ApprovalStatus; note?: string; reviewer?: string }
  | { type: 'UPSERT_EXECUTION'; execution: CADExecution }
  | { type: 'UPDATE_EXECUTION_STATUS'; executionId: ID; status: ExecutionStatus; log?: { timestamp: string; level: 'info' | 'warn' | 'error' | 'debug'; message: string; detail?: string } }
  | { type: 'SET_CANDIDATE'; enquiryId: ID; fileId: ID }
  | { type: 'UPSERT_COMPARISON'; result: ComparisonResult }
  | { type: 'UPSERT_BOM'; bom: BOM }
  | { type: 'UPSERT_REVIEW'; review: EngineeringReview }
  | { type: 'ADD_AUDIT_EVENT'; event: AuditEvent }
  | { type: 'RESET_DEMO' }
  | { type: 'IMPORT_FILES'; files: EngineeringFile[] };

// ---- Initial State ----

const allFiles: EngineeringFile[] = [
  ...(DEMO_PARTS as EngineeringFile[]),
  ...(DEMO_SUB_ASSEMBLIES as EngineeringFile[]),
];

const initialState: StoreState = {
  enquiries: DEMO_ENQUIRIES,
  files: allFiles,
  assemblies: [...DEMO_ASSEMBLIES, ...DEMO_SUB_ASSEMBLIES],
  comparisonResults: [DEMO_COMPARISON],
  proposedChanges: DEMO_CHANGES,
  executions: DEMO_EXECUTIONS,
  boms: [DEMO_BOM],
  reviews: [DEMO_REVIEW],
  auditEvents: DEMO_AUDIT,
  dataSources: DEMO_DATA_SOURCES,
  integrations: DEMO_INTEGRATIONS,
  activeEnquiryId: 'enq-001',
  selectedFileId: undefined,
  selectedChangeId: undefined,
  activeExecutionId: 'exec-001',
  activeReviewId: 'rev-eng-001',
  activeBOMId: 'bom-001',
  currentUser: 'J. Hartmann',
  currentWorkspace: 'Pump Engineering',
  isDemoMode: true,
};

// ---- Reducer ----

function storeReducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'SET_ACTIVE_ENQUIRY':
      return { ...state, activeEnquiryId: action.id };

    case 'SET_SELECTED_FILE':
      return { ...state, selectedFileId: action.id };

    case 'SET_SELECTED_CHANGE':
      return { ...state, selectedChangeId: action.id };

    case 'SET_ACTIVE_EXECUTION':
      return { ...state, activeExecutionId: action.id };

    case 'SET_ACTIVE_REVIEW':
      return { ...state, activeReviewId: action.id };

    case 'SET_ACTIVE_BOM':
      return { ...state, activeBOMId: action.id };

    case 'UPSERT_ENQUIRY': {
      const exists = state.enquiries.find(e => e.id === action.enquiry.id);
      const enquiries = exists
        ? state.enquiries.map(e => e.id === action.enquiry.id ? action.enquiry : e)
        : [...state.enquiries, action.enquiry];
      return { ...state, enquiries };
    }

    case 'UPDATE_REQUIREMENT': {
      const enquiries = state.enquiries.map(enq => {
        if (enq.id !== action.enquiryId) return enq;
        return {
          ...enq,
          requirements: enq.requirements.map(r => r.id === action.requirement.id ? action.requirement : r),
          updatedAt: new Date().toISOString(),
        };
      });
      return { ...state, enquiries };
    }

    case 'ADD_REQUIREMENT': {
      const enquiries = state.enquiries.map(enq => {
        if (enq.id !== action.enquiryId) return enq;
        return { ...enq, requirements: [...enq.requirements, action.requirement], updatedAt: new Date().toISOString() };
      });
      return { ...state, enquiries };
    }

    case 'DELETE_REQUIREMENT': {
      const enquiries = state.enquiries.map(enq => {
        if (enq.id !== action.enquiryId) return enq;
        return { ...enq, requirements: enq.requirements.filter(r => r.id !== action.requirementId), updatedAt: new Date().toISOString() };
      });
      return { ...state, enquiries };
    }

    case 'SET_CANDIDATE': {
      const enquiries = state.enquiries.map(enq =>
        enq.id === action.enquiryId ? { ...enq, selectedCandidateId: action.fileId, updatedAt: new Date().toISOString() } : enq
      );
      return { ...state, enquiries };
    }

    case 'UPSERT_CHANGE': {
      const exists = state.proposedChanges.find(c => c.id === action.change.id);
      const proposedChanges = exists
        ? state.proposedChanges.map(c => c.id === action.change.id ? action.change : c)
        : [...state.proposedChanges, action.change];
      return { ...state, proposedChanges };
    }

    case 'DELETE_CHANGE': {
      return { ...state, proposedChanges: state.proposedChanges.filter(c => c.id !== action.changeId) };
    }

    case 'SET_CHANGE_APPROVAL': {
      const proposedChanges = state.proposedChanges.map(c => {
        if (c.id !== action.changeId) return c;
        return {
          ...c,
          approvalStatus: action.status,
          approvalNote: action.note ?? c.approvalNote,
          reviewer: action.reviewer ?? c.reviewer,
          approvedAt: action.status === 'approved' ? new Date().toISOString() : c.approvedAt,
          updatedAt: new Date().toISOString(),
        };
      });
      return { ...state, proposedChanges };
    }

    case 'UPSERT_EXECUTION': {
      const exists = state.executions.find(e => e.id === action.execution.id);
      const executions = exists
        ? state.executions.map(e => e.id === action.execution.id ? action.execution : e)
        : [...state.executions, action.execution];
      return { ...state, executions };
    }

    case 'UPDATE_EXECUTION_STATUS': {
      const executions = state.executions.map(e => {
        if (e.id !== action.executionId) return e;
        return {
          ...e,
          status: action.status,
          executionLog: action.log ? [...e.executionLog, action.log] : e.executionLog,
          completedAt: (action.status === 'complete' || action.status === 'failed') ? new Date().toISOString() : e.completedAt,
        };
      });
      return { ...state, executions };
    }

    case 'UPSERT_COMPARISON': {
      const exists = state.comparisonResults.find(r => r.id === action.result.id);
      const comparisonResults = exists
        ? state.comparisonResults.map(r => r.id === action.result.id ? action.result : r)
        : [...state.comparisonResults, action.result];
      return { ...state, comparisonResults };
    }

    case 'UPSERT_BOM': {
      const exists = state.boms.find(b => b.id === action.bom.id);
      const boms = exists
        ? state.boms.map(b => b.id === action.bom.id ? action.bom : b)
        : [...state.boms, action.bom];
      return { ...state, boms };
    }

    case 'UPSERT_REVIEW': {
      const exists = state.reviews.find(r => r.id === action.review.id);
      const reviews = exists
        ? state.reviews.map(r => r.id === action.review.id ? action.review : r)
        : [...state.reviews, action.review];
      return { ...state, reviews };
    }

    case 'ADD_AUDIT_EVENT': {
      return { ...state, auditEvents: [action.event, ...state.auditEvents] };
    }

    case 'IMPORT_FILES': {
      const existingIds = new Set(state.files.map(f => f.id));
      const newFiles = action.files.filter(f => !existingIds.has(f.id));
      return { ...state, files: [...state.files, ...newFiles] };
    }

    case 'RESET_DEMO': {
      return { ...initialState };
    }

    default:
      return state;
  }
}

// ---- Context ----

interface StoreContextValue {
  state: StoreState;
  dispatch: React.Dispatch<StoreAction>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(storeReducer, initialState);
  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

// ---- Convenience selectors ----

export function useActiveEnquiry() {
  const { state } = useStore();
  return state.enquiries.find(e => e.id === state.activeEnquiryId);
}

export function useSelectedFile() {
  const { state } = useStore();
  const f = state.files.find(f => f.id === state.selectedFileId);
  if (f) return f;
  return state.assemblies.find(a => a.id === state.selectedFileId) as EngineeringFile | undefined;
}

export function useAllFiles(): EngineeringFile[] {
  const { state } = useStore();
  return [...state.files, ...(state.assemblies as EngineeringFile[])];
}

export function useEnquiryChanges(enquiryId?: ID) {
  const { state } = useStore();
  return state.proposedChanges.filter(c => c.enquiryId === enquiryId);
}

export function useEnquiryComparison(enquiryId?: ID) {
  const { state } = useStore();
  return state.comparisonResults.find(c => c.enquiryId === enquiryId);
}
