import { useState, useMemo } from 'react';
import {
  History, Search, Filter, Download, User,
  FileText, Clock, ChevronRight, Activity, X
} from 'lucide-react';
import { useStore } from '../store/appStore';
import type { AuditEvent } from '../types/engineering';
import {
  StatusBadge, InfoRow, EmptyState, cn, formatDateTime,
  ScrollPane, DataPair
} from '../components/shared';

export default function ActivityHistory() {
  const { state } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('all');
  const [selectedActor, setSelectedActor] = useState('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const events = state.auditEvents;

  // Extract unique actors and entity types
  const actors = useMemo(() => {
    return Array.from(new Set(events.map(e => e.actor))).filter(Boolean);
  }, [events]);

  const entityTypes = useMemo(() => {
    return Array.from(new Set(events.map(e => e.entityType))).filter(Boolean);
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !q ||
        e.action.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.entityId.toLowerCase().includes(q);

      const matchEntity = selectedEntityType === 'all' || e.entityType === selectedEntityType;
      const matchActor = selectedActor === 'all' || e.actor === selectedActor;

      return matchSearch && matchEntity && matchActor;
    });
  }, [events, searchTerm, selectedEntityType, selectedActor]);

  const selectedEvent = events.find(e => e.id === selectedEventId) || filteredEvents[0];

  // Export audit log as CSV
  const handleExportAuditCSV = () => {
    const headers = ['Event ID', 'Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity ID', 'Detail', 'Enquiry ID'];
    const rows = filteredEvents.map(e => [
      e.id,
      e.timestamp,
      e.actor,
      e.action,
      e.entityType,
      e.entityId,
      e.detail,
      e.enquiryId || ''
    ]);

    const csvContent = [
      `# VOLM Engineering Intelligence — Activity Audit Trail`,
      `# Generated: ${new Date().toISOString()}`,
      `# User: ${state.currentUser}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Activity_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#F4F5F6' }}>
      {/* Top Header */}
      <div className="bg-white border-b border-[#DDE2E6] px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <History size={16} className="text-[#315D78]" />
            <h1 className="text-[14px] font-semibold text-[#20272E]">
              Traceability & Activity Audit Trail
            </h1>
            <span className="text-[11.5px] text-[#68737D] bg-[#F4F5F6] px-2 py-0.5 rounded border border-[#DDE2E6]">
              {filteredEvents.length} events logged
            </span>
          </div>

          <button
            className="btn-secondary"
            onClick={handleExportAuditCSV}
          >
            <Download size={13} /> Export Audit Log (.CSV)
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border-b border-[#DDE2E6] px-5 py-2.5 flex items-center gap-3 flex-shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9AAAB5]" />
          <input
            className="eng-input pl-8 text-[12px]"
            placeholder="Search action, actor, or entity..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9AAAB5] hover:text-[#20272E]"
              onClick={() => setSearchTerm('')}
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-[#68737D] font-medium">Entity:</span>
          <select
            className="eng-select text-[12px]"
            value={selectedEntityType}
            onChange={e => setSelectedEntityType(e.target.value)}
          >
            <option value="all">All Entities</option>
            {entityTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-[#68737D] font-medium">Actor:</span>
          <select
            className="eng-select text-[12px]"
            value={selectedActor}
            onChange={e => setSelectedActor(e.target.value)}
          >
            <option value="all">All Actors</option>
            {actors.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {(searchTerm || selectedEntityType !== 'all' || selectedActor !== 'all') && (
          <button
            className="btn-ghost text-[11.5px]"
            onClick={() => { setSearchTerm(''); setSelectedEntityType('all'); setSelectedActor('all'); }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Main 2-Pane Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Events Table (Left 65%) */}
        <div className="flex-1 bg-white border-r border-[#DDE2E6] flex flex-col overflow-hidden">
          <ScrollPane className="flex-1">
            <table className="eng-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Entity Reference</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#9AAAB5] text-[12px]">
                      No audit events match current criteria.
                    </td>
                  </tr>
                )}
                {filteredEvents.map(evt => {
                  const isSel = selectedEvent?.id === evt.id;
                  return (
                    <tr
                      key={evt.id}
                      onClick={() => setSelectedEventId(evt.id)}
                      className={cn('cursor-pointer', isSel ? 'selected' : '')}
                    >
                      <td className="font-mono text-[11px] text-[#68737D] whitespace-nowrap">
                        {formatDateTime(evt.timestamp)}
                      </td>
                      <td className="font-medium text-[#20272E]">
                        <span className="inline-flex items-center gap-1.5">
                          <User size={12} className="text-[#315D78]" />
                          {evt.actor}
                        </span>
                      </td>
                      <td className="font-semibold text-[#20272E]">
                        {evt.action}
                      </td>
                      <td>
                        <span className="font-mono text-[10.5px] bg-[#F4F5F6] text-[#68737D] px-1.5 py-0.5 rounded border border-[#DDE2E6]">
                          {evt.entityType}
                        </span>
                      </td>
                      <td className="font-mono text-[11px] text-[#315D78] max-w-[120px] truncate">
                        {evt.entityId}
                      </td>
                      <td className="text-[12px] text-[#68737D] max-w-sm truncate" title={evt.detail}>
                        {evt.detail}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollPane>
        </div>

        {/* Right Detail Pane (35%) */}
        <div className="w-80 flex-shrink-0 bg-white flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[#DDE2E6] bg-[#F8FAFB]">
            <span className="eng-panel-title flex items-center gap-1.5">
              <Activity size={13} className="text-[#315D78]" />
              Event Dossier
            </span>
          </div>

          {selectedEvent ? (
            <ScrollPane className="flex-1 p-4 space-y-3">
              <div className="space-y-1">
                <InfoRow label="Event ID" value={selectedEvent.id} mono />
                <InfoRow label="Timestamp" value={formatDateTime(selectedEvent.timestamp)} />
                <InfoRow label="Actor" value={selectedEvent.actor} />
                <InfoRow label="Action" value={selectedEvent.action} />
                <InfoRow label="Entity Type" value={selectedEvent.entityType} />
                <InfoRow label="Entity ID" value={selectedEvent.entityId} mono />
                {selectedEvent.enquiryId && (
                  <InfoRow label="Enquiry ID" value={selectedEvent.enquiryId} mono />
                )}
              </div>

              <div className="pt-3 border-t border-[#EEF1F4]">
                <strong className="text-[10.5px] font-semibold text-[#68737D] uppercase block mb-1">
                  Event Technical Details
                </strong>
                <div className="p-3 bg-[#F8FAFB] border border-[#DDE2E6] rounded font-mono text-[11.5px] text-[#20272E] whitespace-pre-wrap leading-relaxed">
                  {selectedEvent.detail}
                </div>
              </div>

              <div className="p-3 bg-[#EBF2F7] border border-[#B8D5E5] text-[#1A3D52] rounded text-[11.5px]">
                <strong>Traceability Guarantee:</strong> Every requirement, engineering calculation, CAD execution, and reviewer decision produces an immutable audit record for compliance and quality control.
              </div>
            </ScrollPane>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-[#9AAAB5] text-[12px]">
              Select an audit event from the table to inspect details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
