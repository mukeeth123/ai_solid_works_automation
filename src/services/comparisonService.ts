// ============================================================
// VOLM Engineering Intelligence — Comparison Service
// ============================================================

import type {
  Enquiry,
  EngineeringFile,
  ComparisonResult,
  ComparisonRow,
  ReusabilityOutcome,
  MatchStatus,
} from '../types/engineering';

export function runComparison(enquiry: Enquiry, file: EngineeringFile): ComparisonResult {
  const rows: ComparisonRow[] = [];
  let matchCount = 0;
  let mismatchCount = 0;
  let unknownCount = 0;

  for (const req of enquiry.requirements) {
    if (req.status === 'missing') {
      rows.push({
        id: `cmprow-${req.id}`,
        requirementId: req.id,
        parameterName: req.name,
        sourceFileId: file.id,
        currentValue: undefined,
        requiredValue: undefined,
        unit: req.unit,
        matchStatus: 'unknown',
        engineeringNote: 'Requirement not specified — cannot compare.',
      });
      unknownCount++;
      continue;
    }

    // Try to find a matching dimension/parameter in the file
    const matchedDim = file.dimensions.find(d =>
      d.name.toLowerCase().includes(req.name.toLowerCase().replace(/\s/g, '')) ||
      req.relatedDesignParameters?.some(p => p.toLowerCase() === d.name.toLowerCase())
    );

    let matchStatus: MatchStatus = 'unknown';
    let currentValue: string | number | undefined;
    let difference: number | string | undefined;

    if (matchedDim) {
      currentValue = matchedDim.value;
      const reqVal = typeof req.value === 'number' ? req.value : undefined;
      if (reqVal !== undefined) {
        const diff = matchedDim.value - reqVal;
        difference = diff;
        if (Math.abs(diff) < 0.01) {
          matchStatus = 'match';
          matchCount++;
        } else {
          matchStatus = 'mismatch';
          mismatchCount++;
        }
      } else if (req.value !== undefined) {
        // String comparison
        matchStatus = String(matchedDim.value) === String(req.value) ? 'match' : 'mismatch';
        if (matchStatus === 'match') matchCount++;
        else mismatchCount++;
      } else {
        matchStatus = 'unknown';
        unknownCount++;
      }
    } else {
      // Try custom properties
      const propKey = Object.keys(file.customProperties).find(k =>
        k.toLowerCase().includes(req.name.toLowerCase().replace(/\s/g, ''))
      );
      if (propKey) {
        currentValue = file.customProperties[propKey] as string | number;
        matchStatus = 'review_required';
        unknownCount++;
      } else {
        matchStatus = 'unknown';
        unknownCount++;
      }
    }

    rows.push({
      id: `cmprow-auto-${req.id}`,
      requirementId: req.id,
      parameterName: req.name,
      sourceFileId: file.id,
      currentValue,
      requiredValue: req.value,
      unit: req.unit,
      difference,
      matchStatus,
      engineeringNote: matchStatus === 'unknown'
        ? 'Parameter not found in source file metadata. Manual review required.'
        : matchStatus === 'review_required'
        ? 'Value found in custom properties — verify against source geometry.'
        : undefined,
    });
  }

  const total = rows.length;
  const coveragePercent = total > 0 ? Math.round(((matchCount + mismatchCount) / total) * 100) : 0;

  let outcome: ReusabilityOutcome;
  if (mismatchCount === 0 && unknownCount === 0) {
    outcome = 'reuse_candidate';
  } else if (mismatchCount <= 3 && matchCount > 0) {
    outcome = 'modify_candidate';
  } else {
    outcome = 'new_design_required';
  }

  return {
    id: `cmp-auto-${Date.now()}`,
    enquiryId: enquiry.id,
    sourceFileId: file.id,
    comparedAt: new Date().toISOString(),
    outcome,
    outcomeRationale: buildOutcomeRationale(outcome, matchCount, mismatchCount, unknownCount),
    rows,
    matchCount,
    mismatchCount,
    unknownCount,
    coveragePercent,
  };
}

function buildOutcomeRationale(
  outcome: ReusabilityOutcome,
  matchCount: number,
  mismatchCount: number,
  unknownCount: number
): string {
  switch (outcome) {
    case 'reuse_candidate':
      return `All ${matchCount} compared parameters match requirements. No geometry changes required based on available metadata. Verify drawings and BOM before reuse.`;
    case 'modify_candidate':
      return `${matchCount} parameters match; ${mismatchCount} mismatch; ${unknownCount} unknown. Targeted modifications are likely sufficient. Engineering assessment required before confirming suitability.`;
    case 'new_design_required':
      return `${mismatchCount} parameters do not match requirements. Extent of changes may exceed viable modification scope. A new design should be evaluated. Engineering judgement required.`;
  }
}

// ---- BOM Generator ----

import type { BOM, BOMItem, Assembly } from '../types/engineering';

export function generateBOMFromAssembly(
  assembly: Assembly,
  enquiryId: string,
  configName?: string
): BOM {
  const items: BOMItem[] = assembly.components.map((comp, idx) => ({
    id: `bom-gen-${comp.id}`,
    bomId: `bom-gen-${assembly.id}`,
    itemNumber: idx + 1,
    partNumber: comp.partNumber ?? comp.fileId,
    description: comp.description ?? 'No description',
    componentFileRef: comp.fileId,
    quantity: comp.quantity,
    unit: comp.unit,
    revision: 'A',
    sourceConfiguration: comp.configuration ?? configName,
    bomType: 'engineering' as const,
    validationStatus: comp.isResolved ? 'passed' : 'review_required' as const,
    erpMapping: undefined,
  }));

  const validationErrors = items
    .filter(i => !i.erpMapping)
    .map(i => ({
      id: `bve-gen-${i.id}`,
      itemId: i.id,
      field: 'erpMapping',
      severity: 'info' as const,
      message: `ERP mapping not set for ${i.partNumber}.`,
    }));

  return {
    id: `bom-gen-${Date.now()}`,
    enquiryId,
    assemblyId: assembly.id,
    assemblyConfiguration: configName ?? assembly.activeConfiguration,
    bomType: 'engineering',
    revision: assembly.revision,
    generatedAt: new Date().toISOString(),
    items,
    validationErrors,
    isProposed: false,
    sourceLabel: `Generated from ${assembly.fileName} — Rev ${assembly.revision}. Illustrative sample data.`,
  };
}
