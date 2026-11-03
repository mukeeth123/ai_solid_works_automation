// ============================================================
// VOLM Engineering Intelligence — Natural Language Engineering Copilot
// Professional Industrial Terminal & Query Drawer
// Connected to all 10 equipment assemblies, changes, and main assembly
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Send, X, Terminal, ArrowRight, CheckCircle,
  AlertTriangle, Layers, Settings2, FileText, Sparkles, Database,
  Cpu, Shield, RotateCcw, CornerDownLeft, Box, CheckSquare
} from 'lucide-react';
import {
  useStore, useActiveEnquiry, useAllFiles, useMainAssemblyItems,
  useEnquiryChanges
} from '../store/appStore';
import { cn } from './shared';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  referencedEntities?: Array<{
    type: 'part' | 'requirement' | 'change' | 'bom' | 'drawing' | 'assembly';
    label: string;
    actionPath?: string;
  }>;
  suggestedAction?: {
    label: string;
    path: string;
  };
}

const SAMPLE_SUGGESTIONS = [
  'Find reusable equipment.',
  'Identify required modifications.',
  'Analyse assembly dependencies.',
  'Explain proposed design changes.',
  'Summarise the main assembly.',
];

export function EngineeringChatDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: boolean | (() => void) }) {
  const navigate = useNavigate();
  const { state } = useStore();
  const enquiry = useActiveEnquiry();
  const allFiles = useAllFiles();
  const mainItems = useMainAssemblyItems();
  const changes = useEnquiryChanges(enquiry?.id);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init-1',
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      text: `VOLM Engineering Copilot initialized. I have indexed active project ${enquiry?.reference || 'ENQ-2025-0047'}, 10 Equipment Assemblies (8 Standard Reuse + 2 Modified), 4 Engineering Changes, and the Main Skid Assembly.\n\nSelect any quick prompt below or enter an engineering query regarding component reuse, CAD modifications, kinematic mates, or design validation.`,
      referencedEntities: [
        { type: 'assembly', label: 'MAIN_PROCESS_SKID_ASSY.SLDASM', actionPath: '/main-assembly' },
        { type: 'requirement', label: enquiry?.reference || 'Active Enquiry', actionPath: '/enquiries' },
      ],
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleClose = typeof onClose === 'function' ? onClose : () => {};

  const handleSend = (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toISOString(),
      text: textToSend,
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInput('');
    setIsTyping(true);

    // Deterministic Industrial Engineering Intelligence Response Engine
    setTimeout(() => {
      const q = textToSend.toLowerCase();
      let reply: ChatMessage;

      // 1. "Find reusable equipment."
      if (q.includes('find') || q.includes('reusable') || q.includes('reuse candidate')) {
        const standardAssys = mainItems.filter(i => i.category === 'standard_reuse');
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Found 8 Standard Equipment Assemblies suitable for 100% Direct Library Reuse:\n\n` +
            `1. VLM-MOT-IE4-15K (ABB 15 kW IE4 Motor): Frame 160M, 1475 RPM, ATEX Zone 1. Direct match for 65 m³/h @ 48m duty.\n` +
            `2. VLM-CPL-GRID-20 (Grid Coupling): Taper-grid with 140 mm DBSE spacer for cartridge seal maintenance.\n` +
            `3. VLM-VLV-SUC-125 (Suction Valve DN125): PN16 triple-offset wafer butterfly valve with manual gearbox.\n` +
            `4. VLM-VLV-DIS-100 (Discharge Valve DN100): Dual-plate non-slam check valve + throttling globe valve (PN25).\n` +
            `5. VLM-SPL-SUC-125 (Suction Spool DN125): Fabricated 316L SS eccentric reducer spool with drain boss.\n` +
            `6. VLM-SPL-DIS-100 (Discharge Spool DN100): Heavy-wall 316L SS manifold with dual 1/2" NPT instrument ports.\n` +
            `7. VLM-BFR-53A-12L (Plan 53A Seal System): API 682 12L barrier fluid reservoir vessel with level transmitter.\n` +
            `8. VLM-ENC-IP66-SS (Sensor Enclosure): IP66 316SS junction box for vibration accelerometer & RTD PT100 wiring.\n\n` +
            `Assessment: These 8 assemblies require ZERO geometric modifications and are verified in the Main Assembly workspace.`,
          referencedEntities: [
            { type: 'assembly', label: '8 Standard Assemblies', actionPath: '/compare' },
            { type: 'assembly', label: 'Main Assembly Workspace', actionPath: '/main-assembly' },
          ],
          suggestedAction: {
            label: 'Inspect Reuse & Comparison Matrix',
            path: '/compare',
          },
        };
      }
      // 2. "Identify required modifications."
      else if (q.includes('modifi') || q.includes('modify candidate') || q.includes('requires modification')) {
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Identified 2 Equipment Assemblies requiring parametric engineering modifications:\n\n` +
            `1. ASM-001: PUMP_UNIT_STD_A.SLDASM (Centrifugal Feed Pump Unit)\n` +
            `   • Baseline: DN100 suction inlet / 45 m³/h / Cast Iron GG25 / 32 m head.\n` +
            `   • Required Modifications: Enlarge suction nozzle to DN125 (8-hole PN16 BCD 210mm) to lower inlet velocity to 1.47 m/s (+1.2m NPSH margin), assign 316L Stainless Steel metallurgy for chemical dosing, and trim impeller diameter to 188 mm for 48m head.\n\n` +
            `2. ASM-004: SKID_BASE_FRAME_HEAVY.SLDASM (Structural Skid Base Frame)\n` +
            `   • Baseline: 1200 mm length / 4 cross-members / 11 kW motor footprint.\n` +
            `   • Required Modifications: Extend longitudinal C-channel girders from 1200 mm to 1450 mm (+250 mm) to support upgraded 15 kW motor frame (160M) and DN125 pipe spool anchor loads; shift motor mounting pad slots by +180 mm; increase stiffener ribs from 4 to 6.\n\n` +
            `Both modifications have approved change orders and have been verified via simulated CAD rebuild.`,
          referencedEntities: [
            { type: 'change', label: 'CHG-001 (DN125 Inlet)', actionPath: '/cad-change' },
            { type: 'change', label: 'CHG-003 (Skid 1450mm Length)', actionPath: '/cad-change' },
          ],
          suggestedAction: {
            label: 'Review in Change Planner',
            path: '/compare',
          },
        };
      }
      // 3. "Analyse assembly dependencies."
      else if (q.includes('dependenc') || q.includes('analyse') || q.includes('mate') || q.includes('trace')) {
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Cross-Assembly Traceability & Dependency Analysis for Main Process Skid:\n\n` +
            `• Suction Fluid Chain Dependency:\n` +
            `  Customer Ingestion Pipe → Spool SPL-SUC-125 (DN125) → Butterfly Valve VLV-SUC-125 (DN125) → Pump Casing Inlet (Modified DN125 PN16).\n` +
            `  Dependency Rule: Bolt circle diameter must match BCD Ø210 with 8 × M16 studs.\n\n` +
            `• Drive Train Kinematic Dependency:\n` +
            `  Skid Frame (Modified 1450mm) → Motor Foot Pads (Pedestal +180mm) → Motor Shaft (Ø42mm) → Grid Coupling (140mm Spacer) → Pump Shaft (Ø28mm).\n` +
            `  Dependency Rule: Concentric shaft alignment must remain within 0.05 mm TIR (verified: 0.018 mm).\n\n` +
            `• Boundary Limit Dependency:\n` +
            `  Skid base length extension (1200 → 1450 mm) results in overall skid envelope of 1720 × 780 mm, maintaining +130 mm margin inside the customer civil foundation constraint (1850 × 850 mm).`,
          referencedEntities: [
            { type: 'assembly', label: 'Main Assembly Mates', actionPath: '/main-assembly' },
            { type: 'drawing', label: 'GA Drawing DRW-VLM-SKD-MAIN-A2', actionPath: '/review' },
          ],
          suggestedAction: {
            label: 'Inspect Main Assembly Tree & Mates',
            path: '/main-assembly',
          },
        };
      }
      // 4. "Explain proposed design changes."
      else if (q.includes('explain') || q.includes('proposed') || q.includes('change')) {
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Engineering Evaluation of Active Design Changes:\n\n` +
            `• CHG-001 (InletDiameter 100 mm → 125 mm):\n` +
            `  Hydraulic Duty: Q = 65 m³/h (0.01806 m³/s).\n` +
            `  Velocity in DN100 bore: v = 2.30 m/s (causes cavitation & turbulence).\n` +
            `  Velocity in DN125 bore: v = 1.47 m/s (−36.1% reduction per HI 9.6.6 standards).\n` +
            `  NPSHr improved from 3.8m to 2.6m (+1.2m safety margin).\n\n` +
            `• CHG-002 (Material Upgrade Cast Iron GG25 → 316L SS):\n` +
            `  Acid chemical dosing fluid attacks standard cast iron. AISI 316L (1.4404) provides PREN ≥ 23.5, fully certified against pitting.\n\n` +
            `• CHG-003 (Skid Frame Channel Length 1200 mm → 1450 mm):\n` +
            `  Upgrading drive motor from 11 kW to 15 kW (Frame 160M) requires 250 mm additional channel span to maintain 140 mm coupling spacer distance.\n\n` +
            `• CHG-004 (Motor Pedestal Mounting Slot Offset +180 mm):\n` +
            `  Shifts bolt slot pitch from 380 mm to 560 mm to ensure collinear shaft concentricity.`,
          referencedEntities: [
            { type: 'change', label: 'CHG-001 (Inlet 125mm)', actionPath: '/cad-change' },
            { type: 'change', label: 'CHG-003 (Skid Length)', actionPath: '/cad-change' },
          ],
          suggestedAction: {
            label: 'Open CAD Change Centre',
            path: '/cad-change',
          },
        };
      }
      // 5. "Summarise the main assembly."
      else if (q.includes('summar') || q.includes('main assembly') || q.includes('skid')) {
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Main Assembly Summary Dossier — MAIN_PROCESS_SKID_ASSY.SLDASM (Rev A.2):\n\n` +
            `• System Definition: Custom Chemical Transfer & Dosing Skid Unit.\n` +
            `• Sub-Assemblies Coordinated: 10 Total (8 Standard Reuse + 2 Modified).\n` +
            `• Total Mass: 568.1 kg (Steel Skid: 218kg, Motor: 142kg, Pump: 86.5kg, Auxiliaries: 121.6kg).\n` +
            `• Overall Physical Envelope: 1720 mm (L) × 780 mm (W) × 1180 mm (H).\n` +
            `• Civil Foundation Constraint: Passed (Customer limit: 1850 × 850 mm).\n` +
            `• Mates & Alignment: 10/10 kinematic mates satisfied with 0.018 mm TIR shaft concentricity.\n` +
            `• Design Validation Status: 100% Passed. Ready for engineering sign-off and downstream release.`,
          referencedEntities: [
            { type: 'assembly', label: 'MAIN_PROCESS_SKID_ASSY.SLDASM', actionPath: '/main-assembly' },
            { type: 'drawing', label: 'General Arrangement Drawing', actionPath: '/review' },
          ],
          suggestedAction: {
            label: 'View 3D Main Assembly Workspace',
            path: '/main-assembly',
          },
        };
      }
      // General Engineering Query Fallback
      else {
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Engineering Copilot evaluated query: "${textToSend}"\n\n` +
            `Cross-referenced active project ${enquiry?.reference}, 10 equipment assemblies, and CAD models:\n` +
            `• Scope: 10 Assemblies (8 Standard Reuse, 2 Modified)\n` +
            `• Pump Model: PUMP_UNIT_STD_A.SLDASM (Modified DN125)\n` +
            `• Skid Model: SKID_BASE_FRAME_HEAVY.SLDASM (Modified 1450mm)\n` +
            `• Main Assembly: MAIN_PROCESS_SKID_ASSY.SLDASM (Rev A.2)\n\n` +
            `Try clicking one of the practical prompt chips above for targeted technical evaluations.`,
          referencedEntities: [
            { type: 'assembly', label: 'Main Assembly Workspace', actionPath: '/main-assembly' },
            { type: 'part', label: 'CAD Change Centre', actionPath: '/cad-change' },
          ],
          suggestedAction: {
            label: 'Open Main Assembly Workspace',
            path: '/main-assembly',
          },
        };
      }

      setMessages(prev => [...prev, reply]);
      setIsTyping(false);
    }, 450);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[460px] bg-[#1C2128] border-l border-[#2D3A47] shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="px-4 py-3 bg-[#242C35] border-b border-[#2D3A47] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[#315D78] flex items-center justify-center text-white">
            <Terminal size={14} className="text-[#58A6FF]" />
          </div>
          <div>
            <div className="text-[12.5px] font-bold text-white flex items-center gap-2">
              <span>Engineering Copilot</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-[#388BFD]/20 text-[#58A6FF] border border-[#388BFD]/40">
                Connected
              </span>
            </div>
            <div className="text-[10px] text-[#8B949E]">
              10 Assemblies • Parametric SOLIDWORKS • Main Skid Integration
            </div>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="p-1 rounded text-[#8B949E] hover:text-white hover:bg-[#2E3B48] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Practical Prompt Chips Bar (Required Prompts) */}
      <div className="px-3 py-2 bg-[#161B22] border-b border-[#2D3A47] space-y-1.5 flex-shrink-0">
        <div className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider flex items-center gap-1">
          <Sparkles size={11} className="text-[#58A6FF]" />
          <span>Practical Engineering Prompts:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_SUGGESTIONS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="px-2 py-1 rounded text-[10.5px] font-medium bg-[#21262D] hover:bg-[#30363D] text-[#C9D1D9] hover:text-white border border-[#30363D] transition-colors text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#1C2128]">
        {messages.map(msg => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}
            >
              <div
                className={cn(
                  'max-w-[92%] p-3 rounded-lg text-[12px] leading-relaxed',
                  isUser
                    ? 'bg-[#315D78] text-white rounded-br-xs'
                    : 'bg-[#242C35] text-[#C9D1D9] border border-[#2D3A47] rounded-bl-xs'
                )}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Referenced Entities Chips */}
                {msg.referencedEntities && msg.referencedEntities.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-[#30363D] flex flex-wrap gap-1.5">
                    {msg.referencedEntities.map((ent, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (ent.actionPath) {
                            navigate(ent.actionPath);
                            handleClose();
                          }
                        }}
                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#161B22] text-[#58A6FF] hover:text-white border border-[#30363D] flex items-center gap-1"
                      >
                        <Box size={10} />
                        <span>{ent.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Direct Action Link */}
                {msg.suggestedAction && (
                  <button
                    onClick={() => {
                      navigate(msg.suggestedAction!.path);
                      handleClose();
                    }}
                    className="mt-2 w-full px-2.5 py-1.5 rounded bg-[#388BFD]/20 hover:bg-[#388BFD]/30 border border-[#388BFD]/40 text-[#58A6FF] hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>{msg.suggestedAction.label}</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
              <span className="text-[9.5px] text-[#6E7681] mt-1 px-1">
                {isUser ? 'You' : 'Engineering Copilot'}
              </span>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 text-[#8B949E] text-[11px] p-2">
            <Sparkles size={13} className="animate-spin text-[#58A6FF]" />
            <span>Analyzing assembly kinematics & parameters…</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 bg-[#242C35] border-t border-[#2D3A47] flex-shrink-0">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            className="flex-1 bg-[#161B22] border border-[#30363D] focus:border-[#58A6FF] rounded px-3 py-2 text-[12px] text-white placeholder-[#6E7681] outline-none"
            placeholder="Ask about reuse, modifications, mates, or validation..."
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 rounded bg-[#315D78] hover:bg-[#254B62] disabled:opacity-40 text-white transition-colors"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
