// ============================================================
// VOLM Engineering Intelligence — Core Type Definitions
// Illustrative sample engineering data — not VOLM source data.
// ============================================================

// ---- Shared primitives ----

export type ID = string;
export type ISODateString = string;

export type ConfirmationStatus = 'missing' | 'unconfirmed' | 'confirmed' | 'conflicting';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type LifecycleState = 'draft' | 'in_review' | 'released' | 'obsolete' | 'archived';
export type FileType = 'SLDPRT' | 'SLDASM' | 'SLDDRW' | 'PDF' | 'CSV' | 'JSON' | 'other';
export type BOMType = 'engineering' | 'manufacturing' | 'service';
export type ValidationStatus = 'not_run' | 'passed' | 'failed' | 'review_required' | 'not_applicable';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revision_requested';
export type MatchStatus = 'match' | 'mismatch' | 'unknown' | 'review_required' | 'not_applicable';
export type CADAdapterType = 'mock' | 'solidworks' | 'cadabra' | 'forge';
export type ExecutionStatus = 'idle' | 'preparing' | 'executing' | 'rebuilding' | 'verifying' | 'complete' | 'failed' | 'cancelled';
export type ChangeOperation =
  | 'change_dimension'
  | 'change_parameter'
  | 'modify_feature'
  | 'add_feature'
  | 'suppress_feature'
  | 'update_configuration'
  | 'replace_component'
  | 'manual_engineering';

export type RequirementCategory =
  | 'dimensions'
  | 'capacity_load'
  | 'operating_conditions'
  | 'materials'
  | 'interfaces'
  | 'geometry_clearance'
  | 'safety_guarding'
  | 'documentation'
  | 'manufacturing_constraints'
  | 'other';

// ---- Data Source ----

export interface DataSource {
  id: ID;
  name: string;
  type: 'demo' | 'json_import' | 'csv_import' | 'solidworks_connector' | 'cadabra' | 'forge';
  status: 'active' | 'inactive' | 'error' | 'demo';
  description: string;
  lastSync?: ISODateString;
  version?: string;
}

// ---- Enquiry & Requirements ----

export interface Requirement {
  id: ID;
  enquiryId: ID;
  name: string;
  description: string;
  value?: string | number;
  unit?: string;
  category: RequirementCategory;
  source?: string;
  sourceLocation?: string;
  status: ConfirmationStatus;
  priority: Priority;
  notes?: string;
  relatedDesignParameters?: string[];
  validationRule?: string;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export interface Enquiry {
  id: ID;
  reference: string;
  title: string;
  description: string;
  priority: Priority;
  status: 'open' | 'in_progress' | 'pending_review' | 'completed' | 'cancelled';
  customerRef?: string;
  requirements: Requirement[];
  sourceDocuments: SourceDocument[];
  selectedCandidateId?: ID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: string;
}

export interface SourceDocument {
  id: ID;
  enquiryId: ID;
  name: string;
  type: 'pdf' | 'csv' | 'json' | 'text' | 'other';
  size?: number;
  importedAt: ISODateString;
  status: 'imported' | 'processing' | 'error';
  extractedRequirements: number;
}

// ---- Engineering Files ----

export interface DimensionParameter {
  id: ID;
  name: string;
  feature?: string;
  value: number;
  unit: string;
  editable: boolean;
  description?: string;
  minValue?: number;
  maxValue?: number;
  tolerance?: string;
}

export interface Feature {
  id: ID;
  name: string;
  type: string;
  suppressed: boolean;
  failed: boolean;
  editable: boolean;
  parentId?: ID;
  parameters?: DimensionParameter[];
  sketchRef?: string;
  description?: string;
}

export interface Configuration {
  id: ID;
  fileId: ID;
  name: string;
  isActive: boolean;
  description?: string;
  properties: Record<string, string | number | boolean>;
  suppressedFeatures?: ID[];
}

export interface Revision {
  id: ID;
  fileId: ID;
  revisionCode: string;
  description?: string;
  author: string;
  timestamp: ISODateString;
  lifecycleState: LifecycleState;
  comment?: string;
}

export interface DrawingReference {
  id: ID;
  fileId: ID;
  drawingNumber: string;
  fileName: string;
  revision: string;
  sheetCount: number;
  modelRef: ID;
  views?: string[];
  reviewStatus: 'current' | 'update_required' | 'superseded' | 'missing';
  lastModified: ISODateString;
}

export interface EngineeringFile {
  id: ID;
  fileName: string;
  fileType: FileType;
  partNumber?: string;
  description: string;
  revision: string;
  version?: string;
  lifecycleState: LifecycleState;
  activeConfiguration?: string;
  configurations: Configuration[];
  material?: string;
  density?: number;
  mass?: number;
  volume?: number;
  surfaceArea?: number;
  units: string;
  boundingBox?: { length: number; width: number; height: number; unit: string };
  features: Feature[];
  dimensions: DimensionParameter[];
  drawings: DrawingReference[];
  revisions: Revision[];
  customProperties: Record<string, string | number | boolean>;
  sourceSystem: string;
  filePath?: string;
  lastModified: ISODateString;
  importedAt: ISODateString;
  importStatus: 'complete' | 'partial' | 'error';
  missingFields: string[];
}

// ---- Assembly ----

export interface AssemblyComponent {
  id: ID;
  assemblyId: ID;
  fileId: ID;
  partNumber?: string;
  description?: string;
  quantity: number;
  unit: string;
  configuration?: string;
  isFixed: boolean;
  isResolved: boolean;
  suppressedInConfigs?: string[];
  parentComponentId?: ID;
}

export interface Assembly extends EngineeringFile {
  components: AssemblyComponent[];
  unresolvedRefs: string[];
}

// ---- Comparison ----

export interface ComparisonRow {
  id: ID;
  requirementId: ID;
  parameterName: string;
  sourceFileId: ID;
  sourceConfiguration?: string;
  currentValue?: string | number;
  requiredValue?: string | number;
  unit?: string;
  difference?: number | string;
  matchStatus: MatchStatus;
  sourceEvidence?: string;
  engineeringNote?: string;
}

export type ReusabilityOutcome = 'reuse_candidate' | 'modify_candidate' | 'new_design_required';

export interface ComparisonResult {
  id: ID;
  enquiryId: ID;
  sourceFileId: ID;
  comparedAt: ISODateString;
  outcome: ReusabilityOutcome;
  outcomeRationale: string;
  rows: ComparisonRow[];
  matchCount: number;
  mismatchCount: number;
  unknownCount: number;
  coveragePercent: number;
}

// ---- Change Planning ----

export interface ChangeDependency {
  changeId: ID;
  dependsOnChangeId?: ID;
  affectedComponentId?: ID;
  affectedDrawingId?: ID;
  affectedBOMItemId?: ID;
  type: 'requires' | 'affects_component' | 'affects_drawing' | 'affects_bom';
  description: string;
  isKnown: boolean;
}

export interface ProposedChange {
  id: ID;
  enquiryId: ID;
  requirementId: ID;
  targetFileId: ID;
  targetConfiguration?: string;
  targetFeatureId?: ID;
  targetParameterId?: ID;
  operation: ChangeOperation;
  currentValue?: string | number;
  proposedValue: string | number;
  unit?: string;
  reason: string;
  dependencies: ChangeDependency[];
  expectedResult: string;
  requiredValidation: string[];
  reviewer?: string;
  approvalStatus: ApprovalStatus;
  approvalNote?: string;
  approvedAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---- CAD Execution ----

export interface CADExecution {
  id: ID;
  changeId: ID;
  targetFileId: ID;
  targetConfiguration?: string;
  operation: ChangeOperation;
  adapter: CADAdapterType;
  status: ExecutionStatus;
  approvalState: ApprovalStatus;
  previousValue?: string | number;
  proposedValue: string | number;
  actualResult?: string | number;
  workingCopyRef?: string;
  outputFileRef?: string;
  startedAt?: ISODateString;
  completedAt?: ISODateString;
  errorDetails?: string;
  executionLog: ExecutionLogEntry[];
  validationResult?: ValidationResult;
  isSimulated: boolean;
}

export interface ExecutionLogEntry {
  timestamp: ISODateString;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  detail?: string;
}

export interface ValidationResult {
  expectedValue: string | number;
  actualValue?: string | number;
  passed: boolean;
  checks: ValidationCheck[];
  timestamp: ISODateString;
}

// ---- Engineering Review ----

export interface ValidationCheck {
  id: ID;
  description: string;
  source: string;
  status: ValidationStatus;
  evidence?: string;
  timestamp?: ISODateString;
  reviewer?: string;
  checkType:
    | 'parameter_value'
    | 'rebuild_result'
    | 'feature_state'
    | 'component_reference'
    | 'configuration_error'
    | 'assembly_mate'
    | 'clearance'
    | 'material'
    | 'structural'
    | 'safety'
    | 'manufacturing';
}

export interface DrawingReview {
  id: ID;
  drawingId: ID;
  drawingNumber: string;
  sourceModel: ID;
  revision: string;
  sheetCount: number;
  affectedViews: string[];
  dimensionsToReview: string[];
  updateStatus: 'not_required' | 'update_required' | 'updated' | 'superseded';
  validationFindings: string[];
  reviewer?: string;
  reviewedAt?: ISODateString;
}

export interface EngineeringReview {
  id: ID;
  enquiryId: ID;
  sourceFileId: ID;
  resultFileId?: ID;
  changesProposed: number;
  changesExecuted: number;
  validationChecks: ValidationCheck[];
  drawingReviews: DrawingReview[];
  reviewerDecisions: ReviewerDecision[];
  bomValidationStatus: ValidationStatus;
  releaseReadiness: 'not_ready' | 'pending_checks' | 'ready_for_review' | 'approved_for_release';
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ReviewerDecision {
  id: ID;
  reviewer: string;
  decision: 'approved' | 'rejected' | 'revision_requested';
  comment?: string;
  timestamp: ISODateString;
  scope: string;
}

// ---- BOM ----

export interface BOMItem {
  id: ID;
  bomId: ID;
  itemNumber: number;
  partNumber: string;
  description: string;
  componentFileRef?: ID;
  quantity: number;
  unit: string;
  material?: string;
  revision: string;
  sourceConfiguration?: string;
  bomType: BOMType;
  validationStatus: ValidationStatus;
  partMasterRef?: string;
  erpMapping?: string;
  parentItemId?: ID;
  isModified?: boolean;
  modificationNote?: string;
}

export interface BOMDiff {
  addedItems: BOMItem[];
  removedItems: BOMItem[];
  modifiedItems: Array<{ previous: BOMItem; current: BOMItem; changes: string[] }>;
  missingProperties: Array<{ itemId: ID; fields: string[] }>;
  unresolvedRefs: string[];
}

export interface BOM {
  id: ID;
  enquiryId: ID;
  assemblyId: ID;
  assemblyConfiguration?: string;
  bomType: BOMType;
  revision: string;
  generatedAt: ISODateString;
  items: BOMItem[];
  validationErrors: BOMValidationError[];
  diff?: BOMDiff;
  isProposed: boolean;
  sourceLabel: string;
}

export interface BOMValidationError {
  id: ID;
  itemId?: ID;
  field?: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

// ---- Main Assembly Coordination ----

export interface MainAssemblyMate {
  id: ID;
  name: string;
  mateType: 'coincident' | 'concentric' | 'distance' | 'parallel' | 'perpendicular';
  component1Id: ID;
  component2Id: ID;
  entity1: string;
  entity2: string;
  alignment: 'aligned' | 'anti_aligned' | 'closest';
  status: 'satisfied' | 'over_defined' | 'broken';
  toleranceMm?: number;
}

export interface MainAssemblyItem {
  id: ID;
  assemblyRefId: ID;
  partNumber: string;
  fileName: string;
  description: string;
  category: 'standard_reuse' | 'modified';
  modificationStatus: 'verified' | 'modified_rebuilt' | 'pending_modification' | 'not_required';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  quantity: number;
  revision: string;
  massKg: number;
  isFixed: boolean;
  isSuppressed: boolean;
  boundingBox: { length: number; width: number; height: number; unit: string };
  mateIds: string[];
  notes: string;
}

export interface MainAssemblyValidation {
  allAssembliesResolved: boolean;
  mateSatisfactionRate: number; // 0 to 100%
  envelopeStatus: 'within_limit' | 'exceeds_limit';
  overallDimensions: { length: number; width: number; height: number; unit: string };
  centerOfGravity: { x: number; y: number; z: number };
  totalMassKg: number;
  unresolvedCount: number;
  validationTimestamp: ISODateString;
}

// ---- Audit ----

export interface AuditEvent {
  id: ID;
  timestamp: ISODateString;
  actor: string;
  action: string;
  entityType: string;
  entityId: ID;
  detail: string;
  enquiryId?: ID;
}

// ---- Integration Status ----

export interface IntegrationStatus {
  adapter: CADAdapterType;
  name: string;
  connected: boolean;
  version?: string;
  capabilities: string[];
  lastTested?: ISODateString;
  notes: string;
}

// ---- Application State ----

export interface AppState {
  activeEnquiryId?: ID;
  selectedFileId?: ID;
  selectedChangeId?: ID;
  activeExecutionId?: ID;
  activeReviewId?: ID;
  activeBOMId?: ID;
  dataSources: DataSource[];
  integrations: IntegrationStatus[];
  currentUser: string;
  currentWorkspace: string;
}
