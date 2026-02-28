import { invokeLLM } from "./_core/llm";

/**
 * FDA-compliant system prompt for regulatory documentation generation
 */
const FDA_SYSTEM_PROMPT = `You are an expert regulatory affairs specialist with deep knowledge of FDA requirements for medical device submissions, particularly 510(k) and De Novo applications. You have extensive experience in:

- FDA guidance documents and regulations (21 CFR Part 807, 812, 860, etc.)
- Medical device classification and predicate device selection
- Substantial equivalence determination
- Clinical evaluation and safety/effectiveness assessment
- Biocompatibility, sterilization, and manufacturing requirements
- Device labeling and instructions for use

Your task is to generate comprehensive, accurate, and compliant regulatory documentation based on provided source materials. All generated content must:
1. Be grounded in the provided source documents
2. Follow FDA guidance and regulatory requirements
3. Include appropriate citations and references
4. Use clear, professional regulatory language
5. Be scientifically accurate and evidence-based
6. Include all required regulatory elements`;

/**
 * Generate a Device Description document
 */
export async function generateDeviceDescription(
  deviceName: string,
  deviceType: string,
  intendedUse: string,
  sourceDocuments: string[]
): Promise<{ content: string; citations: Array<{ text: string; source: string }> }> {
  const sourcesText = sourceDocuments.map((doc, i) => `Source ${i + 1}:\n${doc}`).join("\n\n");

  const prompt = `Generate a comprehensive FDA-compliant Device Description document for the following medical device:

Device Name: ${deviceName}
Device Type: ${deviceType}
Intended Use: ${intendedUse}

Source Materials:
${sourcesText}

The Device Description should include:
1. Device name and common name
2. Device classification
3. Physical description and components
4. Operating principles
5. Specifications and performance characteristics
6. Manufacturing process overview
7. Intended use statement
8. Patient population and operating environment

Format the output as a professional regulatory document with clear sections and subsections. Include [CITATION] markers where information is drawn from the source materials.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: FDA_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const messageContent = response.choices[0].message.content;
  const content = typeof messageContent === "string" ? messageContent : "";
  const citations = extractCitations(content, sourceDocuments);

  return { content, citations };
}

/**
 * Generate a Substantial Equivalence Comparison document
 */
export async function generateSubstantialEquivalence(
  deviceName: string,
  predicateDevices: any[],
  sourceDocuments: string[]
): Promise<{ content: string; citations: Array<{ text: string; source: string }> }> {
  const predicateText = predicateDevices
    .map(
      (p, i) =>
        `Predicate Device ${i + 1}:
    Name: ${p.name}
    Manufacturer: ${p.manufacturer}
    Classification: ${p.classification}
    Intended Use: ${p.intendedUse}`
    )
    .join("\n\n");

  const sourcesText = sourceDocuments.map((doc, i) => `Source ${i + 1}:\n${doc}`).join("\n\n");

  const prompt = `Generate a comprehensive Substantial Equivalence Comparison document for FDA 510(k) submission:

Device Under Review: ${deviceName}

${predicateText}

Source Materials:
${sourcesText}

The Substantial Equivalence Comparison should include:
1. Predicate device identification and justification
2. Intended use comparison
3. Technological characteristics comparison
4. Design and functional characteristics comparison
5. Performance characteristics comparison
6. Differences and justification of equivalence
7. Conclusion of substantial equivalence

Use FDA guidance on substantial equivalence determination. Format as a professional regulatory document with clear sections. Include [CITATION] markers where information is drawn from source materials.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: FDA_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const messageContent = response.choices[0].message.content;
  const content = typeof messageContent === "string" ? messageContent : "";
  const citations = extractCitations(content, sourceDocuments);

  return { content, citations };
}

/**
 * Generate a Safety and Performance Evaluation document
 */
export async function generateSafetyPerformanceEvaluation(
  deviceName: string,
  sourceDocuments: string[]
): Promise<{ content: string; citations: Array<{ text: string; source: string }> }> {
  const sourcesText = sourceDocuments.map((doc, i) => `Source ${i + 1}:\n${doc}`).join("\n\n");

  const prompt = `Generate a comprehensive Safety and Performance Evaluation document for FDA submission:

Device: ${deviceName}

Source Materials:
${sourcesText}

The Safety and Performance Evaluation should include:
1. Executive Summary
2. Performance Testing Summary
   - Bench testing results
   - Animal testing (if applicable)
   - Clinical testing (if applicable)
3. Safety Assessment
   - Hazard analysis
   - Risk mitigation measures
   - Residual risk evaluation
4. Biocompatibility Assessment (if applicable)
5. Sterilization Validation (if applicable)
6. Software Validation (if applicable)
7. Shelf Life and Stability (if applicable)
8. Conclusions and Overall Safety Assessment

Format as a professional regulatory document. Include [CITATION] markers for all claims supported by source materials.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: FDA_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const messageContent = response.choices[0].message.content;
  const content = typeof messageContent === "string" ? messageContent : "";
  const citations = extractCitations(content, sourceDocuments);

  return { content, citations };
}

/**
 * Generate a Clinical Evaluation Report
 */
export async function generateClinicalEvaluation(
  deviceName: string,
  sourceDocuments: string[]
): Promise<{ content: string; citations: Array<{ text: string; source: string }> }> {
  const sourcesText = sourceDocuments.map((doc, i) => `Source ${i + 1}:\n${doc}`).join("\n\n");

  const prompt = `Generate a comprehensive Clinical Evaluation Report for FDA submission:

Device: ${deviceName}

Clinical Data and Literature:
${sourcesText}

The Clinical Evaluation Report should include:
1. Executive Summary
2. Clinical Background and Rationale
3. Literature Review
   - Relevant clinical studies
   - Comparative devices
   - Clinical outcomes
4. Clinical Data Summary
   - Study design and methodology
   - Patient population
   - Efficacy results
   - Safety results
   - Adverse events
5. Clinical Conclusions
6. References

Follow FDA guidance on clinical evaluation. Format as a professional regulatory document. Include [CITATION] markers for all clinical data and literature references.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: FDA_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const messageContent = response.choices[0].message.content;
  const content = typeof messageContent === "string" ? messageContent : "";
  const citations = extractCitations(content, sourceDocuments);

  return { content, citations };
}

/**
 * Generate Instructions for Use (IFU) / Labeling
 */
export async function generateInstructionsForUse(
  deviceName: string,
  sourceDocuments: string[]
): Promise<{ content: string; citations: Array<{ text: string; source: string }> }> {
  const sourcesText = sourceDocuments.map((doc, i) => `Source ${i + 1}:\n${doc}`).join("\n\n");

  const prompt = `Generate comprehensive Instructions for Use (IFU) and labeling for an FDA-regulated medical device:

Device: ${deviceName}

Source Materials:
${sourcesText}

The Instructions for Use should include:
1. Device Description and Intended Use
2. Indications for Use
3. Contraindications (if applicable)
4. Warnings and Precautions
5. Adverse Reactions (if applicable)
6. Instructions for Use
   - Setup and preparation
   - Operating procedures
   - Step-by-step instructions
7. Maintenance and Care (if applicable)
8. Storage and Handling
9. Troubleshooting
10. Symbols and Abbreviations (if applicable)
11. Regulatory Information

Follow FDA labeling guidance. Use clear, patient-friendly language where appropriate. Include [CITATION] markers for safety-critical information.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: FDA_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const messageContent = response.choices[0].message.content;
  const content = typeof messageContent === "string" ? messageContent : "";
  const citations = extractCitations(content, sourceDocuments);

  return { content, citations };
}

/**
 * Generate a 510(k) Summary
 */
export async function generate510kSummary(
  deviceName: string,
  intendedUse: string,
  predicateDevices: any[],
  sourceDocuments: string[]
): Promise<{ content: string; citations: Array<{ text: string; source: string }> }> {
  const predicateText = predicateDevices
    .map((p) => `- ${p.name} (${p.manufacturer})`)
    .join("\n");

  const sourcesText = sourceDocuments.map((doc, i) => `Source ${i + 1}:\n${doc}`).join("\n\n");

  const prompt = `Generate a concise 510(k) Summary for FDA submission:

Device: ${deviceName}
Intended Use: ${intendedUse}

Predicate Devices:
${predicateText}

Supporting Documentation:
${sourcesText}

The 510(k) Summary should include:
1. Device Name and Classification
2. Predicate Device(s) Identification
3. Indications for Use
4. Device Description
5. Substantial Equivalence Statement
6. Performance Data Summary
7. Conclusion

Keep the summary concise (typically 2-5 pages). Follow FDA format requirements. Include [CITATION] markers for key claims.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: FDA_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const messageContent = response.choices[0].message.content;
  const content = typeof messageContent === "string" ? messageContent : "";
  const citations = extractCitations(content, sourceDocuments);

  return { content, citations };
}

/**
 * Extract citations from generated content
 * Looks for [CITATION] markers and maps them to source documents
 */
function extractCitations(
  content: string,
  sourceDocuments: string[]
): Array<{ text: string; source: string }> {
  const citations: Array<{ text: string; source: string }> = [];
  const citationRegex = /\[CITATION\s*(\d+)?\]/g;
  let match;

  while ((match = citationRegex.exec(content)) !== null) {
    const sourceIndex = match[1] ? parseInt(match[1]) - 1 : 0;
    if (sourceIndex < sourceDocuments.length) {
      citations.push({
        text: match[0],
        source: sourceDocuments[sourceIndex].substring(0, 200) + "...",
      });
    }
  }

  return citations;
}

/**
 * Generate all required documents for a complete 510(k) submission
 */
export async function generateComplete510kSubmission(
  deviceName: string,
  deviceType: string,
  intendedUse: string,
  predicateDevices: any[],
  sourceDocuments: string[]
): Promise<{
  documents: Array<{
    type: string;
    title: string;
    content: string;
    citations: Array<{ text: string; source: string }>;
  }>;
}> {
  const documents = [];

  try {
    // Generate Device Description
    const deviceDesc = await generateDeviceDescription(deviceName, deviceType, intendedUse, sourceDocuments);
    documents.push({
      type: "device_description",
      title: "Device Description",
      content: deviceDesc.content,
      citations: deviceDesc.citations,
    });

    // Generate Substantial Equivalence
    const substEq = await generateSubstantialEquivalence(deviceName, predicateDevices, sourceDocuments);
    documents.push({
      type: "substantial_equivalence",
      title: "Substantial Equivalence Comparison",
      content: substEq.content,
      citations: substEq.citations,
    });

    // Generate Safety and Performance
    const safetyPerf = await generateSafetyPerformanceEvaluation(deviceName, sourceDocuments);
    documents.push({
      type: "safety_evaluation",
      title: "Safety and Performance Evaluation",
      content: safetyPerf.content,
      citations: safetyPerf.citations,
    });

    // Generate Instructions for Use
    const ifu = await generateInstructionsForUse(deviceName, sourceDocuments);
    documents.push({
      type: "labeling_instructions",
      title: "Instructions for Use",
      content: ifu.content,
      citations: ifu.citations,
    });

    // Generate 510(k) Summary
    const summary = await generate510kSummary(deviceName, intendedUse, predicateDevices, sourceDocuments);
    documents.push({
      type: "510k_summary",
      title: "510(k) Summary",
      content: summary.content,
      citations: summary.citations,
    });

    return { documents };
  } catch (error) {
    console.error("Error generating 510(k) submission documents:", error);
    throw error;
  }
}
