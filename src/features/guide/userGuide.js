const USER_GUIDE = `
Warehouse Optimizer – User Guide
What this tool does
This app reads a standard SAP bin export and produces a consolidation move list designed to free bins while respecting hard physical and business rules (paired tunnel capacity, no-mix, restricted types, R-bin segregation, etc.). It also includes a Putaway Finder to recommend a destination bin for incoming material.
1) File Requirements (SAP Export)
The upload must include these columns (header names must match):
- Storage Bin
- Material
- Material Description
- Available stock
- Storage Type
- Empty indicator (optional, supported)
How empties are determined:
A row is treated as empty if Available stock = 0 or Empty indicator = X.
2) Quick Start
1. Open the app.
2. Select the warehouse scope and rule toggles.
3. Click Load SAP and choose the export file.
4. Review the consolidation queue.
5. Execute moves on the floor in order.
6. Click a row to mark it done. Use Remaining/All and the search filter to stay organized.
7. If you change settings after loading, click Rebuild (no re-upload needed).
3) Scope Controls
Warehouse selector:
- WH1: bins that start with A–J and do not include "R"
- WH2: any bin containing "R" anywhere, plus bins starting with 2A
- WH3: bins starting with 3
- ALL: everything
Exclude bins with "R":
When enabled, any bin with R anywhere in the bin string is excluded from stock rows, empty-bin candidates, and targets/sources.
4) Consolidation Settings
ABC Threshold (PAL)
Phase 1 sources:
Only bins in rows A / B / C.
Any material quantity in a bin <= ABC Threshold becomes eligible to move out. Targets are never A/B/C rows.
Phase 2
When enabled, Phase 2 sources apply to all rows.
Any material quantity in a bin <= Phase 2 Threshold becomes eligible as a source. Targets are never A/B/C rows.
5) Storage Type Rules and Toggles
Hard rule: 111 is never used as a source.
Type 110 (source toggle): If Source 110 is unchecked, type 110 bins will not be used as sources.
Target 110 / 111: Controls whether those types can receive material.
6) Rules That Are Always Enforced
A) HARD NO-MIX (global)
- Non-empty targets only receive the same material already in the bin.
- Empty targets may receive any material (subject to type, scope, segregation, and capacity).
B) Never target A/B/C
Rows A, B, and C are never used as consolidation targets. They are kept clear for production line putaway.
C) Side bins are never used as targets
Side bin positions can be sourced from but never receive material during consolidation.
D) Empty bin net-positive rule
Empty bins are only consumed when 2 or more single-material source bins can be combined into one, netting freed bins.
E) R-bin segregation
R-bins and non-R bins never share the same material during consolidation or putaway.
7) Capacity Engine (How "Free Space" is Calculated)
Capacity is dynamic. Many rows are paired as shared tunnels, so space depends on occupancy across the pair.
Standalone rows:
- A: 43 standard, 16 side bins
- J: 19
Paired tunnels:
- B <-> C, D <-> E: shared tunnel behavior
- F <-> G: shared tunnel behavior
- I <-> II: shared tunnel behavior (asymmetric max per side)
- H <-> HH: special behavior
8) Putaway Finder
Use this for inbound receiving. Enter a material number (or a partial match), optional PAL requirement, and run Search Optimal Bin.
The result prioritizes existing bins with the same material (no-mix), then empty bins that match the segregation and type rules.
`.trim();

export default USER_GUIDE;
