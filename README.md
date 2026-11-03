# VOLM Engineering Intelligence

**Demonstration workspace — sample engineering data.**

A polished, interactive React engineering intelligence application demonstrating a connected workflow from customer enquiry to BOM validation for VOLM Companies, Inc.

> **Illustrative sample engineering data — not VOLM source data.** All simulated CAD operations are clearly labelled. No native SOLIDWORKS files are modified by this application.

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Validation | Zod |
| Icons | Lucide React |
| State | React useReducer + Context |
| Persistence | In-memory (session) |
| Exports | Browser Blob API |

---

## Application Screens

| Screen | Path | Purpose |
|--------|------|---------|
| Enquiry Workspace | `/enquiries` | Create and manage engineering briefs with structured requirements |
| Engineering Library | `/library` | Search and inspect SOLIDWORKS parts, assemblies and drawings |
| Compare & Plan | `/compare` | Compare candidate designs to requirements; propose changes |
| CAD Change Centre | `/cad-change` | Execute and verify CAD operations through the adapter architecture |
| Review & Release | `/review` | Validate engineering outputs; generate and export BOM |
| Activity History | `/history` | Complete audit trail of all engineering actions |

---

## CAD Adapter Architecture

| Adapter | Status | Notes |
|---------|--------|-------|
| **Mock CAD Adapter** | ✅ Active (demo mode) | Simulated operations — no native files modified |
| SOLIDWORKS Native API | ❌ Not implemented | Requires Windows connector |
| CADABRA | ❌ Not implemented | Integration boundary defined |
| Autodesk Forge | ❌ Not implemented | Requires API authorisation |

---

## Data Model

All entities are typed in `src/types/engineering.ts`. The sample dataset is in `src/data/sampleData.ts`.

### Key Entities
- `Enquiry` → `Requirement[]`
- `EngineeringFile` → `Configuration[]` + `Feature[]` + `DimensionParameter[]` + `DrawingReference[]`
- `Assembly` extends `EngineeringFile` → `AssemblyComponent[]`
- `ProposedChange` → `ChangeDependency[]`
- `CADExecution` → `ExecutionLogEntry[]` + `ValidationResult`
- `EngineeringReview` → `ValidationCheck[]` + `DrawingReview[]`
- `BOM` → `BOMItem[]` + `BOMValidationError[]`

---

## Disclaimer

This application contains **illustrative sample engineering data only**. It is not VOLM source data. All CAD operations shown are simulated by the Mock CAD Adapter. No SOLIDWORKS files are read or written by this application. No integration with CADABRA, Forge, or any ERP system is active.

The application demonstrates an engineering workflow architecture suitable for future integration with live CAD and PLM systems.
