import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings2, Play, AlertTriangle, CheckCircle, XCircle, Clock,
  Layers, Terminal, RotateCcw, Shield, Activity,
  Info, Database, CheckSquare, ChevronRight, Eye,
  Cpu, FileCode, Sliders, Hash, Compass, Ruler, Scale,
  Sparkles, Send, Copy, Check, Code2, Box
} from 'lucide-react';
import { useStore, useActiveEnquiry, useEnquiryChanges, useAllFiles } from '../store/appStore';
import { getAdapter } from '../services/cadAdapters';
import { SolidWorks3DViewer } from '../components/SolidWorks3DViewer';
import type {
  ProposedChange, CADExecution, CADAdapterType,
  ExecutionLogEntry
} from '../types/engineering';
import {
  StatusBadge, ValidationIcon, cn, ScrollPane, Spinner
} from '../components/shared';

interface CadCopilotMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  title?: string;
  text: string;
  codeSnippet?: {
    language: string;
    code: string;
  };
  metrics?: Array<{ label: string; value: string; status?: 'good' | 'warn' | 'neutral' }>;
  actions?: Array<{ label: string; action: () => void }>;
}

export default function CadChangeCentre() {
  const navigate = useNavigate();
  const { state, dispatch } = useStore();
  const enquiry = useActiveEnquiry();
  const changes = useEnquiryChanges(enquiry?.id);
  const allFiles = useAllFiles();

  const [selectedChangeId, setSelectedChangeId] = useState<string>(
    state.selectedChangeId || (changes.length > 0 ? changes[0].id : '')
  );
  const [selectedAdapter, setSelectedAdapter] = useState<CADAdapterType>('mock');
  const [isExecuting, setIsExecuting] = useState(false);
  const [execStep, setExecStep] = useState<number>(0);
  const [activeCenterView, setActiveCenterView] = useState<'drawing' | 'model3d' | 'featureTree' | 'massProps'>('drawing');
  const [rightPaneTab, setRightPaneTab] = useState<'adapter' | 'copilot'>('adapter');
  const [previewToggle, setPreviewToggle] = useState<'proposed' | 'original'>('proposed');
  const [showConnectorModal, setShowConnectorModal] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string>('Inlet_Port_Boss');

  // CAD Design Copilot state
  const [cadCopilotInput, setCadCopilotInput] = useState('');
  const [isCopilotTyping, setIsCopilotTyping] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copilotMessages, setCopilotMessages] = useState<CadCopilotMessage[]>([
    {
      id: 'cad-copilot-1',
      sender: 'assistant',
      timestamp: 'Just now',
      title: 'Packaging CAD Design & Modification Copilot Initialized',
      text: `Active Model: WEIGHER_DISCHARGE_CHUTE_450.SLDPRT (Configuration: Width_450mm)
Selected Change: CHG-001 (ChuteOutlet_mm: 300 mm → 450 mm, Funnel Angle: 55° → 62°)

I am actively monitoring geometric constraints, USDA/FDA 3-A sanitary guidelines, high-speed produce discharge dynamics (60 BPM), and SOLIDWORKS COM automation for this packaging part. What modification or calculation would you like to perform?`,
      metrics: [
        { label: 'Chute Delta', value: '300 → 450 mm (+50%)', status: 'good' },
        { label: 'Slope Angle', value: '55° → 62° (Anti-Bridging)', status: 'good' },
        { label: 'Material', value: '316L Stainless (Dimpled)', status: 'good' },
        { label: 'Rebuild Status', value: 'Clean (0 errors)', status: 'good' },
      ],
    },
    {
      id: 'cad-copilot-2',
      sender: 'assistant',
      timestamp: 'Just now',
      title: 'Engineering Evaluation: Multi-Head Collector Chute Expansion (CHG-001)',
      text: `Based on customer packaging requirements (60 Bags/min with 2.5kg fresh produce charges), expanding the collector chute outlet width from 300 mm to 450 mm (+50%) and steepening the funnel angle from 55° to 62° eliminates product bridging during batch drops.

Key CAD Geometry & Forming Tube Mating Parameters:
• Chute Outlet Diameter: 300 mm → 450 mm
• Funnel Cone Angle: 55° → 62° steep cone
• Top Intake Flange: Ø750 mm with 8 × Ø12 bolt pattern (BCD Ø710 mm)
• Material Upgrade: Electropolished 316L SS dimpled washdown sheet (Ra < 0.4 µm)`,
      codeSnippet: {
        language: 'csharp',
        code: `// SOLIDWORKS COM API: Modify Collector Chute Outlet & Angle
var swApp = (SldWorks)Marshal.GetActiveObject("SldWorks.Application");
var swModel = (ModelDoc2)swApp.ActiveDoc;

// 1. Set Chute Discharge Outlet Width to 450 mm
var paramOutlet = (Dimension)swModel.Parameter("D1@Discharge_Neck_Extrude");
paramOutlet.SystemValue = 0.450; // SI Meters

// 2. Set Funnel Cone Slope Angle to 62 deg
var paramAngle = (Dimension)swModel.Parameter("D2@Funnel_Cone_Sketch");
paramAngle.SystemValue = 62.0 * Math.PI / 180.0;

// 3. Trigger Parametric Rebuild
bool rebuildOk = swModel.EditRebuild3();`,
      },
    },
  ]);

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleSendCadCopilot = (textToSend?: string) => {
    const query = (textToSend || cadCopilotInput).trim();
    if (!query) return;

    const userMsg: CadCopilotMessage = {
      id: `cad-user-${Date.now()}`,
      sender: 'user',
      timestamp: 'Just now',
      text: query,
    };

    setCopilotMessages(prev => [...prev, userMsg]);
    if (!textToSend) setCadCopilotInput('');
    setIsCopilotTyping(true);

    setTimeout(() => {
      const q = query.toLowerCase();
      let reply: CadCopilotMessage;

      if (q.includes('chute') || q.includes('outlet') || q.includes('funnel') || q.includes('angle') || q.includes('bridging') || q.includes('drop')) {
        reply = {
          id: `cad-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: 'Just now',
          title: 'Weigher Collector Chute & Anti-Bridging Flow Analysis',
          text: `Evaluated produce discharge dynamics through collector funnel for 60 bags/min packaging rate:

• Cross-Sectional Discharge Area:
  Baseline Ø300 mm outlet: Area A = 0.0707 m²
  Proposed Ø450 mm outlet: Area A = 0.1590 m² (+125% area expansion, 2.25× capacity)

• Angle of Repose & Anti-Bridging Verification:
  Produce static friction coefficient against electropolished 316L SS: μ = 0.42 (critical slide angle = 22.8°).
  Steepening funnel cone angle from 55° to 62° ensures gravity acceleration component exceeds cohesive bulk friction by >2.6× margin.

• Drop Clearance & Interfacing:
  450 mm chute outlet collar enters VFFS Ø192 mm forming collar with 40 mm concentric overlap and zero interference.`,
          metrics: [
            { label: 'Drop Rate', value: '60 Finished Bags/min', status: 'good' },
            { label: 'Outlet Area', value: '0.159 m² (+125%)', status: 'good' },
            { label: 'Slope Angle', value: '62° (Passes Anti-Bridging)', status: 'good' },
            { label: 'Forming Tube Mate', value: 'Concentric 0.0 mm Collision', status: 'good' },
          ],
          codeSnippet: {
            language: 'csharp',
            code: `// Modify Collector Chute Dimensions in SOLIDWORKS
var swParamOutlet = (Dimension)swModel.Parameter("D1@Discharge_Neck_Extrude");
swParamOutlet.SystemValue = 0.450; // 450 mm

var swParamAngle = (Dimension)swModel.Parameter("D2@Funnel_Cone_Sketch");
swParamAngle.SystemValue = 62.0 * Math.PI / 180.0; // 62 deg

swModel.EditRebuild3();`,
          },
        };
      } else if (q.includes('jaw') || q.includes('vffs') || q.includes('bag') || q.includes('pouch') || q.includes('width') || q.includes('600')) {
        reply = {
          id: `cad-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: 'Just now',
          title: 'VFFS Sealing Jaw Carriage Extension Analysis (400 mm → 600 mm)',
          text: `Evaluated VFFS Bagging Unit (VOLM_VFFS_BAGGING_UNIT_600.SLDASM) jaw extension for 2.5kg family pouches:

• Required Bag Lay-Flat Width: 600 mm (vs 400 mm baseline standard)
• Crosshead Jaw Span: 650 mm clamp face with dual heated rotary bars
• Sealing Clamp Pressure: 8.5 kN @ 210°C (servo torque reserve: 38%)
• Kinematic Envelope: Sealing jaw carriage clears safety guarding enclosure frame with 115 mm margin.`,
          metrics: [
            { label: 'Target Bag Width', value: '600 mm Lay-Flat', status: 'good' },
            { label: 'Jaw Span', value: '650 mm Extended Carriage', status: 'good' },
            { label: 'Sealing Force', value: '8.5 kN @ 210°C', status: 'good' },
            { label: 'Guard Clearance', value: '115 mm Envelope Margin', status: 'good' },
          ],
        };
      } else if (q.includes('api') || q.includes('com') || q.includes('solidworks') || q.includes('macro') || q.includes('c#') || q.includes('vba') || q.includes('script')) {
        reply = {
          id: `cad-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: 'Just now',
          title: 'SOLIDWORKS C# COM Interop Automation Routine',
          text: `Here is the production-ready C# automation snippet to inject the 450 mm chute parametric change, regenerate the FeatureManager DesignTree, and read back verified bounds via native SolidWorks API:`,
          codeSnippet: {
            language: 'csharp',
            code: `using SolidWorks.Interop.sldworks;
using SolidWorks.Interop.swconst;
using System.Runtime.InteropServices;

public void ExecuteParametricDelta()
{
    // 1. Attach to running Desktop SOLIDWORKS session
    SldWorks swApp = (SldWorks)Marshal.GetActiveObject("SldWorks.Application");
    ModelDoc2 swModel = (ModelDoc2)swApp.ActiveDoc;

    if (swModel.GetPathName().Contains("WEIGHER_DISCHARGE_CHUTE_450.SLDPRT"))
    {
        // 2. Set Chute Outlet dimension (450 mm = 0.450 m)
        Dimension outletDim = (Dimension)swModel.Parameter("D1@Discharge_Neck_Extrude");
        outletDim.SystemValue = 0.450;

        // 3. Set Funnel Cone Slope Angle (62 degrees)
        Dimension angleDim = (Dimension)swModel.Parameter("D2@Funnel_Cone_Sketch");
        angleDim.SystemValue = 62.0 * Math.PI / 180.0;

        // 4. Regenerate feature tree and verify zero rebuild errors
        bool rebuildOk = swModel.EditRebuild3();
        
        // 5. Read back verified value from CAD kernel
        double verifiedValMeters = outletDim.GetSystemValue3((int)swInConfigurationOpts_e.swThisConfiguration, null)[0];
        Console.WriteLine($"Verified Chute Outlet: {verifiedValMeters * 1000.0:F2} mm");
    }
}`,
          },
          metrics: [
            { label: 'API Target', value: 'ISldWorks / IModelDoc2', status: 'good' },
            { label: 'Rebuild Method', value: 'EditRebuild3()', status: 'good' },
            { label: 'Safety Sandbox', value: 'Working Copy Enforced', status: 'good' },
          ],
        };
      } else if (q.includes('material') || q.includes('316') || q.includes('stainless') || q.includes('density') || q.includes('sanitary') || q.includes('fda')) {
        reply = {
          id: `cad-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: 'Just now',
          title: 'Metallurgical Assessment: AISI 304 vs 316L Dimpled Stainless Steel',
          text: `Evaluating proposed change CHG-002 (Material upgrade to electropolished 316L Stainless Steel):

• Food Contact Compliance:
  USDA & FDA 3-A Sanitary Standards mandate 316L SS for high-acid fresh produce washdown.
  Electropolished dimpled finish (Ra < 0.4 µm) prevents wet produce adhesion and eliminates bacterial harborage points.

• Physical Mass Impact on WEIGHER_DISCHARGE_CHUTE_450:
  304 SS Density: 7,930 kg/m³ → Base Mass: 14.80 kg
  316L SS Density: 8,000 kg/m³ @ 450 mm: 18.40 kg (+3.60 kg / +24.3%)

• Fabrication & Forming:
  Dimpled sheet 2.5 mm press-brake formed cone with full-penetration sanitary TIG weld seams ground flush.`,
          metrics: [
            { label: 'Proposed Material', value: 'AISI 316L (1.4404)', status: 'good' },
            { label: 'Surface Finish', value: 'Dimpled Ra < 0.4 µm', status: 'good' },
            { label: 'Mass Delta', value: '+3.60 kg (+24.3%)', status: 'good' },
            { label: 'Sanitary Standard', value: 'FDA 21 CFR / 3-A Pass', status: 'good' },
          ],
        };
      } else {
        reply = {
          id: `cad-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: 'Just now',
          title: 'CAD Engineering Assistant Analysis',
          text: `Analyzed query: "${query}" for ${targetFile?.fileName || 'WEIGHER_DISCHARGE_CHUTE_450.SLDPRT'}.

Geometric Status:
• Chute Outlet: ${displayOutletWidth} mm (Selected Change: ${selectedChange?.id || 'CHG-001'})
• Slope Angle: ${displayAngle}° Cone (Anti-Bridging)
• Top Flange: BCD ${topBcd} mm (${boltHoles})
• Calculated Mass: ${calculatedMass} kg
• SolidWorks Rebuild State: Rebuild Clean (0 errors, 0 warnings)

What specific design action or verification would you like to run?`,
        };
      }

      setCopilotMessages(prev => [...prev, reply]);
      setIsCopilotTyping(false);
    }, 450);
  };

  const logEndRef = useRef<HTMLDivElement>(null);

  const selectedChange = changes.find(c => c.id === selectedChangeId);
  const targetFile = selectedChange ? allFiles.find(f => f.id === selectedChange.targetFileId) : null;
  const existingExec = state.executions.find(e => e.changeId === selectedChangeId);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [existingExec?.executionLog, isExecuting, execStep]);

  // Validation checks for execute capability
  const isApproved = selectedChange?.approvalStatus === 'approved';
  const adapterCapabilities = getAdapter(selectedAdapter).getCapabilities();
  const isOperationSupported = selectedChange
    ? adapterCapabilities.supportedOperations.includes(selectedChange.operation)
    : false;

  let executeDisabledReason = '';
  if (!selectedChange) {
    executeDisabledReason = 'No change proposal selected';
  } else if (!targetFile) {
    executeDisabledReason = 'Target engineering file not found';
  } else if (!isApproved) {
    executeDisabledReason = `Change status is "${selectedChange.approvalStatus}" — must be Approved before CAD execution`;
  } else if (!isOperationSupported) {
    executeDisabledReason = `Selected adapter (${selectedAdapter}) does not support operation: ${selectedChange.operation}`;
  } else if (isExecuting) {
    executeDisabledReason = 'Operation is currently executing...';
  }

  // Value determination for the parametric packaging drawing
  const isModified = existingExec?.status === 'complete' || (previewToggle === 'proposed' && selectedChange?.operation === 'change_dimension');
  const displayOutletWidth = isModified && selectedChange?.operation === 'change_dimension' ? Number(selectedChange.proposedValue) : 300;
  const isWideChute = displayOutletWidth >= 400;
  const displayAngle = isWideChute ? 62 : 55;
  const topFlangeDia = 750;
  const topBcd = 710;
  const boltHoles = '8 × Ø12 (BCD 710)';

  // Deterministic Mass Props calculations based on outlet chute expansion
  const baseMass = targetFile?.mass ?? 14.8;
  const calculatedMass = isWideChute ? (baseMass + 3.6).toFixed(2) : baseMass.toFixed(2);
  const calculatedVol = isWideChute ? '0.00230' : '0.00185';

  // Execution runner
  const handleRunExecution = async () => {
    if (!selectedChange || !targetFile || executeDisabledReason) return;

    setIsExecuting(true);
    setExecStep(1);

    const execId = `exec-${Date.now()}`;
    const adapter = getAdapter(selectedAdapter);
    const now = () => new Date().toISOString();

    const initialExecution: CADExecution = {
      id: execId,
      changeId: selectedChange.id,
      targetFileId: selectedChange.targetFileId,
      targetConfiguration: selectedChange.targetConfiguration,
      operation: selectedChange.operation,
      adapter: selectedAdapter,
      status: 'preparing',
      approvalState: selectedChange.approvalStatus,
      previousValue: selectedChange.currentValue,
      proposedValue: selectedChange.proposedValue,
      workingCopyRef: `WORKING/${targetFile.fileName.replace(/\.[^.]+$/, '')}_WC_${Date.now()}.SLDPRT`,
      startedAt: now(),
      executionLog: [
        {
          timestamp: now(),
          level: 'info',
          message: `CAD execution pipeline initiated via ${adapter.adapterName}`,
          detail: 'Validating preconditions, file locks and target document reference'
        }
      ],
      isSimulated: selectedAdapter === 'mock',
    };

    dispatch({ type: 'UPSERT_EXECUTION', execution: initialExecution });
    dispatch({ type: 'SET_ACTIVE_EXECUTION', id: execId });

    try {
      // Step 1: Pre-flight & Prepare
      await new Promise(r => setTimeout(r, 600));
      setExecStep(2);
      const prepared = await adapter.prepareChange(selectedChange, targetFile);

      dispatch({
        type: 'UPDATE_EXECUTION_STATUS',
        executionId: execId,
        status: 'preparing',
        log: {
          timestamp: now(),
          level: 'info',
          message: 'Target file inspected & isolated working copy allocated',
          detail: `Allocated scratch path: ${prepared.workingCopyRef}`
        }
      });

      // Step 2: Apply CAD parameters
      await new Promise(r => setTimeout(r, 700));
      setExecStep(3);
      dispatch({
        type: 'UPDATE_EXECUTION_STATUS',
        executionId: execId,
        status: 'executing',
        log: {
          timestamp: now(),
          level: 'info',
          message: `Applying parameter delta: [${selectedChange.targetParameterId || 'Property'}] = ${selectedChange.proposedValue} ${selectedChange.unit || ''}`,
          detail: selectedAdapter === 'mock' ? 'SIMULATED CAD OPERATION — No native SOLIDWORKS file modified.' : 'Direct native API invocation'
        }
      });

      // Step 3: Rebuild Model
      await new Promise(r => setTimeout(r, 900));
      setExecStep(4);
      dispatch({
        type: 'UPDATE_EXECUTION_STATUS',
        executionId: execId,
        status: 'rebuilding',
        log: {
          timestamp: now(),
          level: 'info',
          message: 'Model rebuild dispatched to geometric solver engine (swModel.EditRebuild3)',
          detail: 'Evaluating sketch planes, fillet blends and bolt circle patterns'
        }
      });

      // Step 4: Verification & Readback
      await new Promise(r => setTimeout(r, 700));
      setExecStep(5);
      dispatch({
        type: 'UPDATE_EXECUTION_STATUS',
        executionId: execId,
        status: 'verifying',
        log: {
          timestamp: now(),
          level: 'info',
          message: 'Reading back verified parameter values from working model copy',
          detail: `Resolved parameter value: ${selectedChange.proposedValue} ${selectedChange.unit || ''}`
        }
      });

      // Step 5: Finish operation
      const finalResult = await adapter.executeChange(initialExecution, targetFile);
      setExecStep(6);

      const completedExec: CADExecution = {
        ...initialExecution,
        status: 'complete',
        actualResult: finalResult.actualResult,
        outputFileRef: finalResult.outputFileRef,
        completedAt: now(),
        executionLog: [
          ...initialExecution.executionLog,
          ...finalResult.log,
          {
            timestamp: now(),
            level: 'info',
            message: 'Geometric bounds verified. Rebuild status: Clean (0 errors, 0 rebuild warnings).',
            detail: 'Output candidate tagged for assembly and drawing validation'
          }
        ],
        validationResult: finalResult.validationResult,
      };

      dispatch({ type: 'UPSERT_EXECUTION', execution: completedExec });

      // Update Main Assembly with rebuilt component state
      if (selectedChange.targetFileId === 'prt-001' || selectedChange.targetFileId === 'asm-001') {
        dispatch({ type: 'TRIGGER_ASSEMBLY_REBUILD', assemblyId: 'asm-001' });
      } else if (selectedChange.targetFileId === 'prt-006' || selectedChange.targetFileId === 'asm-004') {
        dispatch({ type: 'TRIGGER_ASSEMBLY_REBUILD', assemblyId: 'asm-004' });
      }

      // Audit event
      dispatch({
        type: 'ADD_AUDIT_EVENT',
        event: {
          id: `audit-${Date.now()}`,
          timestamp: now(),
          actor: state.currentUser,
          action: 'CAD Change Executed',
          entityType: 'CADExecution',
          entityId: execId,
          detail: `Executed change ${selectedChange.id} (${selectedChange.operation}) via ${adapter.adapterName}`,
          enquiryId: enquiry?.id,
        }
      });

    } catch (err: any) {
      dispatch({
        type: 'UPDATE_EXECUTION_STATUS',
        executionId: execId,
        status: 'failed',
        log: {
          timestamp: now(),
          level: 'error',
          message: 'CAD execution pipeline encountered an unrecoverable failure',
          detail: err?.message || String(err)
        }
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRebuild = async () => {
    if (!existingExec || isExecuting) return;
    setIsExecuting(true);
    const now = new Date().toISOString();
    dispatch({
      type: 'UPDATE_EXECUTION_STATUS',
      executionId: existingExec.id,
      status: 'rebuilding',
      log: {
        timestamp: now,
        level: 'info',
        message: 'Manual model rebuild triggered by engineer (swModel.ForceRebuild3)',
        detail: 'Simulated solver evaluation complete: 0 warnings, 0 rebuild errors'
      }
    });
    await new Promise(r => setTimeout(r, 600));
    dispatch({
      type: 'UPDATE_EXECUTION_STATUS',
      executionId: existingExec.id,
      status: 'complete'
    });
    setIsExecuting(false);
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
                CAD Execution Hub & Parametric Verification
              </span>
              {selectedChange && (
                <span className="text-[11px] font-mono text-[#68737D] border border-[#DDE2E6] px-1.5 py-0.5 rounded">
                  {selectedChange.id}
                </span>
              )}
              {existingExec && (
                <StatusBadge status={existingExec.status} />
              )}
            </div>
            <p className="text-[12px] text-[#68737D] mt-0.5">
              Target CAD Model: <strong className="text-[#20272E]">{targetFile?.fileName || 'PUMP_CASING_STD_A.SLDPRT'}</strong> · Active Configuration: <strong className="text-[#20272E]">{selectedChange?.targetConfiguration || targetFile?.activeConfiguration || 'DN125'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className={cn(
                "btn-secondary flex items-center gap-1.5 transition-colors",
                rightPaneTab === 'copilot'
                  ? "bg-[#315D78] text-white border-[#315D78] hover:bg-[#274b61]"
                  : "bg-white text-[#315D78] border-[#315D78]/30 hover:bg-[#EBF2F7]"
              )}
              onClick={() => setRightPaneTab(rightPaneTab === 'copilot' ? 'adapter' : 'copilot')}
              title="Toggle CAD Design Copilot Panel (on the right)"
            >
              <Sparkles size={13} className={rightPaneTab === 'copilot' ? "text-white" : "text-[#315D78]"} />
              CAD Design Copilot
              <span className={cn(
                "text-[9.5px] px-1 py-0.2 rounded font-mono font-bold",
                rightPaneTab === 'copilot' ? "bg-white/20 text-white" : "bg-[#EBF2F7] text-[#315D78]"
              )}>
                AI Panel
              </span>
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowConnectorModal(true)}
              title="Inspect VOLM Desktop CAD Integration Architecture"
            >
              <Cpu size={13} className="text-[#315D78]" />
              SOLIDWORKS Connector Bridge
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate('/compare')}
            >
              <RotateCcw size={13} /> Back to Planner
            </button>
            <button
              className="btn-primary bg-[#315D78] hover:bg-[#254B62] text-white flex items-center gap-1.5"
              onClick={() => navigate('/main-assembly')}
            >
              <Box size={13} /> Main Assembly Integration →
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate('/review')}
            >
              <CheckSquare size={13} /> Review & Release
            </button>
          </div>
        </div>
      </div>

      {/* Main 3-Column Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Pane: Proposed Change Queue & Context */}
        <div className="w-72 flex-shrink-0 border-r border-[#DDE2E6] bg-white flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[#DDE2E6] bg-[#F8FAFB] flex items-center justify-between">
            <span className="eng-panel-title flex items-center gap-1.5">
              <Settings2 size={13} className="text-[#315D78]" />
              Engineering Changes ({changes.length})
            </span>
          </div>

          <ScrollPane className="flex-1 divide-y divide-[#EEF1F4]">
            {changes.length === 0 && (
              <div className="p-4 text-center text-[#9AAAB5] text-[12px]">
                No proposed changes registered for this enquiry.
              </div>
            )}
            {changes.map(ch => {
              const isSel = ch.id === selectedChangeId;
              const chTarget = allFiles.find(f => f.id === ch.targetFileId);
              return (
                <div
                  key={ch.id}
                  onClick={() => { setSelectedChangeId(ch.id); setExecStep(0); }}
                  className={cn(
                    'p-3 cursor-pointer transition-colors',
                    isSel ? 'bg-[#EBF2F7] border-l-2 border-[#315D78]' : 'hover:bg-[#F8FAFB]'
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-mono text-[11px] font-bold text-[#315D78]">{ch.id}</span>
                    <StatusBadge status={ch.approvalStatus} />
                  </div>
                  <p className="text-[12px] font-medium text-[#20272E] truncate">
                    {ch.operation.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[11px] text-[#68737D] truncate">
                    {chTarget?.fileName || ch.targetFileId}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] bg-white p-1 rounded border border-[#DDE2E6]">
                    <span className="text-[#68737D] truncate max-w-[70px]">{String(ch.currentValue ?? '—')}</span>
                    <span className="text-[#9AAAB5]">→</span>
                    <span className="text-[#315D78] font-bold truncate max-w-[80px]">{String(ch.proposedValue)} {ch.unit}</span>
                  </div>
                </div>
              );
            })}
          </ScrollPane>

          {/* Context Details */}
          {selectedChange && (
            <div className="p-3 border-t border-[#DDE2E6] bg-[#F8FAFB] text-[11.5px] space-y-2">
              <p className="font-semibold text-[#68737D] uppercase text-[10px]">Change Traceability</p>
              <div><strong className="text-[#20272E]">Feature:</strong> <span className="font-mono text-[#315D78]">{selectedChange.targetFeatureId || 'Inlet_Port_Boss'}</span></div>
              <div><strong className="text-[#20272E]">Approval:</strong> {selectedChange.reviewer ? `${selectedChange.reviewer} (Lead)` : 'Pending'}</div>
              <div><strong className="text-[#20272E]">Reason:</strong> <span className="text-[#68737D]">{selectedChange.reason}</span></div>
              {selectedChange.dependencies.length > 0 && (
                <div>
                  <strong className="text-[#20272E]">Downstream Impact:</strong>
                  <ul className="list-disc ml-3.5 text-[#68737D] text-[11px] mt-0.5">
                    {selectedChange.dependencies.map((d, i) => (
                      <li key={i}>{d.description}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-2 border-t border-[#DDE2E6]">
                <button
                  onClick={() => {
                    setRightPaneTab('copilot');
                    handleSendCadCopilot(`Analyze design implications and requirements for change proposal ${selectedChange.id}: ${selectedChange.operation.replace(/_/g, ' ')} (${selectedChange.currentValue} -> ${selectedChange.proposedValue} ${selectedChange.unit || ''})`);
                  }}
                  className="w-full btn-secondary text-[11px] py-1.5 flex items-center justify-center gap-1.5 bg-white text-[#315D78] border-[#315D78]/30 hover:bg-[#EBF2F7]"
                >
                  <Sparkles size={12} className="text-[#315D78]" />
                  Consult Copilot on This Change
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center Pane: CAD Model Technical Orthographic View, FeatureTree & Diagnostics */}
        <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
          {/* Honest Simulation Disclaimer Notice */}
          <div className="p-2.5 bg-[#FEF8E6] border-b border-[#F5D78A] text-[#7A5400] text-[11.5px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 text-[#9A6A00]" />
              <span>
                <strong>Simulated CAD Operation:</strong> Parameter deltas and geometric bounds are evaluated deterministically in-browser. No native SOLIDWORKS binary files were modified on disk.
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold bg-[#F4F5F6] border border-[#DDE2E6] px-1.5 py-0.5 rounded text-[#68737D]">
                USDA / FDA 3-A Sanitary
              </span>
            </div>
          </div>

          {/* Center View Mode Switcher */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#DDE2E6] bg-[#F8FAFB] flex-shrink-0">
            <div className="flex rounded border border-[#DDE2E6] overflow-hidden bg-white">
              <button
                onClick={() => setActiveCenterView('drawing')}
                className={cn(
                  'px-3 py-1 text-[11.5px] font-medium flex items-center gap-1.5 border-r border-[#DDE2E6] transition-colors cursor-pointer',
                  activeCenterView === 'drawing' ? 'bg-[#315D78] text-white' : 'text-[#68737D] hover:bg-[#F4F5F6]'
                )}
              >
                <Ruler size={12} />
                2D Orthographic Section Drawing
              </button>
              <button
                onClick={() => setActiveCenterView('model3d')}
                className={cn(
                  'px-3 py-1 text-[11.5px] font-medium flex items-center gap-1.5 border-r border-[#DDE2E6] transition-colors cursor-pointer',
                  activeCenterView === 'model3d' ? 'bg-[#315D78] text-white' : 'text-[#68737D] hover:bg-[#F4F5F6]'
                )}
              >
                <Box size={12} className={activeCenterView === 'model3d' ? "text-white" : "text-[#315D78]"} />
                3D SOLIDWORKS Design
                <span className={cn(
                  "text-[9px] px-1 py-0.2 rounded font-bold font-mono",
                  activeCenterView === 'model3d' ? "bg-white/20 text-white" : "bg-[#EBF2F7] text-[#315D78]"
                )}>
                  3D
                </span>
              </button>
              <button
                onClick={() => setActiveCenterView('featureTree')}
                className={cn(
                  'px-3 py-1 text-[11.5px] font-medium flex items-center gap-1.5 border-r border-[#DDE2E6] transition-colors cursor-pointer',
                  activeCenterView === 'featureTree' ? 'bg-[#315D78] text-white' : 'text-[#68737D] hover:bg-[#F4F5F6]'
                )}
              >
                <Layers size={12} />
                FeatureManager Tree
              </button>
              <button
                onClick={() => setActiveCenterView('massProps')}
                className={cn(
                  'px-3 py-1 text-[11.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer',
                  activeCenterView === 'massProps' ? 'bg-[#315D78] text-white' : 'text-[#68737D] hover:bg-[#F4F5F6]'
                )}
              >
                <Scale size={12} />
                Mass Properties & Bounds
              </button>
            </div>

            {(activeCenterView === 'drawing' || activeCenterView === 'model3d') && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#68737D]">View State:</span>
                <div className="flex rounded border border-[#DDE2E6] overflow-hidden text-[11px] font-medium">
                  <button
                    onClick={() => setPreviewToggle('original')}
                    className={cn(
                      'px-2 py-0.5',
                      previewToggle === 'original' ? 'bg-[#202830] text-white' : 'bg-white text-[#68737D]'
                    )}
                  >
                    Baseline (Ø300 mm)
                  </button>
                  <button
                    onClick={() => setPreviewToggle('proposed')}
                    className={cn(
                      'px-2 py-0.5',
                      previewToggle === 'proposed' ? 'bg-[#315D78] text-white' : 'bg-white text-[#68737D]'
                    )}
                  >
                    Proposed (Ø450 mm)
                  </button>
                </div>
              </div>
            )}
          </div>

          <ScrollPane className="flex-1 p-4 space-y-4">
            {/* VIEW 1: INTERACTIVE TECHNICAL SECTION DRAWING (Engineering Graphic) */}
            {activeCenterView === 'drawing' && (
              <div className="eng-panel p-4 flex flex-col items-center bg-[#FDFDFE]">
                <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-[#EEF1F4] text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#315D78]">SECTION A-A · SCALE 1:5</span>
                    <span className="text-[#68737D]">Weigher Collector Chute Conical Cross-Section</span>
                  </div>
                  <div className="flex items-center gap-3 text-[#68737D] font-mono text-[10.5px]">
                    <span>PROJECTION: THIRD ANGLE</span>
                    <span>UNITS: MMGS</span>
                  </div>
                </div>

                {/* SVG Technical Drawing */}
                <div className="w-full flex justify-center py-2">
                  <svg
                    viewBox="0 0 620 280"
                    className="w-full max-w-[620px] h-auto select-none"
                    style={{ background: '#FFFFFF', border: '1px solid #DDE2E6', borderRadius: '2px' }}
                  >
                    {/* Grid Pattern / Drawing background */}
                    <defs>
                      <pattern id="hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="8" stroke="#CCD5DD" strokeWidth="0.8" />
                      </pattern>
                      <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#315D78" />
                      </marker>
                    </defs>

                    {/* Datum & Centerlines */}
                    <line x1="310" y1="10" x2="310" y2="270" stroke="#9AAAB5" strokeWidth="0.8" strokeDasharray="14,3,3,3" />
                    <line x1="40" y1="45" x2="580" y2="45" stroke="#9AAAB5" strokeWidth="0.8" strokeDasharray="14,3,3,3" />

                    {/* Top Mounting Flange Rim (Left & Right) */}
                    <rect x="70" y="35" width="480" height="18" fill="url(#hatch)" stroke="#20272E" strokeWidth="1.6" />
                    {/* Flange Bolt Holes */}
                    <circle cx="100" cy="44" r="6" fill="#FFFFFF" stroke="#20272E" strokeWidth="1.2" />
                    <circle cx="520" cy="44" r="6" fill="#FFFFFF" stroke="#20272E" strokeWidth="1.2" />

                    {/* Inverted Conical Funnel Walls */}
                    {/* Dynamic calculation: Outlet width maps 300mm to 120px, 450mm to 180px */}
                    {(() => {
                      const outletHalfPx = displayOutletWidth >= 400 ? 90 : 60;
                      const funnelDropY = 200;
                      const neckDropY = 245;

                      return (
                        <g>
                          {/* Left Sloped Funnel Wall */}
                          <path
                            d={`M 110,53 L ${310 - outletHalfPx},${funnelDropY} L ${310 - outletHalfPx},${neckDropY} L ${310 - outletHalfPx - 8},${neckDropY} L ${310 - outletHalfPx - 8},${funnelDropY} L 100,53 Z`}
                            fill="url(#hatch)"
                            stroke="#20272E"
                            strokeWidth="1.6"
                          />
                          {/* Right Sloped Funnel Wall */}
                          <path
                            d={`M 510,53 L ${310 + outletHalfPx},${funnelDropY} L ${310 + outletHalfPx},${neckDropY} L ${310 + outletHalfPx + 8},${neckDropY} L ${310 + outletHalfPx + 8},${funnelDropY} L 520,53 Z`}
                            fill="url(#hatch)"
                            stroke="#20272E"
                            strokeWidth="1.6"
                          />

                          {/* Internal Funnel Cavity Guide Line */}
                          <line x1="110" y1="53" x2={310 - outletHalfPx} y2={funnelDropY} stroke="#315D78" strokeWidth="1.4" strokeDasharray="4,2" />
                          <line x1="510" y1="53" x2={310 + outletHalfPx} y2={funnelDropY} stroke="#315D78" strokeWidth="1.4" strokeDasharray="4,2" />

                          {/* DIMENSION LEADER: TOP RIM DIAMETER (Ø750 mm) */}
                          <line x1="70" y1="22" x2="550" y2="22" stroke="#68737D" strokeWidth="1" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                          <rect x="270" y="12" width="80" height="18" fill="#FFFFFF" rx="2" stroke="#68737D" strokeWidth="0.6" />
                          <text x="310" y="25" textAnchor="middle" fontSize="10.5" fontWeight="bold" fill="#20272E" fontFamily="monospace">
                            Ø 750 mm (Mount)
                          </text>

                          {/* DIMENSION LEADER: OUTLET WIDTH (Ø300 or Ø450 mm) */}
                          <line x1={310 - outletHalfPx} y1={funnelDropY + 20} x2={310 + outletHalfPx} y2={funnelDropY + 20} stroke="#315D78" strokeWidth="1.4" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                          <rect x={310 - 55} y={funnelDropY + 10} width="110" height="20" fill="#FFFFFF" rx="2" stroke="#315D78" strokeWidth="1" />
                          <text x="310" y={funnelDropY + 24} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#315D78" fontFamily="monospace">
                            Ø {displayOutletWidth} mm OUTLET
                          </text>

                          {/* FUNNEL ANGLE CALLOUT */}
                          <g transform={`translate(${310 + outletHalfPx + 35}, 140)`}>
                            <rect width="130" height="40" fill="#F8FAFB" stroke="#315D78" strokeWidth="0.8" rx="2" />
                            <text x="8" y="16" fontSize="10" fontWeight="bold" fill="#20272E">
                              SLOPE ANGLE: {displayAngle}°
                            </text>
                            <text x="8" y="30" fontSize="9" fill="#68737D" fontFamily="monospace">
                              {displayAngle === 62 ? '62° (Anti-Bridging)' : '55° (Standard)'}
                            </text>
                          </g>
                        </g>
                      );
                    })()}

                    {/* Material Callout */}
                    <g transform="translate(60, 215)">
                      <rect width="180" height="42" fill="#F8FAFB" stroke="#315D78" strokeWidth="0.8" rx="2" />
                      <text x="10" y="16" fontSize="10" fontWeight="bold" fill="#20272E">
                        FOOD CONTACT METALLURGY
                      </text>
                      <text x="10" y="32" fontSize="9" fill="#315D78" fontFamily="monospace">
                        316L SS Dimpled Electropolished
                      </text>
                    </g>
                  </svg>
                </div>

                <div className="w-full grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-[#EEF1F4] text-[11px]">
                  <div>
                    <span className="text-[#68737D]">Chute Outlet:</span>{' '}
                    <strong className="text-[#315D78] font-mono">Ø {displayOutletWidth} mm (Modified for 60 BPM)</strong>
                  </div>
                  <div>
                    <span className="text-[#68737D]">Funnel Slope:</span>{' '}
                    <strong className="text-[#20272E] font-mono">{displayAngle}° Steep Cone (Anti-Bridging)</strong>
                  </div>
                  <div>
                    <span className="text-[#68737D]">Mounting Flange:</span>{' '}
                    <strong className="text-[#20272E] font-mono">Ø {topFlangeDia} mm ({boltHoles})</strong>
                  </div>
                </div>

                {/* Copilot Inline Quick Recommendation Bar */}
                <div className="w-full mt-3 p-2.5 bg-[#F0F6F9] border border-[#CCDCE6] rounded flex items-center justify-between text-[11.5px]">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-[#315D78] flex-shrink-0" />
                    <span className="text-[#20272E]">
                      <strong>Copilot Design Insight:</strong> Expanding collector chute outlet to Ø450 mm with 62° slope eliminates produce bridging at 60 bags/min. Direct concentric drop mate to 600mm VFFS forming tube verified.
                    </span>
                  </div>
                  <button
                    onClick={() => setRightPaneTab('copilot')}
                    className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1.5 flex-shrink-0 bg-white cursor-pointer"
                  >
                    <Sparkles size={12} className="text-[#315D78]" />
                    Open Copilot on Right →
                  </button>
                </div>
              </div>
            )}

            {/* VIEW 2: 3D SOLIDWORKS PARAMETRIC CAD MODEL VIEWPORT */}
            {activeCenterView === 'model3d' && (
              <SolidWorks3DViewer
                chuteOutletWidth={displayOutletWidth}
                chuteAngleDeg={displayAngle}
                topFlangeDiameter={topFlangeDia}
                material={targetFile?.material?.includes('316') ? 'stainless_316' : 'stainless_304'}
                isModified={isModified}
              />
            )}

            {/* VIEW 3: SOLIDWORKS FEATUREMANAGER TREE */}
            {activeCenterView === 'featureTree' && (
              <div className="eng-panel">
                <div className="eng-panel-header flex items-center justify-between">
                  <span className="eng-panel-title flex items-center gap-1.5">
                    <Layers size={13} className="text-[#315D78]" />
                    FeatureManager DesignTree (SOLIDWORKS Model Hierarchy)
                  </span>
                  <span className="text-[11px] font-mono text-[#68737D]">
                    File: {targetFile?.fileName}
                  </span>
                </div>
                <div className="p-3 divide-y divide-[#EEF1F4]">
                  {[
                    { id: 'origin', name: 'Part Origin (0,0,0)', type: 'Coordinate System', icon: Compass, status: 'Fixed' },
                    { id: 'front_plane', name: 'Front Plane', type: 'Reference Geometry', icon: Compass, status: 'Visible' },
                    { id: 'top_plane', name: 'Top Plane', type: 'Reference Geometry', icon: Compass, status: 'Visible' },
                    { id: 'right_plane', name: 'Right Plane', type: 'Reference Geometry', icon: Compass, status: 'Visible' },
                    { id: 'material', name: `Material <${targetFile?.material || '316L Stainless Steel'}>`, type: 'Physical Property', icon: Scale, status: 'Assigned' },
                    { id: 'Funnel_Cone_Extrude', name: 'Funnel_Cone_Extrude', type: 'Boss-Extrude1', icon: FileCode, status: 'MODIFIED (Active Change)', isTarget: true },
                    { id: 'Discharge_Neck_Extrude', name: 'Discharge_Neck_Extrude', type: 'Boss-Extrude2', icon: FileCode, status: 'Regenerated OK' },
                    { id: 'Top_Mounting_Flange_Boss', name: 'Top_Mounting_Flange_Boss', type: 'Boss-Extrude3', icon: FileCode, status: 'Regenerated OK' },
                    { id: 'Flange_Bolt_Pattern_8x', name: 'Flange_Bolt_Pattern_8x', type: 'Circular Pattern1', icon: Hash, status: 'Regenerated OK' },
                    { id: 'Dimple_Surface_Pattern', name: 'Dimple_Surface_Pattern', type: 'Pattern-Fill1', icon: Sliders, status: 'Regenerated OK' },
                  ].map(item => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedFeature(item.id)}
                      className={cn(
                        'flex items-center justify-between p-2 cursor-pointer transition-colors text-[12px]',
                        selectedFeature === item.id ? 'bg-[#EBF2F7]' : 'hover:bg-[#F8FAFB]',
                        item.isTarget ? 'font-semibold text-[#315D78]' : 'text-[#20272E]'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon size={13} className={item.isTarget ? 'text-[#315D78]' : 'text-[#68737D]'} />
                        <span>{item.name}</span>
                        {item.isTarget && (
                          <span className="text-[10px] bg-[#315D78] text-white px-1.5 py-0.2 rounded font-mono">
                            Delta Applied
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[#68737D] font-mono">{item.type}</span>
                        <span className={cn(
                          'text-[10.5px] px-1.5 py-0.5 rounded font-medium',
                          item.isTarget ? 'bg-[#EBF2F7] text-[#315D78]' : 'bg-[#F4F5F6] text-[#68737D]'
                        )}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {/* Rollback bar representation */}
                  <div className="p-1.5 bg-[#FFF8E6] text-center font-mono text-[10.5px] text-[#9A6A00] border-t-2 border-[#F5D78A]">
                    —— Rollback Bar: Model Rebuilt at End of Tree (10 of 10 Features Solved) ——
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 3: MASS PROPERTIES & PHYSICAL BOUNDS */}
            {activeCenterView === 'massProps' && (
              <div className="eng-panel p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#EEF1F4]">
                  <span className="font-bold text-[13px] text-[#20272E]">Physical Mass Properties & Solver Delta</span>
                  <span className="text-[11px] text-[#68737D]">Evaluated with MMGS coordinate frame</span>
                </div>
                <table className="eng-table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Original (Rev C)</th>
                      <th>Proposed Delta (Rev D)</th>
                      <th>Variance</th>
                      <th>Design Implication</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-medium text-[#20272E]">Total Net Mass</td>
                      <td className="font-mono">{baseMass.toFixed(2)} kg</td>
                      <td className="font-mono font-bold text-[#315D78]">{calculatedMass} kg</td>
                      <td className="font-mono text-[#2D7A4F]">+3.60 kg (+24.3%)</td>
                      <td className="text-[11.5px] text-[#68737D]">Within allowable mezzanine payload limit (&lt;50 kg)</td>
                    </tr>
                    <tr>
                      <td className="font-medium text-[#20272E]">Bounding Volume</td>
                      <td className="font-mono">0.00185 m³</td>
                      <td className="font-mono font-bold text-[#315D78]">{calculatedVol} m³</td>
                      <td className="font-mono text-[#2D7A4F]">+0.00045 m³</td>
                      <td className="text-[11.5px] text-[#68737D]">Chute discharge throat widened by 75 mm radially</td>
                    </tr>
                    <tr>
                      <td className="font-medium text-[#20272E]">Chute Outlet Width</td>
                      <td className="font-mono">300 mm</td>
                      <td className="font-mono font-bold text-[#315D78]">{displayOutletWidth} mm</td>
                      <td className="font-mono text-[#2D7A4F]">+150 mm (+50%)</td>
                      <td className="text-[11.5px] text-[#2D7A4F] font-medium">Guarantees 60 BPM portion drop with zero bridging</td>
                    </tr>
                    <tr>
                      <td className="font-medium text-[#20272E]">Funnel Cone Slope</td>
                      <td className="font-mono">55°</td>
                      <td className="font-mono font-bold text-[#315D78]">{displayAngle}°</td>
                      <td className="font-mono text-[#2D7A4F]">+7°</td>
                      <td className="text-[11.5px] text-[#68737D]">Steep slide angle prevents fresh produce hang-up</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Execution Process Steps Tracker */}
            <div className="eng-panel">
              <div className="eng-panel-header flex items-center justify-between">
                <span className="eng-panel-title flex items-center gap-1.5">
                  <Activity size={13} className="text-[#315D78]" />
                  Deterministic CAD Pipeline Stages
                </span>
                <span className="text-[11px] text-[#68737D]">
                  {existingExec?.status === 'complete' ? 'All 5 Stages Successfully Solved' : 'Awaiting Execution'}
                </span>
              </div>
              <div className="p-3 grid grid-cols-5 gap-2">
                {[
                  { step: 1, label: 'Pre-flight Validation' },
                  { step: 2, label: 'Sandbox Isolation' },
                  { step: 3, label: 'Parametric Change' },
                  { step: 4, label: 'Model Regeneration' },
                  { step: 5, label: 'Geometry Validation' },
                ].map(({ step, label }) => {
                  const isDone = (existingExec?.status === 'complete') || (execStep > step);
                  const isCurrent = isExecuting && execStep === step;
                  return (
                    <div
                      key={step}
                      className={cn(
                        'border p-2 rounded text-center transition-all',
                        isDone ? 'bg-[#EBF5EF] border-[#85C9A1] text-[#1A5433]' :
                        isCurrent ? 'bg-[#EBF2F7] border-[#315D78] text-[#315D78] ring-1 ring-[#315D78]' :
                        'bg-[#F8FAFB] border-[#DDE2E6] text-[#9AAAB5]'
                      )}
                    >
                      <div className="flex items-center justify-center gap-1 mb-1 font-semibold text-[11px]">
                        {isDone ? <CheckCircle size={12} className="text-[#2D7A4F]" /> :
                         isCurrent ? <Spinner size={12} /> :
                         <span className="w-3 h-3 rounded-full bg-[#DDE2E6] text-[#68737D] inline-flex items-center justify-center text-[9px]">{step}</span>}
                        <span>Stage {step}</span>
                      </div>
                      <div className="text-[10.5px] leading-tight font-medium">{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Execution Audit / Terminal Output */}
            <div className="eng-panel bg-[#1B2228] text-[#E4EAF0] border-[#2D3A47]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#2D3A47] bg-[#141A1F]">
                <div className="flex items-center gap-2">
                  <Terminal size={13} className="text-[#58A6FF]" />
                  <span className="text-[11.5px] font-mono font-medium text-[#C9D1D9]">
                    CAD Adapter Execution Log {isExecuting && '(Running...)'}
                  </span>
                </div>
                {existingExec?.workingCopyRef && (
                  <span className="text-[10px] font-mono text-[#8B949E]">
                    {existingExec.workingCopyRef}
                  </span>
                )}
              </div>

              <div className="p-3 font-mono text-[11px] leading-relaxed max-h-56 overflow-y-auto space-y-1">
                {(!existingExec || existingExec.executionLog.length === 0) ? (
                  <div className="text-[#8B949E] italic py-2">
                    CAD adapter idle. Select an approved change proposal and click "Execute CAD Operation" to begin.
                  </div>
                ) : (
                  existingExec.executionLog.map((log: ExecutionLogEntry, idx: number) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-[#8B949E] select-none">{log.timestamp.slice(11, 19)}</span>
                      <span className={cn(
                        'px-1 rounded text-[10px] uppercase font-bold',
                        log.level === 'error' ? 'bg-[#F85149] text-white' :
                        log.level === 'warn' ? 'bg-[#D29922] text-black' :
                        'bg-[#30363D] text-[#58A6FF]'
                      )}>
                        {log.level}
                      </span>
                      <span className="text-[#C9D1D9] flex-1">{log.message}</span>
                      {log.detail && (
                        <span className="text-[#8B949E] text-[10px]">{log.detail}</span>
                      )}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </ScrollPane>
        </div>

        {/* Right Pane: Adapter Selection & Control Actions OR CAD Design Copilot */}
        <div className="w-[390px] flex-shrink-0 border-l border-[#DDE2E6] bg-white flex flex-col overflow-hidden">
          {/* Right Pane Tab Header */}
          <div className="flex border-b border-[#DDE2E6] bg-[#F8FAFB] flex-shrink-0">
            <button
              onClick={() => setRightPaneTab('adapter')}
              className={cn(
                'flex-1 py-2.5 px-3 text-[12px] font-medium flex items-center justify-center gap-1.5 border-r border-[#DDE2E6] transition-colors cursor-pointer',
                rightPaneTab === 'adapter'
                  ? 'bg-white text-[#20272E] border-b-2 border-b-[#315D78] font-semibold'
                  : 'text-[#68737D] hover:bg-[#F4F5F6]'
              )}
            >
              <Database size={13} className={rightPaneTab === 'adapter' ? "text-[#315D78]" : "text-[#68737D]"} />
              Execution Adapter
            </button>
            <button
              onClick={() => setRightPaneTab('copilot')}
              className={cn(
                'flex-1 py-2.5 px-3 text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer',
                rightPaneTab === 'copilot'
                  ? 'bg-white text-[#315D78] border-b-2 border-b-[#315D78] font-semibold'
                  : 'text-[#68737D] hover:bg-[#F4F5F6]'
              )}
            >
              <Sparkles size={13} className="text-[#315D78]" />
              CAD Design Copilot
              <span className="text-[9.5px] bg-[#EBF2F7] text-[#315D78] px-1 py-0.2 rounded font-mono font-bold">
                AI
              </span>
            </button>
          </div>

          {/* VIEW A: CAD DESIGN COPILOT (ON THE RIGHT) */}
          {rightPaneTab === 'copilot' && (
            <div className="flex-1 flex flex-col min-h-0 bg-[#FBFBFC]">
              {/* Copilot Context Bar */}
              <div className="p-2.5 bg-[#F8FAFB] border-b border-[#EEF1F4] flex items-center justify-between text-[11px]">
                <div>
                  <span className="font-semibold text-[#20272E]">Target: </span>
                  <span className="font-mono text-[#315D78]">{targetFile?.fileName || 'PUMP_CASING_STD_A.SLDPRT'}</span>
                  <span className="text-[#68737D]"> ({selectedChange?.targetConfiguration || 'DN125'})</span>
                </div>
                <span className="text-[10px] bg-[#EBF5EF] text-[#2D7A4F] px-1.5 py-0.5 rounded font-mono font-medium">
                  Deterministic AI
                </span>
              </div>

              {/* Quick Action Suggestion Chips */}
              <div className="p-2.5 bg-white border-b border-[#EEF1F4] space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#9AAAB5] block">
                  Quick Design Actions:
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: 'Flange Spec (PN16)', query: 'Validate DIN EN 1092-1 PN16 suction flange requirements for DN125' },
                    { label: 'Wall Stress @ 16 Bar', query: 'Calculate casing wall hoop stress at 16 bar test pressure' },
                    { label: 'C# COM Script', query: 'Generate SOLIDWORKS COM API code to modify inlet diameter and rebuild' },
                    { label: 'Velocity @ 65 m³/h', query: 'Analyze fluid velocity and NPSH margin for 65 m3/h duty point' },
                    { label: '316L SS Delta', query: 'Assess metallurgical change to AISI 316L Stainless Steel and mass delta' },
                    { label: 'Impeller Trim', query: 'Calculate impeller trim diameter for 48 m head' },
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendCadCopilot(chip.query)}
                      className="text-[10.5px] bg-[#F4F5F6] hover:bg-[#EBF2F7] hover:text-[#315D78] text-[#475467] border border-[#DDE2E6] px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={10} className="text-[#315D78]" />
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages Stream */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                {copilotMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'rounded p-2.5 text-[11.5px] border transition-all',
                      msg.sender === 'user'
                        ? 'bg-[#315D78] text-white border-[#274b61] ml-4'
                        : 'bg-white text-[#20272E] border-[#DDE2E6] shadow-xs'
                    )}
                  >
                    {msg.sender === 'assistant' && (
                      <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-[#EEF1F4]">
                        <div className="flex items-center gap-1 font-medium text-[#315D78] text-[11px]">
                          <Sparkles size={11} />
                          <span>{msg.title || 'CAD Copilot'}</span>
                        </div>
                        <span className="text-[9.5px] text-[#9AAAB5]">{msg.timestamp}</span>
                      </div>
                    )}

                    <div className="whitespace-pre-line leading-relaxed font-sans text-[11px]">
                      {msg.text}
                    </div>

                    {/* Metric Badges if present */}
                    {msg.metrics && msg.metrics.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-1.5 pt-1.5 border-t border-[#EEF1F4]">
                        {msg.metrics.map((m, mi) => (
                          <div key={mi} className="bg-[#F8FAFB] border border-[#DDE2E6] p-1 rounded">
                            <div className="text-[9.5px] text-[#68737D] uppercase font-semibold">{m.label}</div>
                            <div className={cn(
                              'text-[10.5px] font-mono font-bold mt-0.5',
                              m.status === 'good' ? 'text-[#2D7A4F]' :
                              m.status === 'warn' ? 'text-[#B54708]' : 'text-[#315D78]'
                            )}>
                              {m.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Code Snippet if present */}
                    {msg.codeSnippet && (
                      <div className="mt-2 rounded border border-[#202830] overflow-hidden bg-[#1E252B] text-white">
                        <div className="px-2.5 py-1 bg-[#141A1F] border-b border-[#2D3740] flex items-center justify-between text-[10px] font-mono">
                          <span className="text-[#9AAAB5] flex items-center gap-1">
                            <Code2 size={11} className="text-[#315D78]" />
                            {msg.codeSnippet.language.toUpperCase()}
                          </span>
                          <button
                            onClick={() => handleCopyCode(msg.id, msg.codeSnippet!.code)}
                            className="hover:text-white text-[#9AAAB5] flex items-center gap-1 text-[9.5px] cursor-pointer"
                          >
                            {copiedCodeId === msg.id ? (
                              <>
                                <Check size={10} className="text-[#2D7A4F]" />
                                <span className="text-[#2D7A4F]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={10} />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="p-2 font-mono text-[10px] overflow-x-auto text-[#DDE2E6] leading-relaxed">
                          <code>{msg.codeSnippet.code}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                ))}

                {isCopilotTyping && (
                  <div className="bg-white border border-[#DDE2E6] rounded p-2 text-[11px] flex items-center gap-2 text-[#68737D]">
                    <Spinner size={12} />
                    <span>Evaluating CAD constraints...</span>
                  </div>
                )}
              </div>

              {/* Ready to execute switch hint banner */}
              <div className="px-3 py-1.5 bg-[#EBF2F7] border-t border-[#CCDCE6] flex items-center justify-between text-[11px]">
                <span className="text-[#315D78]">Design verified?</span>
                <button
                  onClick={() => setRightPaneTab('adapter')}
                  className="font-semibold text-[#315D78] hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  Switch to Execution Adapter →
                </button>
              </div>

              {/* Copilot Input Footer */}
              <div className="p-2 bg-white border-t border-[#DDE2E6] flex items-center gap-1.5">
                <input
                  type="text"
                  value={cadCopilotInput}
                  onChange={(e) => setCadCopilotInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendCadCopilot();
                    }
                  }}
                  placeholder="Ask CAD Copilot (e.g. '16 bar hoop stress', 'EN 1092-1')..."
                  className="flex-1 px-2.5 py-1.5 text-[11.5px] border border-[#DDE2E6] rounded bg-[#FDFDFE] focus:outline-none focus:border-[#315D78]"
                />
                <button
                  onClick={() => handleSendCadCopilot()}
                  disabled={!cadCopilotInput.trim() || isCopilotTyping}
                  className="btn-primary text-[11.5px] px-2.5 py-1.5 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <Send size={11} />
                  Send
                </button>
              </div>
            </div>
          )}

          {/* VIEW B: EXECUTION ADAPTER (ON THE RIGHT) */}
          {rightPaneTab === 'adapter' && (
            <ScrollPane className="flex-1 p-3 space-y-4">
            {/* Adapter Selectors */}
            <div className="space-y-2">
              {[
                { id: 'mock', name: 'Mock CAD Adapter', desc: 'Deterministic local simulation. Verified demo safety.', live: true },
                { id: 'solidworks', name: 'SOLIDWORKS API Connector', desc: 'Requires native Windows background service.', live: false },
                { id: 'cadabra', name: 'CADABRA Kernel Adapter', desc: 'Enterprise CAD service integration boundary.', live: false },
                { id: 'forge', name: 'Autodesk Forge / APS', desc: 'Cloud model derivative translation boundary.', live: false },
              ].map(item => {
                const isSel = selectedAdapter === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedAdapter(item.id as CADAdapterType)}
                    className={cn(
                      'p-2.5 rounded border cursor-pointer transition-all',
                      isSel ? 'border-[#315D78] bg-[#EBF2F7]' : 'border-[#DDE2E6] hover:bg-[#F8FAFB]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-[#20272E]">{item.name}</span>
                      <span className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded',
                        item.live ? 'bg-[#EBF5EF] text-[#2D7A4F]' : 'bg-[#F4F5F6] text-[#68737D]'
                      )}>
                        {item.live ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#68737D] mt-1 leading-snug">{item.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Validation & Safety Checklist */}
            <div className="eng-panel p-3 bg-[#F8FAFB]">
              <p className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide mb-2">
                Pre-Execution Readiness
              </p>
              <div className="space-y-1.5 text-[11.5px]">
                <div className="flex items-center gap-1.5">
                  {selectedChange ? <CheckCircle size={12} className="text-[#2D7A4F]" /> : <XCircle size={12} className="text-[#B42318]" />}
                  <span>Change proposal identified</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isApproved ? <CheckCircle size={12} className="text-[#2D7A4F]" /> : <XCircle size={12} className="text-[#B42318]" />}
                  <span>Engineering review approved</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isOperationSupported ? <CheckCircle size={12} className="text-[#2D7A4F]" /> : <XCircle size={12} className="text-[#B42318]" />}
                  <span>Operation supported by adapter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield size={12} className="text-[#315D78]" />
                  <span>Isolated sandbox copy enforced</span>
                </div>
              </div>
            </div>

            {/* Verification Results If Complete */}
            {existingExec?.validationResult && (
              <div className="eng-panel p-3 border-[#85C9A1] bg-[#F7FCF9]">
                <div className="flex items-center gap-1.5 text-[#1A5433] font-semibold text-[12px] mb-2">
                  <CheckCircle size={14} className="text-[#2D7A4F]" />
                  Validation Checks ({existingExec.validationResult.checks.length})
                </div>
                <div className="space-y-1.5">
                  {existingExec.validationResult.checks.map(chk => (
                    <div key={chk.id} className="text-[11px] flex items-start gap-1.5">
                      <ValidationIcon status={chk.status} />
                      <div>
                        <span className="font-medium text-[#20272E]">{chk.description}</span>
                        {chk.evidence && <p className="text-[#68737D]">{chk.evidence}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-[#EEF1F4]">
              {executeDisabledReason && (
                <div className="text-[11px] text-[#B42318] bg-[#FEF0EE] p-2 rounded border border-[#F4A9A4]">
                  <strong>Cannot execute:</strong> {executeDisabledReason}
                </div>
              )}

              <button
                className="btn-primary w-full justify-center py-2 text-[12.5px]"
                disabled={Boolean(executeDisabledReason)}
                onClick={handleRunExecution}
              >
                {isExecuting ? (
                  <>
                    <Spinner size={14} /> Executing CAD Pipeline...
                  </>
                ) : (
                  <>
                    <Play size={13} /> Execute CAD Operation
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  className="btn-secondary justify-center text-xs"
                  disabled={!existingExec || isExecuting}
                  onClick={handleRebuild}
                >
                  <RotateCcw size={11} /> Rebuild Model
                </button>
                <button
                  className="btn-secondary justify-center text-xs"
                  onClick={() => navigate('/review')}
                >
                  Verify Result <ChevronRight size={11} />
                </button>
              </div>
            </div>
          </ScrollPane>
          )}
        </div>
      </div>

      {/* SOLIDWORKS Connector Architecture Dialog / Modal */}
      {showConnectorModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-[#DDE2E6] shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#DDE2E6] bg-[#F8FAFB] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu size={16} className="text-[#315D78]" />
                <h3 className="font-bold text-[14px] text-[#20272E]">
                  VOLM SOLIDWORKS Native Connector Architecture
                </h3>
              </div>
              <button
                onClick={() => setShowConnectorModal(false)}
                className="btn-ghost p-1 text-[#68737D]"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-[12px] leading-relaxed">
              <div className="p-3 bg-[#EBF2F7] border border-[#315D78] rounded text-[#1A3D52]">
                <strong>Non-Disruptive Hybrid Architecture:</strong> VOLM Engineering Intelligence is built to enhance the mechanical engineer's current CAD tools rather than forcing an expensive or risky rip-and-replace of desktop SOLIDWORKS or Enterprise PDM.
              </div>

              <div>
                <h4 className="font-bold text-[#20272E] text-[12.5px] mb-1">
                  How the Native Windows Connector Operates:
                </h4>
                <ul className="list-disc ml-5 space-y-1.5 text-[#68737D]">
                  <li>
                    <strong className="text-[#20272E]">Local Windows Agent:</strong> A lightweight background Windows service (`volm-cad-connector.exe`) runs on the engineer's workstation or a dedicated build worker.
                  </li>
                  <li>
                    <strong className="text-[#20272E]">Direct COM API Binding:</strong> Interacts with the active `SldWorks.Application` COM interface (`IModelDoc2`, `IFeatureManager`, `IConfigurationManager`) to execute native rebuilds and parameter writes.
                  </li>
                  <li>
                    <strong className="text-[#20272E]">PDM Vault Isolation:</strong> All proposed changes are checked out to an isolated working copy (`WORKING/..._WC.SLDPRT`) to guarantee master vault files are never corrupted by unapproved operations.
                  </li>
                  <li>
                    <strong className="text-[#20272E]">Deterministic Verification:</strong> Readback values are checked against target tolerances before prompting the engineer for formal drawing and BOM sign-off.
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-[#F8FAFB] border border-[#DDE2E6] rounded font-mono text-[11px] text-[#20272E] space-y-1">
                <div className="text-[#68737D]">// Example COM automation call handled by connector:</div>
                <div>ISldWorks swApp = (ISldWorks)Marshal.GetActiveObject("SldWorks.Application");</div>
                <div>IModelDoc2 swModel = swApp.ActivateDoc3("PUMP_CASING_STD_A.SLDPRT", false, 0, ref errors);</div>
                <div>IParameter swParam = swModel.Parameter("D1@Inlet_Port_Boss");</div>
                <div className="text-[#315D78]">swParam.SystemValue = 0.125; // 125 mm in meters</div>
                <div>int rebuildResult = swModel.EditRebuild3();</div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  className="btn-primary"
                  onClick={() => setShowConnectorModal(false)}
                >
                  Close Architecture Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
