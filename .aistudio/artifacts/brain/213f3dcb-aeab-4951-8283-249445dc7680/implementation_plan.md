# Global Print & A4 PDF Export Architecture — Teok Chor High School Management System (វិទ្យាល័យទឹកជោរ)

A unified, school-wide print and PDF generation utility that standardizes Khmer document titles, triggers native browser printing, and provides an interactive A4 Print & PDF Ready Preview Bar across all administrative rosters, academic ranking boards, and student portal transcripts.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Scope & Architectural Decisions:**
> 1. **Standardized Khmer PDF Document Naming**: Every print action dynamically formats `document.title` using the **Khmer report name, class, and academic year** (e.g., `បញ្ជីសិស្សសរុប_ថ្នាក់ទី_12C_ឆ្នាំសិក្សា_២០២៦-២០២៧_វិទ្យាល័យទឹកជោរ` or `តារាងចំណាត់ថ្នាក់ប្រចាំខែ_វិច្ឆិកា_ថ្នាក់ទី_12C_ឆ្នាំសិក្សា_២០២៦-២០២៧`) before invoking `window.print()`, then cleanly restores the original page title afterward.
> 2. **Complete Report Coverage**: The global print engine is wired into:
>    - **Student Master Roster & Class Rosters** (36-column Student Master Roster & official class rosters)
>    - **Monthly & Annual Ranking & Honor Roll Boards** (Monthly Score Grid, Monthly Ranking Table, Annual GPA/Result Sheet, and Top 5 Honor Roll)
>    - **Student Portal Transcript & Online Exam Results** (Individual Student Academic Transcript and Online Exam Score/Question Sheets)
> 3. **Dual Native Print + A4 Preview Bar**: Clicking any `"បោះពុម្ព / រក្សាទុក PDF"` button immediately triggers native `window.print()` via `handleGlobalPrint(documentTitle)` **and** opens an interactive **A4 Print & PDF Ready Preview Bar** with a 1-click standalone A4 printable document download so teachers and students can always export clean PDFs even inside sandboxed preview iframes.

---

## 1. Overview & Core Concept

Teachers, school administrators, and students at **Teok Chor High School (វិទ្យាល័យទឹកជោរ)** need reliable, one-click printing and PDF archiving for official Ministry of Education, Youth and Sport (MoEYS) administrative sheets. Because browser `window.print()` relies on `document.title` as the default saved PDF filename—and because embedded preview environments can occasionally suppress native print dialogs—the global print system pairs a deterministic title-lifecycle manager (`handleGlobalPrint`) with an in-app **A4 Print & PDF Ready Preview Bar** and standalone A4 HTML/PDF generator.

Every printable view automatically formats its header with the official **Kingdom of Cambodia / MoEYS letterhead**, tabular numeric columns, female `ក.` prefix conventions, tie-ranking indicators (`ស្មើ`), and signature blocks at the bottom of the sheet.

---

## 2. User Experience & Visual Design

### Aesthetic Direction & Architectural Polarity
- **Screen Workspace Polarity**: **High-Craft Light Mode** (`#F8FAFC` Cool Alabaster canvas, `#FFFFFF` elevated data surfaces, `#E2E8F0` hairline grid dividers) paired with the existing **Growly LMS Dark Navigation Sidebar** (`#14171F`).
- **A4 Print Sheet Polarity**: Pure **Archival Paper White (`#FFFFFF`)** with crisp `#CBD5E1` / `#94A3B8` table borders, zero navigation chrome, and ink-friendly high-contrast typography (`#0F172A`).
- **60-30-10 Color Allocation**:
  - **60% Canvas & Paper Surface**: `#F8FAFC` workspace background (`#FFFFFF` in `@media print`).
  - **30% Structured Data Surfaces & Ink**: `#FFFFFF` cards, `#0F172A` deep slate primary ink, `#475569` secondary metadata labels.
  - **10% Semantic & Action Accents**: `#4F46E5` (Indigo) for primary print/export actions, `#10B981` (Emerald) for passing/verified status and A4 ready confirmation, `#F59E0B` (Amber) for Top 1–5 Honor Roll medals, and `#E11D48` (Rose) for failing/validation alerts.

### Typography & Scannable Hierarchy
- **Official Khmer Ceremonial Headings (`--font-display`)**: `'Moul', serif` for Kingdom of Cambodia (`ព្រះរាជាណាចក្រកម្ពុជា / ជាតិ សាសនា ព្រះមហាក្សត្រ`) and school letterhead titles.
- **Primary UI & Khmer Body (`--font-sans`)**: `'Kantumruy Pro', 'Plus Jakarta Sans', sans-serif` with comfortable line height (`1.6`) to prevent Khmer diacritic clipping (`ជើងអក្សរ`).
- **Tabular Numeric Discipline (`--font-mono`)**: `'JetBrains Mono', monospace` with `font-variant-numeric: tabular-nums` enforced across all Student Codes (`អត្តលេខ`), subject scores, averages (`មធ្យមភាគ`), and ranks (`ចំណាត់ថ្នាក់`).

### Interactive Print & A4 Preview Flow
1. **Triggering Print**: User clicks `"🖨️ បោះពុម្ព / រក្សាទុក PDF"` in the top action bar of any report view.
2. **Instant Native Print & Title Assignment**:
   - The utility formats the canonical Khmer filename: `[Khmer Report Name]_ថ្នាក់ទី_[Class]_ឆ្នាំសិក្សា_[Academic Year]_វិទ្យាល័យទឹកជោរ`.
   - `document.title` updates immediately and `window.print()` is invoked.
3. **Interactive A4 Print & PDF Ready Preview Bar**:
   - Simultaneously, a sleek emerald-accented **A4 Preview Banner** appears above the active sheet displaying the exact formatted PDF filename, page orientation (`A4 Landscape` for 36-column Master Roster and wide scoreboards; `A4 Portrait` for Class Rosters, Ranking Tables, Honor Roll, and Student Transcripts), and three immediate controls:
     - **`🖨️ បើកផ្ទាំងបោះពុម្ព (window.print)`**: Re-triggers native browser print dialog on demand.
     - **`📥 ទាញយកឯកសារ A4 សម្រាប់បោះពុម្ព (.html / PDF)`**: Generates and downloads a self-contained, styled A4 document that opens cleanly in any browser tab and auto-launches the print/PDF save dialog.
     - **`បិទ (Close)`**: Dismisses the preview bar.

---

## 3. Key Product Decisions & Trade-Offs

- **Canonical Khmer Filename Formatter**: Rather than hardcoding ad-hoc strings in each component, a shared formatter constructs sanitized, human-readable Khmer filenames combining the report type, class name, academic year, and optional period/student name. This guarantees consistent archive naming when teachers save dozens of monthly class PDFs.
- **Non-Blocking Title Restoration (`afterprint` + Timeout Fallback)**: Browsers handle `window.print()` differently (some block execution until the dialog closes; others return immediately). Listening to the `window.afterprint` event Alongside a safe fallback timer ensures `document.title` remains set while the browser reads the PDF filename and reliably restores afterward.
- **Orientation-Aware A4 Styling**: Wide multi-column tables (36-column Student Master Roster and multi-subject Monthly Score Sheets) require landscape layout, while official rankings, honor rolls, and student transcripts read best in portrait. The standalone A4 generator and print stylesheet dynamically adapt `@page { size: A4 portrait | landscape }` per report type.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        REPORT & PORTAL VIEW SURFACES                         │
│                                                                              │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                    │
│  │  Student Master Roster  │  │  Official Reports &     │                    │
│  │  (36-Col Data Workspace)│  │  Scores/Ranking Views   │                    │
│  └────────────┬────────────┘  └────────────┬────────────┘                    │
│               │                            │                                 │
│  ┌────────────┴────────────┐  ┌────────────┴────────────┐                    │
│  │  Student Portal         │  │  Online Exams Portal    │                    │
│  │  (Academic Transcript)  │  │  (Exam Results & Quiz)  │                    │
│  └────────────┬────────────┘  └────────────┬────────────┘                    │
└───────────────┼────────────────────────────┼─────────────────────────────────┘
                │                            │
                ▼                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     GLOBAL PRINT & PDF UTILITY ENGINE                        │
│                                                                              │
│  1. formatKhmerReportTitle({ reportNameKh, className, academicYear, extra }) │
│     └─► e.g. "តារាងចំណាត់ថ្នាក់ប្រចាំខែ_វិច្ឆិកា_ថ្នាក់ទី_12C_ឆ្នាំសិក្សា_២០២៦-២០២៧"   │
│                                                                              │
│  2. handleGlobalPrint(documentTitle)                                         │
│     ├─► Saves original document.title                                        │
│     ├─► Assigns sanitized Khmer documentTitle                                │
│     ├─► Calls window.requestAnimationFrame -> window.print()                 │
│     └─► Restores original title on 'afterprint' + fallback timer             │
│                                                                              │
│  3. downloadPrintableA4Document({ title, subtitle, headers, rows, ... })     │
│     └─► Builds self-contained MoEYS A4 HTML sheet & triggers Blob download   │
└───────────────┬────────────────────────────────────────────┬─────────────────┘
                │                                            │
                ▼                                            ▼
┌──────────────────────────────────────┐  ┌────────────────────────────────────┐
│   NATIVE BROWSER PRINT (@media print)│  │  IN-APP A4 PREVIEW & EXPORT BAR    │
│  • Hides sidebar, topbar & controls  │  │  • Displays formatted PDF filename │
│  • Forces A4 full-width crisp table  │  │  • 1-Click Re-Print button         │
│  • Renders MoEYS header & signatures │  │  • 1-Click Standalone A4 download  │
└──────────────────────────────────────┘  └────────────────────────────────────┘
```

### Data Model & Print Payload Specification
- **`KhmerReportTitleParams`**:
  - `reportNameKh`: Primary Khmer title of the report (e.g., `'បញ្ជីសិស្សសរុប'`, `'តារាងចំណាត់ថ្នាក់ប្រចាំខែ'`, `'តារាងកិត្តិយស_Top5'`, `'ព្រឹត្តិបត្រពិន្ទុសិស្ស'`, `'លទ្ធផលប្រឡងអនឡាញ'`).
  - `className`: Target class identifier (e.g., `'12C'`, `'គ្រប់ថ្នាក់'`).
  - `academicYear`: Academic year string (e.g., `'២០២៦-២០២៧'`).
  - `extraContext` *(optional)*: Month name, student name, or exam title.
- **`PrintableA4DocumentPayload`**:
  - `title`: Formatted Khmer filename and document title.
  - `reportHeaderKh`: Display heading printed in `'Moul'` font at the top of the A4 sheet.
  - `subtitle`: Metadata line showing Class, Academic Year, Period/Month, and total count.
  - `orientation`: `'portrait' | 'landscape'` (controls `@page { size: A4 ... }`).
  - `headers` & `rows`: Structured table headers and formatted cell values preserving female `ក.` prefixes, tie-rank badges (`ស្មើ`), and `-1.72` (`មិនចាត់ថ្នាក់`) indicators.

### Interactive Component & State Mapping
1. **Student Master Roster (`DatabaseExplorerView`)**:
   - Clicking `"បោះពុម្ព / PDF"` formats the title with `'បញ្ជីសិស្សសរុប'`, active class filter (`selectedClass` or `'គ្រប់ថ្នាក់'`), and academic year (`selectedAcademicYear`), invokes `handleGlobalPrint(docTitle)`, and opens the A4 Preview Bar with `landscape` orientation for the multi-column roster.
2. **Official Scores, Grading, Ranking & Honor Roll (`OfficialReportsPage`)**:
   - Clicking `"បោះពុម្ព / រក្សាទុក PDF"` dynamically maps the active tab (`monthly_scores`, `monthly_ranking`, `annual_ranking`, `honor_roll`, `class_roster`) to its official Khmer report name, combines it with `selectedClass`, `selectedYear`, and `selectedMonth` (when applicable), calls `handleGlobalPrint(docTitle)`, and reveals the A4 Preview Bar + official print header/signature block.
3. **Student Portal Transcript (`StudentPortal`)**:
   - Clicking `"បោះពុម្ពព្រឹត្តិបត្រពិន្ទុ"` formats the title with `'ព្រឹត្តិបត្រពិន្ទុសិស្ស'`, the student's full Khmer name, class (`12C`), and academic year (`២០២៦-២០២៧`), calls `handleGlobalPrint(docTitle)`, and displays an A4 Transcript Preview Bar with 1-click standalone A4 transcript download containing the student's monthly averages, subject breakdown, rank, and principal/teacher signature lines.
4. **Online Exams Portal (`OnlineExamsPortalView`)**:
   - Clicking `"បោះពុម្ពលទ្ធផលប្រឡង"` (or printing an exam sheet) formats the title with `'លទ្ធផលប្រឡងអនឡាញ'`, the exam subject/month, class, and academic year, triggers `handleGlobalPrint(docTitle)`, and opens an A4 Exam Result Preview Bar with 1-click A4 sheet download.
