// ============================================================
// VOLM Engineering Intelligence — Export Services
// ============================================================

import type { BOM, BOMItem, ProposedChange, EngineeringReview, CADExecution, Enquiry } from '../types/engineering';

// ---- CSV BOM Export ----

export function exportBOMasCSV(bom: BOM, items: BOMItem[]): void {
  const headers = [
    'Item No.', 'Part Number', 'Description', 'Component File Ref',
    'Qty', 'Unit', 'Material', 'Revision', 'Configuration',
    'BOM Type', 'Validation Status', 'ERP Mapping',
  ];

  const rows = items.map(item => [
    item.itemNumber,
    item.partNumber,
    item.description,
    item.componentFileRef ?? '',
    item.quantity,
    item.unit,
    item.material ?? '',
    item.revision,
    item.sourceConfiguration ?? '',
    item.bomType,
    item.validationStatus,
    item.erpMapping ?? '',
  ]);

  const csvContent = [
    `# VOLM Engineering Intelligence — BOM Export`,
    `# Source: ${bom.sourceLabel}`,
    `# Generated: ${new Date().toISOString()}`,
    `# Assembly: ${bom.assemblyId} / Rev ${bom.revision}`,
    `# Illustrative sample engineering data — not VOLM source data.`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  downloadFile(csvContent, `BOM_${bom.assemblyId}_Rev${bom.revision}_${formatDate(new Date())}.csv`, 'text/csv;charset=utf-8');
}

// ---- JSON Change Summary Export ----

export interface ChangeSummaryExport {
  exportType: 'VOLM_Engineering_Change_Summary';
  exportVersion: string;
  generatedAt: string;
  disclaimer: string;
  enquiry: {
    id: string;
    reference: string;
    title: string;
  };
  changes: Array<{
    changeId: string;
    operation: string;
    targetFile: string;
    targetConfiguration?: string;
    currentValue?: string | number;
    proposedValue: string | number;
    unit?: string;
    reason: string;
    approvalStatus: string;
    reviewer?: string;
    approvedAt?: string;
  }>;
  executions: Array<{
    executionId: string;
    changeId: string;
    adapter: string;
    status: string;
    isSimulated: boolean;
    startedAt?: string;
    completedAt?: string;
    actualResult?: string | number;
    validationPassed?: boolean;
    errorDetails?: string;
  }>;
  review: {
    changesProposed: number;
    changesExecuted: number;
    validationPassed: number;
    validationFailed: number;
    validationPending: number;
    drawingsRequiringUpdate: number;
    bomValidationStatus: string;
    releaseReadiness: string;
    outstandingChecks: string[];
  };
}

export function exportChangeSummaryJSON(
  enquiry: Enquiry,
  changes: ProposedChange[],
  executions: CADExecution[],
  review: EngineeringReview
): void {
  const outstandingChecks = review.validationChecks
    .filter(c => c.status === 'not_run' || c.status === 'failed' || c.status === 'review_required')
    .map(c => `[${c.status.toUpperCase()}] ${c.description}`);

  const summary: ChangeSummaryExport = {
    exportType: 'VOLM_Engineering_Change_Summary',
    exportVersion: '1.0',
    generatedAt: new Date().toISOString(),
    disclaimer: 'Illustrative sample engineering data — not VOLM source data. Simulated CAD operations — no native SOLIDWORKS files were modified.',
    enquiry: {
      id: enquiry.id,
      reference: enquiry.reference,
      title: enquiry.title,
    },
    changes: changes.map(c => ({
      changeId: c.id,
      operation: c.operation,
      targetFile: c.targetFileId,
      targetConfiguration: c.targetConfiguration,
      currentValue: c.currentValue,
      proposedValue: c.proposedValue,
      unit: c.unit,
      reason: c.reason,
      approvalStatus: c.approvalStatus,
      reviewer: c.reviewer,
      approvedAt: c.approvedAt,
    })),
    executions: executions.map(e => ({
      executionId: e.id,
      changeId: e.changeId,
      adapter: e.adapter,
      status: e.status,
      isSimulated: e.isSimulated,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      actualResult: e.actualResult,
      validationPassed: e.validationResult?.passed,
      errorDetails: e.errorDetails,
    })),
    review: {
      changesProposed: review.changesProposed,
      changesExecuted: review.changesExecuted,
      validationPassed: review.validationChecks.filter(c => c.status === 'passed').length,
      validationFailed: review.validationChecks.filter(c => c.status === 'failed').length,
      validationPending: review.validationChecks.filter(c => c.status === 'not_run').length,
      drawingsRequiringUpdate: review.drawingReviews.filter(d => d.updateStatus === 'update_required').length,
      bomValidationStatus: review.bomValidationStatus,
      releaseReadiness: review.releaseReadiness,
      outstandingChecks,
    },
  };

  const jsonContent = JSON.stringify(summary, null, 2);
  downloadFile(jsonContent, `ChangeSummary_${enquiry.reference}_${formatDate(new Date())}.json`, 'application/json');
}

// ---- Utility ----

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}
