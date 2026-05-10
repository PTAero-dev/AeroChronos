# AeroChronos - AI Handover Document

## Project Overview
**AeroChronos** is a web-based Flight Logbook and Flight Duty Period (FDP) tracking application for pilots. It calculates block and flight times, monitors cumulative flight hours against CAAT (Civil Aviation Authority of Thailand) limits, and helps pilots track their Instrument Flight Procedures (IFP) and NAVAID experience.

## Tech Stack
- **Framework:** React + Vite
- **Language:** TypeScript (`.tsx`, `.ts`)
- **Styling:** Vanilla CSS (no external libraries like Tailwind or Bootstrap)
- **Data Persistence:** Currently relies on JSON export/import (localStorage logic may exist, but export/import is the primary backup method).
- **Directory:** `d:/Antigravity.Projects/AeroChronos`

## Core Application Structure
- `src/App.tsx`: The main container managing state (`logbookData`, `profile`) and tab navigation (`mission`, `duty`, `logbook`, `fltck`, `profile`).
- `src/types.ts`: Defines core interfaces (`LogbookData`, `Leg`, `LogbookEntry`, `IfpRecord`, `NavaidRecord`, etc.).
- `src/components/`: Contains UI components:
  - `MissionDashboard.tsx`: Data entry for daily flights (Legs, Crew, Date, Aircraft).
  - `FDPView.tsx`: Calculates and displays Flight Duty Period limits and violations.
  - `LogbookView.tsx`: Displays the cumulative hours monitor and historical entries.
  - `StatisticsCard.tsx`: Queries flight data by date range and exports CSV.
  - `ProfileView.tsx`: Manages pilot initials, base hours, and full app data export/import.
  - `FIVPView.tsx` / `IFPTracking.tsx`: Manages Instrument Flight Procedure and NAVAID experience.
- `src/utils/`: Contains calculation logic:
  - `calculations.ts`: Time math (HHMM string to minutes, strict block/flight calcs).
  - `cumulativeHours.ts`: 7, 28, and 365-day rolling window calculations for CAAT limits.
  - `logbookStats.ts`: Data aggregation for statistics and aircraft currency tracking.
  - `flightDataIO.ts`: JSON Export/Import functionality.

## Recent Work & Context
1. **Discrepancy Fix (Date Range vs. Cumulative Hours):** Fixed a bug where "Query by date range" only counted legs where the user was Pilot Flying (PF) or Pilot Monitoring (PM), while the "Cumulative Hours Monitor" used the entire mission's Block time. Per user request (Option A), the Query by Date Range was updated to use total mission Block time (`entry.totalBlock`) to match the Cumulative Monitor.
2. **UI & Navigation Improvements:**
   - Moved the "Total Block" and "Total Flight" summary boxes to the bottom of the `MissionDashboard` to improve the data entry workflow.
   - Added a "Check FDP & Duty" shortcut button at the bottom of the Flight tab.
   - Relocated the "Save to Logbook" button to the header of the Flight tab and added a duplicate Save button in the FDP tab.
3. **IFP / FIVP Tracking:**
   - Added collapsible UI cards for NAVAID and IFP experience tracking.
   - Renamed components and metrics for clarity (e.g., "FIVP HOURS STATISTICS").
4. **Code Quality:** Removed unused variables (like `rawToMins` from `StatisticsCard.tsx`) and fixed TypeScript errors during the UI refactor.

## Current State & Next Steps
- **Build Status:** The application builds successfully (`npm run build`).
- **Outstanding Tasks (from `task.md`):**
  - Add an "IFP checkbox" in the Flight tab (MissionDashboard/LegRow) so that when checked, that leg's block time automatically contributes to IFP tracking.
  - Verify and test the new IFP tracking logic to ensure it aligns perfectly with the user's manual inputs.

## Important Guidelines for Next AI
1. **Aesthetics:** The user highly values premium, modern UI design. Use dark modes, glassmorphism, subtle gradients, and standard colors (e.g., Emerald for success/save, Cyan for info, Amber for warnings/duty).
2. **Tools:** ALWAYS prioritize explicit code parsing over blind regex. TypeScript compilation (`tsc -b`) is strictly enforced; resolve all types when modifying props.
3. **CAAT Rules:** The application strictly adheres to specific mathematical rules for flight time (Block time vs. Flight time) and FDP limits. Do not alter core calculation files (`utils/calculations.ts` or `utils/fdp.ts` / `cumulativeHours.ts`) without explicitly confirming regulatory logic.
4. **Artifacts:** Keep the `walkthrough.md` and `task.md` updated in the `.gemini` brain directory if you engage in Planning Mode.
