// ============================================================
// VOLM Engineering Intelligence — Natural Language Engineering Copilot
// Professional Industrial Terminal & Query Drawer
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Send, X, Terminal, ArrowRight, CheckCircle,
  AlertTriangle, Layers, Settings2, FileText, Sparkles, Database,
  Cpu, Shield, RotateCcw, CornerDownLeft
} from 'lucide-react';
import { useStore, useActiveEnquiry, useAllFiles } from '../store/appStore';
import { cn } from './shared';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  referencedEntities?: Array<{
    type: 'part' | 'requirement' | 'change' | 'bom' | 'drawing';
    label: string;
    actionPath?: string;
  }>;
  suggestedAction?: {
    label: string;
    path: string;
  };
}

const SAMPLE_SUGGESTIONS = [
  'What critical requirements are missing or unconfirmed?',
  'Find reusable pump assemblies with flow >= 40 m³/h',
  'Trace dependencies for the DN125 casing change',
  'Audit the current BOM for missing ERP mappings',
  'Is 316L Stainless Steel suitable for chemical dosing service?',
  'What is the status of CAD execution EXEC-001?',
];

export function EngineeringChatDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: boolean | (() => void) }) {
  const navigate = useNavigate();
  const { state } = useStore();
  const enquiry = useActiveEnquiry();
  const allFiles = useAllFiles();

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init-1',
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      text: `VOLM Engineering Copilot initialized. I have indexed active enquiry ${enquiry?.reference || 'ENQ-2025-0047'}, ${allFiles.length} CAD models, active comparison records, and the current EBOM.\n\nAsk any question regarding equipment requirements, SOLIDWORKS geometry parameters, change impacts, or BOM validation.`,
      referencedEntities: [
        { type: 'requirement', label: enquiry?.reference || 'Active Enquiry', actionPath: '/enquiries' },
        { type: 'part', label: 'PUMP_UNIT_STD_A.SLDASM', actionPath: '/library' },
      ],
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleClose = typeof onClose === 'function' ? onClose : () => {};

  const handleSend = (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toISOString(),
      text: textToSend,
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInput('');
    setIsTyping(true);

    // Deterministic Industrial Response Engine
    setTimeout(() => {
      const q = textToSend.toLowerCase();
      let reply: ChatMessage;

      if (q.includes('missing') || q.includes('unconfirmed') || q.includes('critical requirement')) {
        const missingReqs = enquiry?.requirements.filter(r => r.status === 'missing' || r.status === 'unconfirmed') || [];
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Found ${missingReqs.length} unresolved requirements in ${enquiry?.reference}:\n\n` +
            `• REQ-009 (Motor Power): Missing. Required power must be calculated from duty point (65 m³/h @ 48 m head).\n` +
            `• REQ-011 (Structural Assessment): Critical open item. Casing wall stress must be evaluated for DN125 nozzle loads.\n` +
            `• REQ-008 (Foundation Footprint): Unconfirmed customer provisional value (≤ 950 × 450 mm).\n\n` +
            `Rule Check: Progress to CAD execution is permitted with warnings, but formal release requires structural sign-off.`,
          referencedEntities: [
            { type: 'requirement', label: 'REQ-009 Motor Power', actionPath: '/enquiries' },
            { type: 'requirement', label: 'REQ-011 Structural Assessment', actionPath: '/enquiries' },
          ],
          suggestedAction: {
            label: 'Review in Enquiry Workspace',
            path: '/enquiries',
          },
        };
      } else if (q.includes('find') || q.includes('reusable') || q.includes('pump') || q.includes('flow')) {
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Identified 1 matching assembly candidate in the library:\n\n` +
            `• Model: PUMP_UNIT_STD_A.SLDASM (Rev C, Released)\n` +
            `• Baseline Flow: 45 m³/h @ 32 m head (Motor: 11 kW)\n` +
            `• Enquiry Target: 65 m³/h @ 48 m head\n\n` +
            `Reusability Evaluation: Classed as "Modify Candidate". The frame and bearing bracket can be reused directly; casing inlet requires DN125 modification and wetted parts require 316L SS material assignment.`,
          referencedEntities: [
            { type: 'part', label: 'PUMP_UNIT_STD_A.SLDASM', actionPath: '/library' },
            { type: 'part', label: 'PUMP_CASING_STD_A.SLDPRT', actionPath: '/library' },
          ],
          suggestedAction: {
            label: 'Inspect in Compare & Plan',
            path: '/compare',
          },
        };
      } else if (q.includes('dependenc') || q.includes('dn125') || q.includes('trace') || q.includes('inlet')) {
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Traceability graph for CHG-001 (InletDiameter 100mm → 125mm):\n\n` +
            `1. Target Parameter: D1@Inlet_Port_Boss in PUMP_CASING_STD_A.SLDPRT (DN125 Configuration)\n` +
            `2. Assembly Impact: PUMP_UNIT_STD_A.SLDASM inlet suction mate alignment verified.\n` +
            `3. Drafting Impact: Drawing DRW-VLM-1042-A-C (Sheets 1 & 3) requires dimension update (Ø100 → Ø125 H7) and bolt circle update (Ø180 → Ø210).\n` +
            `4. BOM Impact: BOM Item 1 description callout updated to DN125 casing.\n` +
            `5. Approval Status: Approved by S. Okonkwo on 2025-01-11.`,
          referencedEntities: [
            { type: 'change', label: 'CHG-001 (Inlet 125mm)', actionPath: '/compare' },
            { type: 'drawing', label: 'DRW-VLM-1042-A-C', actionPath: '/review' },
            { type: 'bom', label: 'BOM Item 1', actionPath: '/review' },
          ],
          suggestedAction: {
            label: 'Open CAD Change Centre',
            path: '/cad-change',
          },
        };
      } else if (q.includes('bom') || q.includes('erp') || q.includes('audit')) {
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Engineering BOM Audit for PUMP_UNIT_STD_A.SLDASM (Rev C):\n\n` +
            `• Total Line Items: 6 components (100% resolved references).\n` +
            `• ERP Ready: 4 items mapped (VLM-PUMP-1042-A, VLM-IMP-5VN-200, VLM-SHAFT-028, VLM-BB-STD-01).\n` +
            `• Warnings (2 items missing ERP mapping):\n` +
            `   - Item 4 (VLM-SEAL-T2-28): Mechanical seal lacks ERP part master record.\n` +
            `   - Item 6 (VLM-BSG-001): Bearing sub-assembly lacks parent assembly code.\n\n` +
            `Release Gate: ERP export will be flagged until these 2 mappings are provided.`,
          referencedEntities: [
            { type: 'bom', label: 'EBOM Rev C', actionPath: '/review' },
          ],
          suggestedAction: {
            label: 'View BOM Validation Tab',
            path: '/review',
          },
        };
      } else if (q.includes('316l') || q.includes('material') || q.includes('chemical')) {
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Material Evaluation: 316L Stainless Steel (1.4404) vs. Baseline Cast Iron (GG25):\n\n` +
            `• Compatibility: 316L SS meets chemical dosing requirements per customer spec Section 4.1 (pitting resistance PREN ≥ 23).\n` +
            `• Density & Mass: 316L density (8,000 kg/m³) is +11% higher than Cast Iron (7,200 kg/m³). Net casing mass increases from 14.6 kg to ~16.2 kg if cast with equivalent wall thickness.\n` +
            `• Change Proposal: CHG-002 is registered in the planner awaiting Lead Materials Engineer approval.`,
          referencedEntities: [
            { type: 'change', label: 'CHG-002 Material Change', actionPath: '/compare' },
            { type: 'requirement', label: 'REQ-004 Material Spec', actionPath: '/enquiries' },
          ],
          suggestedAction: {
            label: 'Inspect Change CHG-002',
            path: '/compare',
          },
        };
      } else if (q.includes('exec') || q.includes('cad') || q.includes('status')) {
        const lastExec = state.executions[0];
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `CAD Execution Status Dossier:\n\n` +
            `• Active Execution ID: ${lastExec?.id || 'EXEC-001'}\n` +
            `• Target: PUMP_CASING_STD_A.SLDPRT [DN125 Configuration]\n` +
            `• Adapter: Mock CAD Adapter (Deterministic Simulation Mode)\n` +
            `• Pipeline Result: Complete (All 5 stages passed: Pre-flight → Sandbox → Parameter Mutation → Rebuild → Readback)\n` +
            `• Actual Readback: 125 mm (Tolerance verified)\n` +
            `• Model Rebuild: Clean (0 errors, 0 warnings).\n\n` +
            `Notice: Simulated CAD operation — no native SOLIDWORKS binary files modified on disk.`,
          referencedEntities: [
            { type: 'part', label: 'PUMP_CASING_STD_A.SLDPRT', actionPath: '/library' },
          ],
          suggestedAction: {
            label: 'Inspect in CAD Change Centre',
            path: '/cad-change',
          },
        };
      } else {
        reply = {
          id: `msg-resp-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Deterministic Engineering Query Parser evaluated: "${textToSend}"\n\n` +
            `Cross-referenced against active enquiry ${enquiry?.reference}, library parts, and change history:\n` +
            `• Active Equipment Scope: Centrifugal Chemical Dosing Pump Unit\n` +
            `• Candidate Base Model: PUMP_UNIT_STD_A.SLDASM\n` +
            `• Active Changes: 3 proposed (1 executed, 1 pending review, 1 revision requested)\n\n` +
            `Use the suggested prompts below or specify a part number, requirement ID, or BOM item to drill down.`,
          referencedEntities: [
            { type: 'part', label: 'Engineering Library', actionPath: '/library' },
            { type: 'bom', label: 'BOM Review', actionPath: '/review' },
          ],
          suggestedAction: {
            label: 'Explore Library',
            path: '/library',
          },
        };
      }

      setMessages(prev => [...prev, reply]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[460px] max-w-full bg-white border-l border-[#DDE2E6] shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="px-4 py-3 border-b border-[#DDE2E6] bg-[#202830] text-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#315D78] flex items-center justify-center">
            <Terminal size={14} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-[13px] leading-tight flex items-center gap-1.5">
              VOLM Engineering Copilot
              <span className="text-[9px] font-mono bg-[#315D78] px-1.5 py-0.2 rounded text-white uppercase">
                Deterministic
              </span>
            </h3>
            <p className="text-[10.5px] text-[#9AAAB5] leading-tight">
              Natural Language CAD & PDM Knowledge Engine
            </p>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="text-[#9AAAB5] hover:text-white p-1 rounded hover:bg-[#2D3A47] transition-colors"
          title="Close Copilot"
        >
          <X size={16} />
        </button>
      </div>

      {/* Security & Offline Guarantee Banner */}
      <div className="px-3 py-1.5 bg-[#F4F5F6] border-b border-[#DDE2E6] flex items-center justify-between text-[10.5px] text-[#68737D] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Shield size={11} className="text-[#315D78]" />
          <span>Offline Deterministic Mode — Zero Confidential Data Exfiltration</span>
        </div>
        <span className="font-mono text-[9.5px]">ISO 27001</span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#FAFBFB]">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={cn(
              'flex flex-col',
              msg.sender === 'user' ? 'items-end' : 'items-start'
            )}
          >
            <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-[#9AAAB5]">
              <span>{msg.sender === 'user' ? state.currentUser : 'Engineering Intelligence'}</span>
              <span>·</span>
              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div
              className={cn(
                'p-3 rounded text-[12px] max-w-[92%] leading-relaxed',
                msg.sender === 'user'
                  ? 'bg-[#315D78] text-white rounded-br-none'
                  : 'bg-white border border-[#DDE2E6] text-[#20272E] shadow-xs rounded-bl-none'
              )}
            >
              <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

              {/* Referenced Entities Pills */}
              {msg.referencedEntities && msg.referencedEntities.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-[#EEF1F4] flex flex-wrap gap-1.5">
                  {msg.referencedEntities.map((ent, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (ent.actionPath) {
                          navigate(ent.actionPath);
                          handleClose();
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[10.5px] bg-[#EBF2F7] hover:bg-[#D5E3EE] text-[#315D78] font-medium px-2 py-0.5 rounded border border-[#C5D9E8] transition-colors"
                    >
                      <Layers size={10} />
                      {ent.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Action Button */}
              {msg.suggestedAction && (
                <div className="mt-2 pt-2 border-t border-[#EEF1F4]">
                  <button
                    onClick={() => {
                      navigate(msg.suggestedAction!.path);
                      handleClose();
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#315D78] hover:text-[#20272E] hover:underline"
                  >
                    <span>{msg.suggestedAction.label}</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-[#68737D] text-[11px] p-2 bg-white rounded border border-[#DDE2E6] w-fit">
            <Terminal size={12} className="animate-spin text-[#315D78]" />
            <span>Parsing engineering requirements & geometry graph...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="p-2 border-t border-[#DDE2E6] bg-white flex-shrink-0">
        <div className="text-[10px] font-semibold text-[#68737D] uppercase tracking-wide mb-1 px-1">
          Quick Engineering Prompts:
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {SAMPLE_SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(s)}
              className="text-[10.5px] text-[#20272E] bg-[#F4F5F6] hover:bg-[#EBF2F7] hover:text-[#315D78] border border-[#DDE2E6] px-2 py-1 rounded whitespace-nowrap transition-colors flex-shrink-0"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input Bar */}
      <div className="p-3 bg-white border-t border-[#DDE2E6] flex items-center gap-2 flex-shrink-0">
        <input
          className="eng-input text-[12px] flex-1 py-1.5"
          placeholder="Ask about requirements, CAD parameters, BOM or dependencies..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSend();
          }}
        />
        <button
          className="btn-primary py-1.5 px-3"
          disabled={!input.trim() || isTyping}
          onClick={() => handleSend()}
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
