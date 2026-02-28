import jsPDF from 'jspdf';

interface DocumentContent {
  id: string;
  title: string;
  sections: Array<{
    id: string;
    heading: string;
    content: string;
    citations: Array<{
      id: string;
      text: string;
      sourceId: string;
      pageNumber?: number;
    }>;
  }>;
  citations: Array<{
    id: string;
    text: string;
    sourceId: string;
    pageNumber?: number;
  }>;
  generatedAt: Date;
  documentType: string;
}

interface SourceDocument {
  id: string;
  title: string;
  filename: string;
  fileSize: number;
}

/**
 * Export regulatory document to PDF
 * Includes document content, citations, and source references
 */
export function exportDocumentToPDF(
  document: DocumentContent,
  sources?: SourceDocument[]
): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Helper function to add text with automatic page breaks
  const addText = (text: string, options: Record<string, any> = {}) => {
    const { fontSize = 12, isBold = false, maxWidth = contentWidth } = options;

    pdf.setFontSize(fontSize);
    if (isBold) {
      (pdf as any).setFont(undefined, 'bold');
    } else {
      (pdf as any).setFont(undefined, 'normal');
    }

    const lines = (pdf as any).splitTextToSize(text, maxWidth);
    const lineHeight = fontSize * 0.35;

    for (const line of lines) {
      if (yPosition + lineHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin, yPosition);
      yPosition += lineHeight;
    }

    (pdf as any).setFont(undefined, 'normal');
  };

  // Title page
  addText(document.title, { fontSize: 20, isBold: true });
  yPosition += 5;

  addText(`Document Type: ${document.documentType.toUpperCase()}`, {
    fontSize: 11,
  });
  yPosition += 3;

  addText(
    `Generated: ${document.generatedAt.toLocaleDateString()} ${document.generatedAt.toLocaleTimeString()}`,
    { fontSize: 10 }
  );
  yPosition += 10;

  // Table of contents
  addText('Table of Contents', { fontSize: 14, isBold: true });
  yPosition += 5;

  document.sections.forEach((section, index) => {
    addText(`${index + 1}. ${section.heading}`, { fontSize: 11 });
    yPosition += 3;
  });

  yPosition += 5;

  // Document sections
  document.sections.forEach((section) => {
    if (yPosition > pageHeight - margin - 20) {
      pdf.addPage();
      yPosition = margin;
    }

    addText(section.heading, { fontSize: 14, isBold: true });
    yPosition += 5;

    addText(section.content, { fontSize: 11, maxWidth: contentWidth });
    yPosition += 5;

    // Add citations for this section if any
    if (section.citations.length > 0) {
      addText('References:', { fontSize: 10, isBold: true });
      yPosition += 2;

      section.citations.forEach((citation) => {
        const citationText = `[${citation.id}] ${citation.text}${
          citation.pageNumber ? ` (Page ${citation.pageNumber})` : ''
        }`;
        addText(citationText, { fontSize: 9, maxWidth: contentWidth - 5 });
        yPosition += 2;
      });

      yPosition += 3;
    }

    yPosition += 5;
  });

  // Sources appendix
  if (sources && sources.length > 0) {
    pdf.addPage();
    yPosition = margin;

    addText('Appendix: Referenced Sources', { fontSize: 14, isBold: true });
    yPosition += 5;

    sources.forEach((source, index) => {
      if (yPosition > pageHeight - margin - 15) {
        pdf.addPage();
        yPosition = margin;
      }

      addText(`${index + 1}. ${source.title}`, { fontSize: 11, isBold: true });
      yPosition += 3;

      addText(`File: ${source.filename}`, { fontSize: 10 });
      yPosition += 2;

      addText(`Size: ${(source.fileSize / 1024 / 1024).toFixed(2)} MB`, {
        fontSize: 10,
      });
      yPosition += 4;
    });
  }

  // Footer with page numbers
  const pageCount = (pdf as any).internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const fileName = `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
  pdf.save(fileName);
}

/**
 * Export document with sources as a structured JSON file
 * Useful for archiving and version control
 */
export function exportDocumentAsJSON(
  document: DocumentContent,
  sources?: SourceDocument[]
): void {
  const exportData = {
    document,
    sources: sources || [],
    exportedAt: new Date().toISOString(),
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = globalThis.document.createElement('a') as HTMLAnchorElement;
  link.href = url;
  link.download = `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export sources as a ZIP file
 * Creates a downloadable archive of all referenced source documents
 */
export async function exportSourcesAsZip(
  sources: SourceDocument[],
  documentTitle: string
): Promise<void> {
  // Dynamic import to avoid bundling JSZip if not needed
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // Create a folder for sources
  const sourcesFolder = zip.folder('sources');
  if (!sourcesFolder) return;

  // Add metadata file
  const metadata = {
    exportedAt: new Date().toISOString(),
    sourceCount: sources.length,
    sources: sources.map((s) => ({
      id: s.id,
      title: s.title,
      filename: s.filename,
      fileSize: s.fileSize,
    })),
  };

  sourcesFolder.file(
    'metadata.json',
    JSON.stringify(metadata, null, 2)
  );

  // Note: In a real implementation, you would fetch the actual file content
  // from your S3 storage and add it to the zip
  // For now, we'll add placeholder entries
  sources.forEach((source) => {
    const content = `[Source file: ${source.title}]\n\nFile Size: ${(source.fileSize / 1024 / 1024).toFixed(2)} MB\n\nThis is a placeholder. In production, the actual file content would be included.`;
    sourcesFolder.file(source.filename, content);
  });

  // Generate and download the ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a') as HTMLAnchorElement;
  link.href = url;
  link.download = `${documentTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_sources.zip`;
  link.click();
  URL.revokeObjectURL(url);
}
