import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Box, Layers, FileText, ChevronRight, ChevronDown,
  ArrowRightLeft, Package, Settings, Info, Filter, RefreshCw
} from 'lucide-react';
import { useStore, useAllFiles, useActiveEnquiry } from '../store/appStore';
import { runComparison } from '../services/comparisonService';
import type { EngineeringFile, Assembly, FileType, LifecycleState } from '../types/engineering';
import {
  StatusBadge, SectionPanel, InfoRow, EmptyState, TabBar,
  cn, formatDate, ScrollPane, DataPair
} from '../components/shared';

const FILE_TYPE_COLORS: Record<string, string> = {
  SLDPRT: 'bg-[#EBF2F7] text-[#315D78]',
  SLDASM: 'bg-[#E8EDF5] text-[#1A3D6A]',
  SLDDRW: 'bg-[#EBF5EF] text-[#2D7A4F]',
  other: 'bg-[#F4F5F6] text-[#68737D]',
};

const FILE_TYPE_ICONS = {
  SLDPRT: <Box size={14} />,
  SLDASM: <Layers size={14} />,
  SLDDRW: <FileText size={14} />,
};

const INSPECTOR_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'properties', label: 'Properties' },
  { id: 'geometry', label: 'Geometry' },
  { id: 'features', label: 'Feature Tree' },
  { id: 'configs', label: 'Configurations' },
  { id: 'assembly', label: 'Assembly' },
  { id: 'drawings', label: 'Drawings' },
  { id: 'revisions', label: 'Revisions' },
];

type ViewMode = 'list' | 'tree';

export default function EngineeringLibrary() {
  const navigate = useNavigate();
  const { state, dispatch } = useStore();
  const allFiles = useAllFiles();
  const enquiry = useActiveEnquiry();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [materialFilter, setMaterialFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [inspectorTab, setInspectorTab] = useState('overview');
  const [expandedAssemblies, setExpandedAssemblies] = useState<Set<string>>(new Set());

  const selectedFileId = state.selectedFileId;
  const selectedFile = allFiles.find(f => f.id === selectedFileId);

  const filtered = useMemo(() => {
    return allFiles.filter(f => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        f.fileName.toLowerCase().includes(q) ||
        (f.partNumber ?? '').toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q);
      const matchType = typeFilter === 'all' || f.fileType === typeFilter;
      const matchState = stateFilter === 'all' || f.lifecycleState === stateFilter;
      const matchMat = !materialFilter || (f.material ?? '').toLowerCase().includes(materialFilter.toLowerCase());
      return matchSearch && matchType && matchState && matchMat;
    });
  }, [allFiles, search, typeFilter, stateFilter, materialFilter]);

  function handleSelect(fileId: string) {
    dispatch({ type: 'SET_SELECTED_FILE', id: fileId });
    setInspectorTab('overview');
  }

  function handleCompare() {
    if (!selectedFileId || !enquiry) return;
    dispatch({ type: 'SET_CANDIDATE', enquiryId: enquiry.id, fileId: selectedFileId });
    const candidateFile = allFiles.find(f => f.id === selectedFileId);
    if (candidateFile) {
      const cmpResult = runComparison(enquiry, candidateFile);
      dispatch({ type: 'UPSERT_COMPARISON', result: cmpResult });
    }
    navigate('/compare');
  }

  function toggleAssembly(id: string) {
    setExpandedAssemblies(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setSearch(''); setTypeFilter('all'); setStateFilter('all'); setMaterialFilter('');
  }

  const assemblies = state.assemblies as Assembly[];

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#F4F5F6' }}>
      {/* Left Filter Pane */}
      <div className="w-52 flex-shrink-0 bg-white border-r border-[#DDE2E6] flex flex-col overflow-hidden">
        <div className="p-3 border-b border-[#DDE2E6]">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9AAAB5]" />
            <input
              className="eng-input pl-8 text-[12px]"
              placeholder="Search files…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}><X size={12} className="text-[#9AAAB5]" /></button>}
          </div>
        </div>

        <ScrollPane className="flex-1 p-3 space-y-4">
          <div>
            <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1.5">File Type</label>
            <div className="space-y-0.5">
              {[['all', 'All Types'], ['SLDPRT', 'Parts (.SLDPRT)'], ['SLDASM', 'Assemblies (.SLDASM)'], ['SLDDRW', 'Drawings (.SLDDRW)']].map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 py-1 cursor-pointer">
                  <input type="radio" name="typeFilter" checked={typeFilter === v} onChange={() => setTypeFilter(v)} className="accent-[#315D78]" />
                  <span className="text-[12px] text-[#20272E]">{l}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1.5">Lifecycle State</label>
            <select className="eng-select w-full text-[12px]" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
              <option value="all">All States</option>
              <option value="released">Released</option>
              <option value="in_review">In Review</option>
              <option value="draft">Draft</option>
              <option value="obsolete">Obsolete</option>
            </select>
          </div>

          <div>
            <label className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide block mb-1.5">Material</label>
            <input
              className="eng-input text-[12px]"
              placeholder="Filter by material…"
              value={materialFilter}
              onChange={e => setMaterialFilter(e.target.value)}
            />
          </div>

          <div className="pt-2 border-t border-[#EEF1F4]">
            <p className="text-[11px] text-[#68737D]"><strong>{filtered.length}</strong> file{filtered.length !== 1 ? 's' : ''} found</p>
            <button className="btn-ghost p-0 mt-1 text-[11px]" onClick={clearFilters}><RefreshCw size={11} /> Clear filters</button>
          </div>
        </ScrollPane>
      </div>

      {/* Centre Pane */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-[#DDE2E6] px-3 py-2 flex items-center gap-3 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-white bg-[#315D78] px-2 py-0.5 rounded-sm">
              2. Engineering Library
            </span>
            <div className="flex rounded border border-[#DDE2E6] overflow-hidden">
              {(['list', 'tree'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn('px-3 py-1 text-[11.5px] font-medium flex items-center gap-1.5',
                    viewMode === mode ? 'bg-[#315D78] text-white' : 'bg-white text-[#68737D] hover:bg-[#F4F5F6]')}
                >
                  {mode === 'list' ? <><Filter size={11} /> List</> : <><Layers size={11} /> Assembly Tree</>}
                </button>
              ))}
            </div>
            <span className="text-[12px] text-[#68737D]">{filtered.length} files</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button className="btn-secondary text-[11.5px]" onClick={() => navigate('/enquiries')}>
              ← 1. Requirements Brief
            </button>
            {selectedFileId && (
              <button className="btn-secondary text-[11.5px]" onClick={handleCompare} disabled={!enquiry}>
                <ArrowRightLeft size={12} /> Compare Selected
              </button>
            )}
            <button className="btn-primary text-[11.5px]" onClick={() => navigate('/compare')}>
              Proceed to 3. Reuse & Comparison →
            </button>
          </div>
        </div>

        {/* File List */}
        <ScrollPane className="flex-1">
          {viewMode === 'list' ? (
            <table className="eng-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Part Number</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Rev</th>
                  <th>State</th>
                  <th>Material</th>
                  <th>Modified</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-10 text-center text-[#9AAAB5] text-[12px]">No files match the current filters.</td></tr>
                )}
                {filtered.map(file => (
                  <tr
                    key={file.id}
                    className={cn('cursor-pointer', selectedFileId === file.id ? 'selected' : '')}
                    onClick={() => handleSelect(file.id)}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={cn('p-1 rounded', FILE_TYPE_COLORS[file.fileType] ?? FILE_TYPE_COLORS.other)}>
                          {FILE_TYPE_ICONS[file.fileType as keyof typeof FILE_TYPE_ICONS] ?? <FileText size={14} />}
                        </span>
                        <span className="font-medium text-[12.5px] max-w-[160px] truncate">{file.fileName}</span>
                      </div>
                    </td>
                    <td className="font-mono text-[11.5px] text-[#315D78]">{file.partNumber ?? '—'}</td>
                    <td className="text-[12px] text-[#68737D] max-w-[180px] truncate">{file.description}</td>
                    <td>
                      <span className={cn('text-[10.5px] font-semibold px-1.5 py-0.5 rounded-sm', FILE_TYPE_COLORS[file.fileType] ?? FILE_TYPE_COLORS.other)}>
                        {file.fileType}
                      </span>
                    </td>
                    <td className="font-mono text-[12px]">{file.revision}</td>
                    <td><StatusBadge status={file.lifecycleState} /></td>
                    <td className="text-[12px] text-[#68737D]">{file.material ?? '—'}</td>
                    <td className="text-[11.5px] text-[#9AAAB5]">{formatDate(file.lastModified)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* Assembly Tree View */
            <div className="p-3 space-y-1">
              {assemblies.filter(a => filtered.some(f => f.id === a.id)).map(asm => (
                <div key={asm.id} className="eng-panel">
                  <div
                    className={cn('flex items-center gap-2 p-2.5 cursor-pointer hover:bg-[#F8FAFB]', selectedFileId === asm.id ? 'bg-[#EBF2F7]' : '')}
                    onClick={() => { handleSelect(asm.id); toggleAssembly(asm.id); }}
                  >
                    {expandedAssemblies.has(asm.id) ? <ChevronDown size={13} className="text-[#315D78]" /> : <ChevronRight size={13} className="text-[#315D78]" />}
                    <Layers size={14} className="text-[#1A3D6A] flex-shrink-0" />
                    <span className="font-medium text-[12.5px] flex-1">{asm.fileName}</span>
                    <span className="font-mono text-[11px] text-[#315D78]">{asm.partNumber}</span>
                    <StatusBadge status={asm.lifecycleState} />
                  </div>
                  {expandedAssemblies.has(asm.id) && (
                    <div className="border-t border-[#EEF1F4]">
                      {asm.components.map(comp => {
                        const compFile = allFiles.find(f => f.id === comp.fileId);
                        return (
                          <div
                            key={comp.id}
                            className={cn('flex items-center gap-2 px-6 py-2 cursor-pointer hover:bg-[#F8FAFB] border-b border-[#EEF1F4] last:border-0', selectedFileId === comp.fileId ? 'bg-[#EBF2F7]' : '')}
                            onClick={() => compFile && handleSelect(compFile.id)}
                          >
                            <Box size={12} className="text-[#315D78] flex-shrink-0" />
                            <span className="text-[12px] flex-1">{comp.description}</span>
                            <span className="font-mono text-[11px] text-[#9AAAB5]">{comp.partNumber}</span>
                            <span className="text-[11px] text-[#68737D]">Qty: {comp.quantity}</span>
                            {!comp.isResolved && <span className="text-[10.5px] text-[#B42318] bg-[#FEF0EE] px-1.5 py-0.5 rounded-sm">Unresolved</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {/* Non-assembly files */}
              {filtered.filter(f => f.fileType !== 'SLDASM').map(file => (
                <div
                  key={file.id}
                  className={cn('eng-panel flex items-center gap-2 p-2.5 cursor-pointer hover:bg-[#F8FAFB]', selectedFileId === file.id ? 'bg-[#EBF2F7]' : '')}
                  onClick={() => handleSelect(file.id)}
                >
                  <span className="w-4" />
                  <Box size={13} className="text-[#315D78] flex-shrink-0" />
                  <span className="text-[12.5px] font-medium flex-1">{file.fileName}</span>
                  <span className="font-mono text-[11px] text-[#315D78]">{file.partNumber ?? '—'}</span>
                  <StatusBadge status={file.lifecycleState} />
                </div>
              ))}
            </div>
          )}
        </ScrollPane>
      </div>

      {/* Right Inspector Pane */}
      <div className="w-80 flex-shrink-0 border-l border-[#DDE2E6] bg-white flex flex-col overflow-hidden">
        {!selectedFile ? (
          <EmptyState
            icon={<Info size={28} />}
            title="Select a file to inspect"
            description="Click any file in the list to view its engineering metadata."
          />
        ) : (
          <>
            {/* Inspector Header */}
            <div className="px-3 py-3 border-b border-[#DDE2E6] flex-shrink-0 bg-[#F8FAFB]">
              <div className="flex items-start gap-2">
                <span className={cn('p-1.5 rounded flex-shrink-0', FILE_TYPE_COLORS[selectedFile.fileType] ?? FILE_TYPE_COLORS.other)}>
                  {FILE_TYPE_ICONS[selectedFile.fileType as keyof typeof FILE_TYPE_ICONS] ?? <FileText size={15} />}
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-[#20272E] break-words leading-snug">{selectedFile.fileName}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <StatusBadge status={selectedFile.lifecycleState} />
                    <span className="text-[11px] text-[#68737D]">Rev {selectedFile.revision}</span>
                  </div>
                </div>
              </div>
              <button className="btn-primary w-full mt-2.5" onClick={handleCompare} disabled={!enquiry}>
                <ArrowRightLeft size={12} /> Compare with Enquiry
              </button>
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 overflow-x-auto border-b border-[#DDE2E6]">
              <div className="flex">
                {INSPECTOR_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setInspectorTab(tab.id)}
                    className={cn(
                      'px-3 py-2 text-[11.5px] font-medium border-b-2 -mb-px whitespace-nowrap',
                      inspectorTab === tab.id ? 'border-[#315D78] text-[#315D78]' : 'border-transparent text-[#68737D] hover:text-[#20272E]'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <ScrollPane className="flex-1 p-3">
              {inspectorTab === 'overview' && (
                <div className="space-y-1">
                  <InfoRow label="File Name" value={selectedFile.fileName} mono />
                  <InfoRow label="File Type" value={selectedFile.fileType} />
                  <InfoRow label="Part Number" value={selectedFile.partNumber} mono />
                  <InfoRow label="Revision" value={selectedFile.revision} />
                  <InfoRow label="Version" value={selectedFile.version} />
                  <InfoRow label="Lifecycle" value={<StatusBadge status={selectedFile.lifecycleState} />} />
                  <InfoRow label="Active Config" value={selectedFile.activeConfiguration} />
                  <InfoRow label="Source" value={selectedFile.sourceSystem} />
                  <InfoRow label="Last Modified" value={formatDate(selectedFile.lastModified)} />
                  <InfoRow label="Imported" value={formatDate(selectedFile.importedAt)} />
                  <InfoRow label="Import Status" value={<StatusBadge status={selectedFile.importStatus} />} />
                  {selectedFile.missingFields.length > 0 && (
                    <div className="mt-2 p-2 bg-[#FEF8E6] border border-[#F5D78A] rounded-sm">
                      <p className="text-[11px] font-semibold text-[#9A6A00] mb-1">Missing metadata fields:</p>
                      <p className="text-[11px] text-[#9A6A00]">{selectedFile.missingFields.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}

              {inspectorTab === 'properties' && (
                <div className="space-y-1">
                  <p className="text-[10.5px] text-[#9AAAB5] italic mb-2">Imported metadata — verify against source file.</p>
                  <InfoRow label="Description" value={selectedFile.description} />
                  <InfoRow label="Material" value={selectedFile.material} missing={!selectedFile.material} />
                  <InfoRow label="Density" value={selectedFile.density !== undefined ? `${selectedFile.density} kg/m³` : undefined} missing={selectedFile.density === undefined} />
                  <InfoRow label="Mass" value={selectedFile.mass !== undefined ? `${selectedFile.mass} kg` : undefined} missing={selectedFile.mass === undefined} />
                  <InfoRow label="Volume" value={selectedFile.volume !== undefined ? `${selectedFile.volume.toFixed(6)} m³` : undefined} missing={selectedFile.volume === undefined} />
                  <InfoRow label="Units" value={selectedFile.units} />
                  {Object.entries(selectedFile.customProperties).length > 0 && (
                    <>
                      <div className="pt-2 mt-2 border-t border-[#EEF1F4]">
                        <p className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide mb-2">Custom Properties</p>
                        <table className="eng-table text-[11.5px]">
                          <tbody>
                            {Object.entries(selectedFile.customProperties).map(([k, v]) => (
                              <tr key={k}>
                                <td className="text-[#68737D] w-1/2">{k}</td>
                                <td className="font-medium">{String(v)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {inspectorTab === 'geometry' && (
                <div className="space-y-3">
                  <p className="text-[10.5px] text-[#9AAAB5] italic">Imported metadata — not verified against native CAD geometry.</p>
                  {selectedFile.boundingBox && (
                    <div className="bg-[#F8FAFB] border border-[#DDE2E6] rounded p-3">
                      <p className="text-[10.5px] font-semibold text-[#68737D] uppercase tracking-wide mb-2">Bounding Box</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[['L', selectedFile.boundingBox.length], ['W', selectedFile.boundingBox.width], ['H', selectedFile.boundingBox.height]].map(([label, val]) => (
                          <div key={String(label)} className="text-center">
                            <p className="text-[11px] text-[#68737D]">{label}</p>
                            <p className="text-[13px] font-bold text-[#20272E]">{val}</p>
                            <p className="text-[10px] text-[#9AAAB5]">{selectedFile.boundingBox!.unit}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedFile.dimensions.length > 0 && (
                    <table className="eng-table">
                      <thead><tr><th>Parameter</th><th>Feature</th><th>Value</th><th>Unit</th><th>Edit</th></tr></thead>
                      <tbody>
                        {selectedFile.dimensions.map(d => (
                          <tr key={d.id}>
                            <td className="font-mono text-[11.5px]">{d.name}</td>
                            <td className="text-[11px] text-[#68737D]">{d.feature ?? '—'}</td>
                            <td className="font-bold">{d.value}</td>
                            <td className="text-[#68737D]">{d.unit || '—'}</td>
                            <td>{d.editable ? <span className="text-[10.5px] text-[#2D7A4F] bg-[#EBF5EF] px-1.5 py-0.5 rounded-sm">Yes</span> : <span className="text-[10.5px] text-[#9AAAB5]">No</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {selectedFile.dimensions.length === 0 && !selectedFile.boundingBox && (
                    <p className="text-[12px] text-[#9AAAB5] italic">No geometry metadata available.</p>
                  )}
                </div>
              )}

              {inspectorTab === 'features' && (
                <div className="space-y-2">
                  <p className="text-[10.5px] text-[#9AAAB5] italic">Sample or imported metadata — not a live SOLIDWORKS feature tree.</p>
                  {selectedFile.features.length === 0 && <p className="text-[12px] text-[#9AAAB5]">No feature data available.</p>}
                  {selectedFile.features.map(feat => (
                    <div key={feat.id} className="border border-[#DDE2E6] rounded p-2">
                      <div className="flex items-center gap-2">
                        <Settings size={12} className="text-[#315D78] flex-shrink-0" />
                        <span className="text-[12.5px] font-medium flex-1">{feat.name}</span>
                        <span className="text-[10.5px] text-[#68737D] bg-[#F4F5F6] px-1.5 py-0.5 rounded">{feat.type}</span>
                        {feat.suppressed && <span className="text-[10.5px] text-[#9A6A00] bg-[#FEF8E6] px-1.5 py-0.5 rounded">Suppressed</span>}
                        {feat.failed && <span className="text-[10.5px] text-[#B42318] bg-[#FEF0EE] px-1.5 py-0.5 rounded">Failed</span>}
                      </div>
                      {feat.parameters && feat.parameters.length > 0 && (
                        <div className="mt-1.5 ml-5 space-y-0.5">
                          {feat.parameters.map(p => (
                            <div key={p.id} className="flex items-center gap-2 text-[11.5px]">
                              <span className="font-mono text-[#315D78] w-28 truncate">{p.name}</span>
                              <span className="font-bold">{p.value}</span>
                              <span className="text-[#68737D]">{p.unit}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {inspectorTab === 'configs' && (
                <div className="space-y-2">
                  {selectedFile.configurations.map(cfg => (
                    <div key={cfg.id} className={cn('eng-panel border', cfg.isActive ? 'border-[#315D78]' : '')}>
                      <div className={cn('eng-panel-header', cfg.isActive ? 'bg-[#EBF2F7]' : '')}>
                        <Package size={12} className={cfg.isActive ? 'text-[#315D78]' : 'text-[#68737D]'} />
                        <span className={cn('eng-panel-title flex-1', cfg.isActive ? 'text-[#315D78]' : '')}>{cfg.name}</span>
                        {cfg.isActive && <span className="text-[10.5px] text-[#315D78] font-semibold">Active</span>}
                      </div>
                      {cfg.description && <p className="px-3 py-1.5 text-[11.5px] text-[#68737D]">{cfg.description}</p>}
                      {Object.entries(cfg.properties).length > 0 && (
                        <table className="eng-table text-[11.5px]">
                          <tbody>
                            {Object.entries(cfg.properties).map(([k, v]) => (
                              <tr key={k}><td className="text-[#68737D]">{k}</td><td className="font-medium">{String(v)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                  {selectedFile.configurations.length === 0 && <p className="text-[12px] text-[#9AAAB5] italic">No configuration data available.</p>}
                </div>
              )}

              {inspectorTab === 'assembly' && (
                <div className="space-y-2">
                  {selectedFile.fileType !== 'SLDASM' && (
                    <p className="text-[12px] text-[#9AAAB5] italic">Assembly data is only available for .SLDASM files.</p>
                  )}
                  {selectedFile.fileType === 'SLDASM' && (() => {
                    const asm = assemblies.find(a => a.id === selectedFile.id);
                    if (!asm) return <p className="text-[12px] text-[#9AAAB5]">Assembly data not loaded.</p>;
                    return (
                      <>
                        {asm.unresolvedRefs.length > 0 && (
                          <div className="p-2 bg-[#FEF0EE] border border-[#F4A9A4] rounded text-[11.5px] text-[#B42318]">
                            Unresolved references: {asm.unresolvedRefs.join(', ')}
                          </div>
                        )}
                        <table className="eng-table">
                          <thead><tr><th>Part No.</th><th>Description</th><th>Qty</th><th>Config</th><th>Fixed</th><th>Resolved</th></tr></thead>
                          <tbody>
                            {asm.components.map(comp => (
                              <tr key={comp.id}>
                                <td className="font-mono text-[11.5px] text-[#315D78]">{comp.partNumber ?? comp.fileId}</td>
                                <td className="text-[11.5px]">{comp.description ?? '—'}</td>
                                <td className="font-bold">{comp.quantity}</td>
                                <td className="text-[11px] text-[#68737D]">{comp.configuration ?? '—'}</td>
                                <td>{comp.isFixed ? '✓' : '—'}</td>
                                <td>{comp.isResolved ? <span className="text-[#2D7A4F]">✓</span> : <span className="text-[#B42318]">✗</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    );
                  })()}
                </div>
              )}

              {inspectorTab === 'drawings' && (
                <div>
                  {selectedFile.drawings.length === 0 ? (
                    <p className="text-[12px] text-[#9AAAB5] italic py-4">No drawing references recorded.</p>
                  ) : (
                    <table className="eng-table">
                      <thead><tr><th>Drawing No.</th><th>File</th><th>Rev</th><th>Sheets</th><th>Status</th></tr></thead>
                      <tbody>
                        {selectedFile.drawings.map(drw => (
                          <tr key={drw.id}>
                            <td className="font-mono text-[11.5px] text-[#315D78]">{drw.drawingNumber}</td>
                            <td className="text-[11.5px] max-w-[120px] truncate">{drw.fileName}</td>
                            <td className="font-mono">{drw.revision}</td>
                            <td>{drw.sheetCount}</td>
                            <td><StatusBadge status={drw.reviewStatus} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {inspectorTab === 'revisions' && (
                <div>
                  {selectedFile.revisions.length === 0 ? (
                    <p className="text-[12px] text-[#9AAAB5] italic py-4">No revision history available.</p>
                  ) : (
                    <table className="eng-table">
                      <thead><tr><th>Rev</th><th>Description</th><th>Author</th><th>Date</th><th>State</th></tr></thead>
                      <tbody>
                        {selectedFile.revisions.map(rev => (
                          <tr key={rev.id}>
                            <td className="font-mono font-bold">{rev.revisionCode}</td>
                            <td className="text-[11.5px] max-w-[140px]">{rev.description ?? '—'}</td>
                            <td className="text-[11.5px] text-[#68737D]">{rev.author}</td>
                            <td className="text-[11px] text-[#9AAAB5]">{formatDate(rev.timestamp)}</td>
                            <td><StatusBadge status={rev.lifecycleState} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </ScrollPane>
          </>
        )}
      </div>
    </div>
  );
}
