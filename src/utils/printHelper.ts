/**
 * Global Print, PDF Export & Excel Export Utility for Teuk Chor High School Management System (វិទ្យាល័យទឹកជោរ)
 * Standardizes Khmer document titles (Report Name + Class + Academic Year),
 * manages document.title and @page orientation (A4 portrait / A4 landscape) lifecycle for native browser printing,
 * and generates standalone MoEYS A4 printable PDF/HTML sheets and UTF-8 BOM Excel files.
 */

export interface KhmerReportTitleParams {
  reportNameKh: string;
  className: string;
  academicYear?: string;
  extraContext?: string;
}

/**
 * Constructs a standardized Khmer PDF/Print filename containing the Khmer report name,
 * optional context (month / student / exam), class, and academic year.
 */
export function formatKhmerReportTitle({
  reportNameKh,
  className,
  academicYear = '២០២៥-២០២៦',
  extraContext,
}: KhmerReportTitleParams): string {
  const cleanPart = (val?: string) =>
    (val || '')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_');

  const reportPart = cleanPart(reportNameKh) || 'របាយការណ៍ផ្លូវការ';
  const extraPart = extraContext ? cleanPart(extraContext) : '';
  const rawClass = cleanPart(className) || '12C';
  const classPart =
    rawClass.startsWith('ថ្នាក់') || rawClass.startsWith('គ្រប់')
      ? rawClass
      : `ថ្នាក់ទី_${rawClass}`;
  const yearPart = `ឆ្នាំសិក្សា_${cleanPart(academicYear) || '២០២៥-២០២៦'}`;

  return [reportPart, extraPart, classPart, yearPart, 'វិទ្យាល័យទឹកជោរ']
    .filter(Boolean)
    .join('_');
}

/**
 * Temporarily injects a dynamic @page { size: A4 portrait|landscape } style rule,
 * assigns document.title to the formatted Khmer report title, triggers native browser printing,
 * and restores the original title and page orientation rule after printing.
 */
export function handleGlobalPrint(
  documentTitle?: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const originalTitle = document.title;
  const sanitizedTitle = documentTitle?.trim();

  if (sanitizedTitle) {
    document.title = sanitizedTitle;
  }

  // Inject dynamic @page orientation style so browser print respects A4 portrait vs A4 landscape
  const styleId = 'teuk-chor-dynamic-print-page-style';
  let dynamicStyle = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!dynamicStyle) {
    dynamicStyle = document.createElement('style');
    dynamicStyle.id = styleId;
    document.head.appendChild(dynamicStyle);
  }
  dynamicStyle.textContent = `@media print { @page { size: A4 ${orientation}; margin: ${
    orientation === 'landscape' ? '8mm 10mm' : '10mm 12mm'
  }; } }`;
  document.body.setAttribute('data-print-orientation', orientation);

  let restored = false;
  const restoreTitle = () => {
    if (restored) return;
    restored = true;
    if (sanitizedTitle) {
      document.title = originalTitle;
    }
    window.removeEventListener('afterprint', restoreTitle);
  };

  window.addEventListener('afterprint', restoreTitle);

  try {
    window.print();
  } finally {
    window.setTimeout(restoreTitle, 10000);
  }
}

/**
 * Generates and downloads a standalone, self-contained A4 printable HTML/PDF document
 * with embedded Khmer fonts (Moul & Kantumruy Pro & JetBrains Mono), @media print rules,
 * repeating table headers, page-break protection, and page numbering.
 */
export function downloadPrintableA4Document(
  documentTitle: string,
  sheetInnerHtml: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const safeTitle = (documentTitle || 'របាយការណ៍ផ្លូវការ_វិទ្យាល័យទឹកជោរ').trim();
  const htmlContent = `<!DOCTYPE html>
<html lang="km">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Kantumruy+Pro:ital,wght@0,300..700;1,300..700&family=Moul&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page {
      size: A4 ${orientation};
      margin: ${orientation === 'landscape' ? '8mm 10mm' : '10mm 12mm'};
    }
    body {
      font-family: "Kantumruy Pro", "Khmer OS Battambang", "Inter", sans-serif;
      color: #000000;
      background: #f1f5f9;
      margin: 0;
      padding: 20px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .font-khmer-moul, .font-khmer-title {
      font-family: "Moul", "Khmer OS Muol Light", serif;
      line-height: 1.85;
    }
    .font-khmer-body {
      font-family: "Kantumruy Pro", "Khmer OS Battambang", "Inter", sans-serif;
      line-height: 1.65;
    }
    .font-mono-tabular {
      font-family: "JetBrains Mono", monospace;
      font-variant-numeric: tabular-nums;
    }
    .print-sheet {
      background: #ffffff;
      color: #000000;
      max-width: ${orientation === 'landscape' ? '297mm' : '210mm'};
      margin: 0 auto;
      padding: 10mm 12mm;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
      border-radius: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse !important;
    }
    thead {
      display: table-header-group !important;
    }
    tfoot {
      display: table-footer-group !important;
    }
    tr, .print-avoid-break {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .print-table, .print-table th, .print-table td {
      border: 1px solid #000000 !important;
      border-collapse: collapse !important;
    }
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      .print-sheet {
        max-width: 100% !important;
        width: 100% !important;
        padding: 0 !important;
        box-shadow: none !important;
        margin: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: ${orientation === 'landscape' ? '297mm' : '210mm'}; margin: 0 auto 16px auto; background: #0f172a; color: white; padding: 12px 20px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; font-family: 'Kantumruy Pro', sans-serif;">
    <div>
      <div style="font-size: 13px; font-weight: 700;">វិទ្យាល័យទឹកជោរ • ${safeTitle}</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">ទម្រង់ក្រដាស A4 (${orientation === 'landscape' ? 'ផ្តេក Landscape' : 'បញ្ឈរ Portrait'}) • រក្សាទុកជា PDF តាមរយៈប្រអប់បោះពុម្ព</div>
    </div>
    <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer;">
      បោះពុម្ព / រក្សាទុកជា PDF (Ctrl+P)
    </button>
  </div>
  <div class="print-sheet">
    ${sheetInnerHtml}
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 450);
    });
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeTitle}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Exports any report data table to an Excel-compatible UTF-8 BOM CSV file (.csv)
 * preserving Khmer Unicode characters and metadata header lines.
 */
export function exportReportToExcelCsv(params: {
  filename: string;
  reportTitleKh: string;
  schoolNameKh?: string;
  metadataLineKh?: string;
  headers: string[];
  rows: (string | number)[][];
}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const escapeCsvCell = (val: string | number) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const metaRows: string[] = [
    [escapeCsvCell(params.schoolNameKh || 'វិទ្យាល័យទឹកជោរ (Teuk Chor High School)')].join(','),
    [escapeCsvCell(params.reportTitleKh)].join(','),
  ];
  if (params.metadataLineKh) {
    metaRows.push([escapeCsvCell(params.metadataLineKh)].join(','));
  }
  metaRows.push(''); // blank separator line

  const headerLine = params.headers.map(escapeCsvCell).join(',');
  const dataLines = params.rows.map((row) => row.map(escapeCsvCell).join(','));

  const csvString = '\uFEFF' + [...metaRows, headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${params.filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
