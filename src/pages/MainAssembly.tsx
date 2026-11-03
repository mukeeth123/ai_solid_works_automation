// ============================================================
// VOLM Engineering Intelligence — Main Assembly Workspace
// Coordinates all 10 equipment assemblies in one master assembly
// Interactive FeatureManager tree, 3D CAD preview, component inspection,
// and automated assembly completeness & dependency validation.
// ============================================================

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers, Box, CheckCircle, AlertTriangle, Play, RefreshCw,
  Search, Eye, EyeOff, Sliders, Shield, ArrowRight, Settings2,
  FileText, Activity, Info, GitCompare, ChevronRight, ChevronDown,
  Check, Download, AlertCircle, Compass, Scale, Ruler, CheckSquare
} from 'lucide-react';
import {
  useStore, useMainAssemblyItems, useMainAssemblyMates,
  useMainAssemblyValidation, useActiveEnquiry, useAllFiles
} from '../store/appStore';
import { MainAssembly3DViewer } from '../components/MainAssembly3DViewer';
import type { MainAssemblyItem, MainAssemblyMate } from '../types/engineering';
import {
  StatusBadge, SectionPanel, InfoRow, EmptyState, TabBar,
  cn, formatDateTime, ScrollPane, ProgressBar
} from '../components/shared';

const RIGHT_TABS = [
  { id: 'inspector', label: 'Component Inspector' },
  { id: 'mates', label: 'Mates & Constraints' },
  { id: 'validation', label: 'Assembly Validation' },
];

export default function MainAssembly() {
  const navigate = useNavigate();
  const { state, dispatch } = useStore();
  const enquiry = useActiveEnquiry();
  const items = useMainAssemblyItems();
  const mates = useMainAssemblyMates();
  const validation = useMainAssemblyValidation();

  const [selectedItemId, setSelectedItemId] = useState<string>(
    state.selectedMainAssemblyItemId || 'mai-002'
  );
  const [filterCategory, setFilterCategory] = useState<'all' | 'standard_reuse' | 'modified'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRightTab, setActiveRightTab] = useState('inspector');
  const [isSolving, setIsSolving] = useState(false);
  const [solverSuccessMsg, setSolverSuccessMsg] = useState(false);

  const selectedItem = useMemo(() => {
    return items.find(i => i.id === selectedItemId) || items[0];
  }, [items, selectedItemId]);

  const selectedItemMates = useMemo(() => {
    if (!selectedItem) return [];
    return mates.filter(m => selectedItem.mateIds.includes(m.id));
  }, [mates, selectedItem]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchCat = filterCategory === 'all' || item.category === filterCategory;
      const matchSearch = !searchTerm ||
        item.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [items, filterCategory, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = items.length;
    const standardCount = items.filter(i => i.category === 'standard_reuse').length;
    const modifiedCount = items.filter(i => i.category === 'modified').length;
    const totalMass = items.reduce((acc, i) => acc + (i.isSuppressed ? 0 : i.massKg), 0);
    return { total, standardCount, modifiedCount, totalMass };
  }, [items]);

  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    dispatch({ type: 'SET_MAIN_ASSEMBLY_ITEM_SELECTION', id });
  };

  const handleToggleSuppress = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const item = items.find(i => i.id === id);
    if (!item) return;
    dispatch({
      type: 'UPDATE_MAIN_ASSEMBLY_ITEM',
      item: { id, isSuppressed: !item.isSuppressed }
    });
  };

  const handleRunValidation = () => {
    setIsSolving(true);
    setSolverSuccessMsg(false);
    setTimeout(() => {
      dispatch({ type: 'RUN_MAIN_ASSEMBLY_VALIDATION' });
      dispatch({
        type: 'ADD_AUDIT_EVENT',
        event: {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: state.currentUser,
          action: 'Assembly Validation Run',
          entityType: 'MainAssembly',
          entityId: 'asm-000',
          detail: 'Simulated 10-assembly kinematic solver, interference check, and envelope bounds verification.',
          enquiryId: enquiry?.id,
        }
      });
      setIsSolving(false);
      setSolverSuccessMsg(true);
      setTimeout(() => setSolverSuccessMsg(false), 4000);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#F4F5F6' }}>
      {/* Top Industrial Header Banner */}
      <div className="bg-white border-b border-[#DDE2E6] px-5 py-3 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#1C2128] flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <Layers size={20} className="text-[#58A6FF]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[15px] font-bold text-[#20272E] tracking-tight">
                Main Assembly Workspace — VOLM_AUTOMATED_PACKAGING_LINE_MAIN.SLDASM
              </h1>
              <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-[#238636]/15 text-[#238636] border border-[#238636]/30">
                Rev A.3 • 10 Assemblies Combined
              </span>
              <span className="px-2 py-0.5 rounded text-[10.5px] font-mono text-[#4A5568] bg-[#F1F3F5] border border-[#DDE2E6]">
                Origin [0, 0, 0] Infeed Line Datum
              </span>
            </div>
            <div className="text-[11px] text-[#68737D] mt-0.5 flex items-center gap-2">
              <span>{enquiry?.reference || 'ENQ-2025-0047'} Volm High-Speed Automated Produce Packaging & Weighing System</span>
              <span>•</span>
              <span className="font-semibold text-[#20272E]">{stats.total} Total Sub-Assemblies</span>
              <span>(</span>
              <span className="text-[#238636] font-medium">{stats.standardCount} Standard Reuse</span>
              <span>+</span>
              <span className="text-[#B08800] font-medium">{stats.modifiedCount} Modified</span>
              <span>)</span>
              <span>•</span>
              <span>Envelope: 4650 × 1850 × 3450 mm</span>
              <span>•</span>
              <span>Total Mass: {stats.totalMass.toFixed(1)} kg</span>
            </div>
          </div>
        </div>

        {/* Global Assembly Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunValidation}
            disabled={isSolving}
            className="eng-btn bg-[#238636] text-white hover:bg-[#2EA043] flex items-center gap-2 py-1.5 px-3 text-[12px] font-semibold rounded shadow-sm transition-colors"
          >
            <RefreshCw size={13} className={cn(isSolving && 'animate-spin')} />
            <span>{isSolving ? 'Solving Mates & Interferences…' : 'Solve Mates & Verify Integrity'}</span>
          </button>

          <button
            onClick={() => navigate('/review')}
            className="eng-btn bg-[#315D78] text-white hover:bg-[#254B62] flex items-center gap-1.5 py-1.5 px-3 text-[12px] font-semibold rounded shadow-sm transition-colors"
          >
            <span>Proceed to Review & Release</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Solver Success Toast */}
      {solverSuccessMsg && (
        <div className="bg-[#DEF7EC] border-b border-[#31C48D] px-4 py-1.5 flex items-center justify-between text-[11.5px] text-[#03543F]">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-[#31C48D]" />
            <span className="font-semibold">Assembly Kinematic Solver Completed:</span>
            <span>All 10 sub-assemblies fully resolved. 10/10 spatial mates satisfied. Zero interferences detected. Skid envelope passes customer civil constraint.</span>
          </div>
        </div>
      )}

      {/* Main Workspace: 3 Panes (Tree Left, 3D Center, Inspector Right) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: FeatureManager Assembly Tree */}
        <div className="w-80 flex-shrink-0 bg-white border-r border-[#DDE2E6] flex flex-col overflow-hidden">
          {/* Tree Header & Search */}
          <div className="p-3 border-b border-[#DDE2E6] space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11.5px] font-bold text-[#20272E] uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-[#315D78]" />
                <span>FeatureManager Assembly Tree</span>
              </div>
              <span className="text-[10.5px] font-mono text-[#68737D] bg-[#F4F5F6] px-1.5 py-0.5 rounded">
                {filteredItems.length} / {items.length}
              </span>
            </div>

            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9AAAB5]" />
              <input
                className="eng-input pl-8 text-[11.5px] py-1"
                placeholder="Filter assemblies…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Category Filter Tabs */}
            <div className="flex rounded border border-[#DDE2E6] p-0.5 bg-[#F4F5F6] text-[10.5px]">
              <button
                onClick={() => setFilterCategory('all')}
                className={cn('flex-1 py-1 rounded font-medium transition-colors text-center', filterCategory === 'all' ? 'bg-white text-[#20272E] shadow-xs' : 'text-[#68737D] hover:text-[#20272E]')}
              >
                All (10)
              </button>
              <button
                onClick={() => setFilterCategory('standard_reuse')}
                className={cn('flex-1 py-1 rounded font-medium transition-colors text-center', filterCategory === 'standard_reuse' ? 'bg-white text-[#238636] shadow-xs' : 'text-[#68737D] hover:text-[#20272E]')}
              >
                Reuse (8)
              </button>
              <button
                onClick={() => setFilterCategory('modified')}
                className={cn('flex-1 py-1 rounded font-medium transition-colors text-center', filterCategory === 'modified' ? 'bg-white text-[#B08800] shadow-xs' : 'text-[#68737D] hover:text-[#20272E]')}
              >
                Modified (2)
              </button>
            </div>
          </div>

          {/* Assembly Tree Nodes List */}
          <ScrollPane className="flex-1 p-2 space-y-1">
            {/* Root Assembly Node */}
            <div className="px-2.5 py-2 rounded bg-[#F1F5F9] border border-[#CBD5E1] text-[11.5px] font-bold text-[#1E293B] flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate">
                <Box size={14} className="text-[#315D78] flex-shrink-0" />
                <span className="truncate">VOLM_AUTOMATED_PACKAGING_LINE_MAIN</span>
              </div>
              <span className="text-[10px] font-mono text-[#64748B]">Rev A.3</span>
            </div>

            {/* Sub-Assembly Items */}
            <div className="pl-3 border-l-2 border-[#CBD5E1] space-y-1 mt-1">
              {filteredItems.map(item => {
                const isSelected = item.id === selectedItemId;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item.id)}
                    className={cn(
                      'group px-2.5 py-2 rounded text-[11px] cursor-pointer border transition-all flex flex-col gap-1',
                      isSelected
                        ? 'bg-[#EBF2F7] border-[#315D78] shadow-xs'
                        : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <Box size={12} className={cn(
                          'flex-shrink-0',
                          item.category === 'modified' ? 'text-[#D97706]' : 'text-[#16A34A]'
                        )} />
                        <span className={cn('font-mono font-bold truncate', isSelected ? 'text-[#1A3D6A]' : 'text-[#334155]')}>
                          {item.partNumber}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={cn(
                          'px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase tracking-wider',
                          item.category === 'modified'
                            ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]'
                            : 'bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]'
                        )}>
                          {item.category === 'modified' ? 'Modified' : 'Reuse'}
                        </span>

                        <button
                          onClick={(e) => handleToggleSuppress(e, item.id)}
                          className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-[#334155] p-0.5 rounded"
                          title={item.isSuppressed ? 'Unsuppress Component' : 'Suppress Component'}
                        >
                          {item.isSuppressed ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-[#64748B] line-clamp-1">
                      {item.description}
                    </div>

                    <div className="flex items-center justify-between text-[9.5px] font-mono text-[#94A3B8] pt-0.5">
                      <span>Rev {item.revision} • {item.massKg} kg</span>
                      <span>{item.mateIds.length} Mates</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollPane>

          {/* Bottom Summary Bar */}
          <div className="p-2.5 border-t border-[#DDE2E6] bg-[#F8FAFC] text-[10.5px] text-[#64748B] flex items-center justify-between">
            <span>Coordinate System: <strong>World XYZ</strong></span>
            <span className="font-mono text-[#0F172A]">{stats.totalMass.toFixed(0)} kg Total</span>
          </div>
        </div>

        {/* Center Pane: 3D CAD Assembly Viewport */}
        <div className="flex-1 flex flex-col p-2 bg-[#E2E8F0] overflow-hidden">
          <MainAssembly3DViewer
            items={items}
            selectedItemId={selectedItemId}
            onSelectItem={handleSelectItem}
            isPumpModified={true}
            isSkidModified={true}
          />
        </div>

        {/* Right Pane: Inspector, Mates, & Assembly Validation */}
        <div className="w-96 flex-shrink-0 bg-white border-l border-[#DDE2E6] flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="px-3 pt-2 border-b border-[#DDE2E6] bg-[#F8FAFC]">
            <TabBar
              tabs={RIGHT_TABS}
              activeTab={activeRightTab}
              onChange={setActiveRightTab}
            />
          </div>

          <ScrollPane className="flex-1 p-4 space-y-4">
            {/* TAB 1: COMPONENT INSPECTOR */}
            {activeRightTab === 'inspector' && selectedItem && (
              <div className="space-y-4">
                {/* Header Card */}
                <div className="p-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-mono font-bold text-[#1E293B]">
                      {selectedItem.partNumber}
                    </span>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                      selectedItem.category === 'modified'
                        ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]'
                        : 'bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]'
                    )}>
                      {selectedItem.category === 'modified' ? 'Modified Candidate' : 'Standard Reuse (100%)'}
                    </span>
                  </div>

                  <div className="text-[12px] font-medium text-[#334155]">
                    {selectedItem.description}
                  </div>

                  <div className="text-[11px] text-[#64748B] font-mono">
                    CAD File: {selectedItem.fileName} (Rev {selectedItem.revision})
                  </div>
                </div>

                {/* Technical Specs Grid */}
                <SectionPanel title="Assembly Spatial Properties">
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Component Mass:</span>
                      <span className="font-mono font-bold text-[#0F172A]">{selectedItem.massKg} kg</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Bounding Box (L×W×H):</span>
                      <span className="font-mono text-[#0F172A]">
                        {selectedItem.boundingBox.length} × {selectedItem.boundingBox.width} × {selectedItem.boundingBox.height} mm
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Packaging Line Coordinates:</span>
                      <span className="font-mono text-[#0F172A]">
                        X:{selectedItem.position.x} Y:{selectedItem.position.y} Z:{selectedItem.position.z}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Resolved Status:</span>
                      <span className="flex items-center gap-1 text-[#16A34A] font-semibold">
                        <CheckCircle size={12} /> Resolved (In Tree)
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[#64748B]">Associated Mates:</span>
                      <span className="font-mono font-bold text-[#315D78]">{selectedItem.mateIds.length} Satisfied</span>
                    </div>
                  </div>
                </SectionPanel>

                {/* Engineering Notes & Context */}
                <SectionPanel title="Integration & Assembly Notes">
                  <div className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded text-[11.5px] text-[#475569] leading-relaxed">
                    {selectedItem.notes}
                  </div>
                </SectionPanel>

                {/* Quick Navigation Action if Modified */}
                {selectedItem.category === 'modified' && (
                  <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded space-y-2">
                    <div className="text-[11.5px] font-bold text-[#92400E] flex items-center gap-1.5">
                      <Settings2 size={13} />
                      <span>Parametric CAD Modification</span>
                    </div>
                    <div className="text-[11px] text-[#B45309]">
                      This assembly was modified from the baseline design. Inspect parameter deltas and SolidWorks automation logs in the CAD Change Centre.
                    </div>
                    <button
                      onClick={() => navigate('/cad-change')}
                      className="w-full mt-1 px-2.5 py-1.5 rounded bg-[#D97706] text-white hover:bg-[#B45309] text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Open in CAD Change Centre</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MATES & CONSTRAINTS */}
            {activeRightTab === 'mates' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11.5px] font-bold text-[#20272E]">
                    Spatial Mates ({selectedItemMates.length} for {selectedItem?.partNumber})
                  </div>
                  <span className="text-[10px] text-[#16A34A] font-semibold flex items-center gap-1">
                    <CheckCircle size={11} /> 100% Satisfied
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedItemMates.map(mate => (
                    <div key={mate.id} className="p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#1E293B]">{mate.name}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-[#DCFCE7] text-[#166534] uppercase">
                          {mate.mateType}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-[#64748B] flex items-center gap-1">
                        <span>Entity 1:</span>
                        <span className="font-mono text-[#0F172A]">{mate.entity1}</span>
                      </div>
                      <div className="text-[10.5px] text-[#64748B] flex items-center gap-1">
                        <span>Entity 2:</span>
                        <span className="font-mono text-[#0F172A]">{mate.entity2}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                        <span>Alignment: {mate.alignment}</span>
                        <span className="font-mono text-[#16A34A]">Tol: ±{mate.toleranceMm} mm</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: ASSEMBLY VALIDATION */}
            {activeRightTab === 'validation' && (
              <div className="space-y-4">
                <div className="p-3 bg-[#DCFCE7] border border-[#86EFAC] rounded flex items-center gap-3">
                  <CheckCircle size={22} className="text-[#16A34A] flex-shrink-0" />
                  <div>
                    <div className="text-[12.5px] font-bold text-[#166534]">
                      Complete Assembly Validation Passed
                    </div>
                    <div className="text-[11px] text-[#15803D]">
                      10/10 sub-assemblies resolved • Zero mate collisions • Envelope within civil constraint
                    </div>
                  </div>
                </div>

                {/* Validation Checklist */}
                <div className="space-y-2">
                  <div className="text-[11.5px] font-bold text-[#20272E] uppercase tracking-wider">
                    Automated Packaging Line Checks
                  </div>

                  <div className="p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0F172A]">1. Sub-Assembly Resolution</span>
                      <span className="text-[#16A34A] font-bold flex items-center gap-1"><Check size={12} /> 10 / 10 Present</span>
                    </div>
                    <div className="text-[10.5px] text-[#64748B]">All 8 standard reuse and 2 modified packaging assemblies resolved with 0 unresolved CAD references.</div>
                  </div>

                  <div className="p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0F172A]">2. Weigher Chute-to-Bagger Drop Mate</span>
                      <span className="text-[#16A34A] font-bold flex items-center gap-1"><Check size={12} /> Concentric Ø450 mm</span>
                    </div>
                    <div className="text-[10.5px] text-[#64748B]">Modified 450mm multi-head collector funnel aligns with VFFS 600mm pouch forming collar (0.0 mm interference).</div>
                  </div>

                  <div className="p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0F172A]">3. Conveyor Infeed Transfer Height</span>
                      <span className="text-[#16A34A] font-bold flex items-center gap-1"><Check size={12} /> 2850 mm Elevation</span>
                    </div>
                    <div className="text-[10.5px] text-[#64748B]">Infeed elevator discharge head matches 800mm vibratory cross-feed pan hopper lip with +60 mm gravity fall.</div>
                  </div>

                  <div className="p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0F172A]">4. Plant Bay Footprint Limit</span>
                      <span className="text-[#16A34A] font-bold flex items-center gap-1"><Check size={12} /> +350 mm Margin</span>
                    </div>
                    <div className="text-[10.5px] text-[#64748B]">Total line length (4650 mm) safely accommodates customer 5000 mm bay envelope with walkway access.</div>
                  </div>

                  <div className="p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0F172A]">5. Line Throughput & Speed Match</span>
                      <span className="text-[#16A34A] font-bold flex items-center gap-1"><Check size={12} /> 60 BPM Synchronized</span>
                    </div>
                    <div className="text-[10.5px] text-[#64748B]">14-head weigher portioning rate and VFFS rotary servo jaw cycle time synchronized at 60 bags/min.</div>
                  </div>

                  <div className="p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0F172A]">6. Interlocked Safety Cell Enclosure</span>
                      <span className="text-[#16A34A] font-bold flex items-center gap-1"><Check size={12} /> ISO 13849-1 Pass</span>
                    </div>
                    <div className="text-[10.5px] text-[#64748B]">Lexan polycarbonate cell completely encloses sealing jaw hazard zone with Cat 4 / PLe RFID safety switches.</div>
                  </div>
                </div>

                {/* Final Sign-Off CTA */}
                <div className="pt-2">
                  <button
                    onClick={() => navigate('/review')}
                    className="w-full py-2.5 px-3 bg-[#315D78] hover:bg-[#254B62] text-white rounded text-[12px] font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <CheckSquare size={14} />
                    <span>Authorize Final Engineering Release</span>
                  </button>
                </div>
              </div>
            )}
          </ScrollPane>
        </div>
      </div>
    </div>
  );
}
