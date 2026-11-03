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
      text: `VOLM Engineering Copilot initialized. I have indexed active project ${enquiry?.reference || 'ENQ-2025-0047'}, 10 Packaging Equipment Assemblies (8 Standard Reuse + 2 Modified), 4 Engineering Changes, and the Master Automated Packaging Line Assembly.\n\nSelect any practical prompt below or enter an engineering query regarding component reuse, CAD modifications, kinematic mates, or design validation.`,
      referencedEntities: [
        { type: 'assembly', label: 'VOLM_AUTOMATED_PACKAGING_LINE_MAIN.SLDASM', actionPath: '/main-assembly' },
        { type: 'requirement', label: enquiry?.reference || 'Active Brief', actionPath: '/enquiries' },
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
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Found 8 Standard Equipment Assemblies suitable for 100% Direct Library Reuse:\n\n` +
            `1. VLM-CNV-INF-3000: Infeed Incline Cleated Elevator Conveyor (3.0 m, FDA blue belt, 75 BPM capacity).\n` +
            `2. VLM-FEED-VIB-800: Electromagnetic Vibratory Cross-Feed Dispensing Tray (800 mm, 304 SS washdown).\n` +
            `3. VLM-PRN-TTO-MNT: Thermal Transfer Overprinter Date Coder Web Mount (53 mm printhead, 300 DPI).\n` +
            `4. VLM-SEAL-ROT-SRV: Dual-Axis Rotary Servo Sealing & Cut-Off Jaw Mechanism (PID temperature control).\n` +
            `5. VLM-CNV-TAK-1800: Packaged Bag Takeaway Elevator Conveyor (1.8 m length, rough-top grip belt).\n` +
            `6. VLM-CHK-DYN-600: Dynamic Inline High-Speed Checkweigher with Pneumatic Flipper Reject Arm.\n` +
            `7. VLM-TBL-ROT-1200: Rotary Accumulation & Hand Pack-Off Inspection Turntable (Ø1200 mm 304 SS disc).\n` +
            `8. VLM-GRD-LEX-CELL: Interlocked Clear Lexan Safety Guarding Cell Enclosure (ISO 13849-1 Cat 4 / PLe).\n\n` +
            `Assessment: These 8 packaging assemblies require ZERO geometric modifications and are fully verified in the Main Assembly workspace.`,
          referencedEntities: [
            { type: 'assembly', label: '8 Standard Packaging Assemblies', actionPath: '/compare' },
            { type: 'assembly', label: '5. Main Assembly', actionPath: '/main-assembly' },
          ],
          suggestedAction: {
            label: 'Inspect 3. Reuse & Comparison',
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
          text: `Identified 2 Packaging Equipment Assemblies requiring parametric engineering modifications:\n\n` +
            `1. ASM-001: VOLM_MULTIHEAD_WEIGHER_14H.SLDASM (14-Head Radial Combination Weigher)\n` +
            `   • Baseline: 300 mm discharge chute outlet / 55° cone slope / 40 BPM limit / 304 SS.\n` +
            `   • Required Modifications: Expand collector funnel outlet from 300 mm to 450 mm (+50%) and steepen cone angle to 62° to prevent produce bridging at 60 bags/min. Upgrade product-contact pans to electropolished 316L SS dimpled sheet.\n\n` +
            `2. ASM-002: VOLM_VFFS_BAGGING_UNIT_600.SLDASM (Continuous-Motion VFFS Bagging Unit)\n` +
            `   • Baseline: 400 mm maximum pouch width / Ø128 mm forming tube / 450 mm carriage span.\n` +
            `   • Required Modifications: Extend crosshead sealing jaw stroke and carriage width to 600 mm for 2.5kg family-pack pouches. Expand forming collar to Ø192 mm shoulder.\n\n` +
            `Both modifications have approved change orders and have been verified via simulated CAD rebuild in the CAD Change Centre.`,
          referencedEntities: [
            { type: 'change', label: 'CHG-001 (Weigher 450mm Chute)', actionPath: '/cad-change' },
            { type: 'change', label: 'CHG-003 (VFFS 600mm Jaw Stroke)', actionPath: '/cad-change' },
          ],
          suggestedAction: {
            label: 'Review in 4. CAD Change Centre',
            path: '/cad-change',
          },
        };
      }
      // 3. "Analyse assembly dependencies."
      else if (q.includes('dependenc') || q.includes('analyse') || q.includes('mate') || q.includes('trace')) {
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Cross-Assembly Traceability & Dependency Analysis for Automated Packaging Line:\n\n` +
            `• Product Gravity Flow Transfer Chain:\n` +
            `  Infeed Cleated Conveyor (2850 mm head) → Vibratory Pan Feeder (800 mm) → Weigher Top Dispersion Cone → 14 Weigh Buckets → Modified 450 mm Funnel Chute → VFFS 600 mm Forming Tube → Rotary Servo Jaws → Takeaway Conveyor → Dynamic Checkweigher → Rotary Accumulation Table.\n` +
            `  Dependency Rule: Concentric drop alignment between 450mm weigher chute and VFFS forming collar must maintain 0.0 mm interference (verified: 0.012 mm alignment).\n\n` +
            `• Kinematic Throughput Synchronization:\n` +
            `  Weigher batch discharge and VFFS rotary sealing jaw cycle rate synchronized at 60 bags/min.\n\n` +
            `• Plant Bay Civil Boundary Dependency:\n` +
            `  Total packaging line length (4650 mm) maintains +350 mm margin inside customer civil foundation bay limit (5000 mm).`,
          referencedEntities: [
            { type: 'assembly', label: 'Main Assembly Spatial Mates', actionPath: '/main-assembly' },
            { type: 'drawing', label: 'GA Drawing DRW-VLM-LINE-4000-A3', actionPath: '/review' },
          ],
          suggestedAction: {
            label: 'Inspect 5. Main Assembly',
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
          text: `Engineering Evaluation of Active Packaging Design Changes:\n\n` +
            `• CHG-001 (Collector Chute Outlet Width 300 mm → 450 mm):\n` +
            `  Packaging Rate: Target 60 Bags/min with 2.5kg produce charges.\n` +
            `  Discharge Area: Expands from 0.0707 m² to 0.1590 m² (+125% area expansion, 2.25× capacity).\n` +
            `  Funnel Angle: Steepened from 55° to 62° to overcome bulk friction (μ = 0.42), preventing produce bridging.\n\n` +
            `• CHG-002 (Material Upgrade 304 SS → 316L SS Dimpled Finish):\n` +
            `  Mandated by USDA / FDA 3-A sanitary guidelines for washdown food packaging. Dimpled electropolished finish (Ra < 0.4 µm) prevents wet produce adhesion.\n\n` +
            `• CHG-003 (VFFS Sealing Jaw Carriage Stroke 400 mm → 600 mm):\n` +
            `  Accommodates 2.5kg family-pack pillow pouches with 650 mm jaw clamp span. Servo clamp pressure 8.5 kN @ 210°C.\n\n` +
            `• CHG-004 (Forming Collar Diameter Ø128 mm → Ø192 mm):\n` +
            `  Provides required film tube cross-section for 600 mm lay-flat pouch format.`,
          referencedEntities: [
            { type: 'change', label: 'CHG-001 (Chute 450mm)', actionPath: '/cad-change' },
            { type: 'change', label: 'CHG-003 (VFFS 600mm)', actionPath: '/cad-change' },
          ],
          suggestedAction: {
            label: 'Open 4. CAD Change Centre',
            path: '/cad-change',
          },
        };
      }
      // 5. "Summarise the main assembly."
      else if (q.includes('summar') || q.includes('main assembly') || q.includes('line') || q.includes('packaging')) {
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Master Assembly Summary Dossier — VOLM_AUTOMATED_PACKAGING_LINE_MAIN.SLDASM (Rev A.3):\n\n` +
            `• System Definition: Volm High-Speed Automated Produce Packaging & Weighing Line.\n` +
            `• Sub-Assemblies Coordinated: 10 Total (8 Standard Reuse + 2 Modified).\n` +
            `• Total Machine Mass: 1,480.0 kg.\n` +
            `• Overall Physical Footprint: 4650 mm (L) × 1850 mm (W) × 3450 mm (H).\n` +
            `• Plant Bay Constraint: Passed (Customer bay limit: 5000 mm × 2400 mm, +350 mm margin).\n` +
            `• Mates & Alignment: 10/10 spatial product transfer mates satisfied with zero collisions.\n` +
            `• Line Speed: Synchronized 60 Bags/min continuous produce portioning.\n` +
            `• Design Validation Status: 100% Passed. Ready for engineering sign-off and manufacturing release.`,
          referencedEntities: [
            { type: 'assembly', label: 'VOLM_AUTOMATED_PACKAGING_LINE_MAIN.SLDASM', actionPath: '/main-assembly' },
            { type: 'drawing', label: 'Line GA Drawing DRW-VLM-LINE-4000-A3', actionPath: '/review' },
          ],
          suggestedAction: {
            label: 'View 5. Main Assembly',
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
            `Cross-referenced active project ${enquiry?.reference}, 10 packaging equipment assemblies, and CAD models:\n` +
            `• Scope: 10 Assemblies (8 Standard Reuse, 2 Modified)\n` +
            `• Weigher Model: VOLM_MULTIHEAD_WEIGHER_14H.SLDASM (Modified 450mm Chute)\n` +
            `• Bagger Model: VOLM_VFFS_BAGGING_UNIT_600.SLDASM (Modified 600mm)\n` +
            `• Main Assembly: VOLM_AUTOMATED_PACKAGING_LINE_MAIN.SLDASM (Rev A.3)\n\n` +
            `Try clicking one of the practical prompt chips above for targeted technical evaluations.`,
          referencedEntities: [
            { type: 'assembly', label: '5. Main Assembly', actionPath: '/main-assembly' },
            { type: 'part', label: '4. CAD Change Centre', actionPath: '/cad-change' },
          ],
          suggestedAction: {
            label: 'Open 5. Main Assembly',
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
