// Regulatory Document Templates for IND, BLA, and NDA submissions
// Auto-populates based on regulatory standard (US FDA/EU EMA)

export interface RegulatoryTemplate {
  id: string;
  name: string;
  description: string;
  type: 'IND' | 'BLA' | 'NDA';
  standards: {
    usFda: TemplateContent;
    euEma: TemplateContent;
  };
  icon: string;
  estimatedPages: number;
}

export interface TemplateContent {
  title: string;
  sections: TemplateSection[];
  complianceChecklist: ComplianceItem[];
  regulatoryNotes: string;
}

export interface TemplateSection {
  id: string;
  title: string;
  subsections: Subsection[];
  guidance: string;
  required: boolean;
}

export interface Subsection {
  id: string;
  title: string;
  content: string;
  placeholder: string;
  guidance: string;
}

export interface ComplianceItem {
  id: string;
  item: string;
  description: string;
  required: boolean;
}

export const regulatoryTemplates: RegulatoryTemplate[] = [
  {
    id: 'ind-template',
    name: 'Investigational New Drug (IND)',
    description: 'Application for permission to administer an investigational drug to humans',
    type: 'IND',
    icon: '📋',
    estimatedPages: 50,
    standards: {
      usFda: {
        title: 'IND Application - US FDA',
        regulatoryNotes: 'Submitted under 21 CFR 312. Required for clinical trials in the United States.',
        sections: [
          {
            id: 'form-1571',
            title: 'Form FDA 1571 - IND Application',
            required: true,
            guidance: 'Complete all required fields. Refer to 21 CFR 312.20 for specific requirements.',
            subsections: [
              {
                id: 'cover-letter',
                title: 'Cover Letter',
                placeholder: 'Enter cover letter with submission date and contact information',
                content: `COVER LETTER

Date: [DATE]
To: Investigational New Drug Applications
Food and Drug Administration
Center for Drug Evaluation and Research
[ADDRESS]

RE: IND Application for [DRUG NAME]
IND Number: [IND NUMBER]

Dear Sir/Madam:

[Company Name] hereby submits this Investigational New Drug (IND) Application for [Drug Name] ([Generic Name]), intended for the treatment of [indication].

This application is submitted in accordance with 21 CFR Part 312 and contains the following:
- Form FDA 1571
- Chemistry and Manufacturing Controls (CMC) information
- Pharmacology and Toxicology data
- Previous Human Experience
- Protocol(s) and Investigator's Brochure

[Additional details about the submission]`,
                guidance: 'Include all required information and reference numbers'
              },
              {
                id: 'drug-info',
                title: 'Drug Information',
                placeholder: 'Enter drug name, generic name, and chemical structure',
                content: `DRUG INFORMATION

Drug Name: [DRUG NAME]
Generic Name: [GENERIC NAME]
Chemical Name: [CHEMICAL NAME]
CAS Number: [CAS NUMBER]
Molecular Formula: [FORMULA]
Molecular Weight: [WEIGHT]
Structural Formula: [STRUCTURE DESCRIPTION]

Dosage Form: [FORM]
Route of Administration: [ROUTE]
Proposed Indication: [INDICATION]
Phase of Development: [PHASE I/II/III]`,
                guidance: 'Provide complete chemical and pharmaceutical information'
              },
              {
                id: 'manufacturing',
                title: 'Manufacturing and Controls',
                placeholder: 'Describe manufacturing process and quality control procedures',
                content: `MANUFACTURING AND CONTROLS

Manufacturing Process:
[Describe the manufacturing process in detail, including all steps and controls]

Quality Control:
[Describe quality control procedures and specifications]

Stability Data:
[Provide stability data under various conditions]

Container Closure System:
[Describe the container and closure system]

Analytical Methods:
[Describe analytical methods used for testing]`,
                guidance: 'Include CMC information per 21 CFR 312.23(a)(7)'
              }
            ]
          },
          {
            id: 'pharmacology-toxicology',
            title: 'Pharmacology and Toxicology',
            required: true,
            guidance: 'Provide all nonclinical data demonstrating drug safety',
            subsections: [
              {
                id: 'pharmacology',
                title: 'Pharmacology',
                placeholder: 'Describe pharmacological properties and mechanism of action',
                content: `PHARMACOLOGY

Mechanism of Action:
[Describe the proposed mechanism of action]

Pharmacodynamics:
[Describe pharmacodynamic effects and dose-response relationships]

Pharmacokinetics:
[Describe absorption, distribution, metabolism, and excretion]

Species Studied:
[List animal species used in studies]`,
                guidance: 'Include in vivo and in vitro studies'
              },
              {
                id: 'toxicology',
                title: 'Toxicology',
                placeholder: 'Summarize toxicology studies and findings',
                content: `TOXICOLOGY

Acute Toxicity:
[Describe acute toxicity studies and results]

Repeat-Dose Toxicity:
[Describe 28-day, 90-day, or 6-month toxicity studies]

Genetic Toxicology:
[Describe mutagenicity and genotoxicity studies]

Reproductive Toxicology:
[Describe fertility and developmental toxicity studies]

Other Toxicology Studies:
[Describe any additional toxicology studies]

Conclusions:
[Summarize toxicology findings and implications for human safety]`,
                guidance: 'Include all relevant nonclinical safety data'
              }
            ]
          },
          {
            id: 'previous-human-experience',
            title: 'Previous Human Experience',
            required: false,
            guidance: 'Include data from prior human studies if available',
            subsections: [
              {
                id: 'prior-studies',
                title: 'Prior Human Studies',
                placeholder: 'Describe any previous clinical experience with the drug',
                content: `PREVIOUS HUMAN EXPERIENCE

Prior Clinical Studies:
[Describe any prior clinical studies conducted with this drug]

Study Results:
[Summarize results from prior studies]

Safety Profile:
[Describe the safety profile observed in prior studies]

Adverse Events:
[List any adverse events observed]

Regulatory History:
[Describe any prior regulatory submissions or approvals]`,
                guidance: 'Include all relevant prior human experience data'
              }
            ]
          },
          {
            id: 'protocol',
            title: 'Clinical Protocol(s)',
            required: true,
            guidance: 'Provide detailed protocol(s) for proposed clinical investigation',
            subsections: [
              {
                id: 'protocol-summary',
                title: 'Protocol Summary',
                placeholder: 'Provide overview of clinical protocol',
                content: `CLINICAL PROTOCOL SUMMARY

Protocol Title: [PROTOCOL TITLE]
Protocol Number: [NUMBER]
Version Date: [DATE]

Objectives:
[Primary and secondary objectives]

Study Design:
[Describe study design, duration, and phases]

Patient Population:
[Describe inclusion/exclusion criteria]

Dosage and Administration:
[Describe dosing regimen]

Safety Monitoring:
[Describe safety monitoring procedures]

Statistical Analysis:
[Describe statistical analysis plan]`,
                guidance: 'Provide comprehensive protocol overview'
              }
            ]
          },
          {
            id: 'investigator-brochure',
            title: 'Investigator\'s Brochure',
            required: true,
            guidance: 'Provide comprehensive information about the investigational drug',
            subsections: [
              {
                id: 'ib-content',
                title: 'IB Content',
                placeholder: 'Provide investigator\'s brochure content',
                content: `INVESTIGATOR'S BROCHURE

1. DRUG SUBSTANCE AND DRUG PRODUCT
[Describe drug substance and formulation]

2. NONCLINICAL OVERVIEW AND SUMMARIES
[Summarize nonclinical studies]

3. CLINICAL OVERVIEW AND SUMMARIES
[Summarize clinical data]

4. RECENT LITERATURE AND OTHER INFORMATION
[Cite relevant literature]

5. GUIDANCE FOR THE INVESTIGATOR
[Provide guidance for safe conduct of studies]`,
                guidance: 'Follow IB format requirements'
              }
            ]
          }
        ],
        complianceChecklist: [
          { id: 'form-1571', item: 'Form FDA 1571 completed', description: 'All required fields filled', required: true },
          { id: 'cmc-data', item: 'CMC data provided', description: 'Chemistry, manufacturing, and controls information', required: true },
          { id: 'pharm-tox', item: 'Pharmacology and toxicology data', description: 'Nonclinical safety data', required: true },
          { id: 'protocol', item: 'Clinical protocol(s)', description: 'Detailed study protocol(s)', required: true },
          { id: 'ib', item: 'Investigator\'s Brochure', description: 'Comprehensive IB', required: true },
          { id: 'prior-human', item: 'Prior human experience', description: 'If applicable', required: false },
          { id: 'financial', item: 'Financial disclosure forms', description: 'Form FDA 3454 and 3455', required: true }
        ]
      },
      euEma: {
        title: 'IND Application - EU EMA',
        regulatoryNotes: 'Submitted under EudraCT and EMA guidelines. Required for clinical trials in EU member states.',
        sections: [
          {
            id: 'clinical-trial-app',
            title: 'Clinical Trial Application',
            required: true,
            guidance: 'Complete EudraCT database entry and submit to competent authorities',
            subsections: [
              {
                id: 'eudract-info',
                title: 'EudraCT Information',
                placeholder: 'Enter EudraCT protocol information',
                content: `EudraCT PROTOCOL INFORMATION

EudraCT Number: [NUMBER]
Protocol Title: [TITLE]
Protocol Version: [VERSION]
Study Start Date: [DATE]

Sponsor Information:
[Company name and contact details]

Investigator Information:
[Principal investigator details]

Study Sites:
[List of participating sites and countries]`,
                guidance: 'Register in EudraCT database'
              },
              {
                id: 'protocol-eu',
                title: 'Clinical Protocol',
                placeholder: 'Provide EU-compliant clinical protocol',
                content: `CLINICAL PROTOCOL - EU FORMAT

1. PROTOCOL SYNOPSIS
[Executive summary of protocol]

2. BACKGROUND AND RATIONALE
[Scientific background and justification]

3. STUDY OBJECTIVES AND ENDPOINTS
[Primary and secondary objectives]

4. STUDY DESIGN
[Detailed study design description]

5. STUDY POPULATION
[Inclusion/exclusion criteria]

6. STUDY TREATMENT
[Investigational medicinal product details]

7. SAFETY MONITORING
[Safety assessments and stopping rules]

8. STATISTICAL METHODS
[Statistical analysis plan]`,
                guidance: 'Follow EMA guideline format'
              }
            ]
          },
          {
            id: 'quality-overall',
            title: 'Quality Overall Summary',
            required: true,
            guidance: 'Provide quality information according to EMA guidelines',
            subsections: [
              {
                id: 'quality-summary',
                title: 'Quality Summary',
                placeholder: 'Describe drug substance and product quality',
                content: `QUALITY OVERALL SUMMARY

1. DRUG SUBSTANCE
[Description of drug substance]

2. DRUG PRODUCT
[Description of drug product and formulation]

3. ANALYTICAL METHODS
[Analytical methods and validation]

4. STABILITY DATA
[Stability testing results]

5. CONTAINER CLOSURE SYSTEM
[Description of container and closure]`,
                guidance: 'Include all quality information'
              }
            ]
          },
          {
            id: 'safety-pharmacology',
            title: 'Safety and Pharmacology',
            required: true,
            guidance: 'Provide comprehensive safety and pharmacology data',
            subsections: [
              {
                id: 'safety-pharm',
                title: 'Safety and Pharmacology Data',
                placeholder: 'Summarize safety and pharmacology studies',
                content: `SAFETY AND PHARMACOLOGY

1. PHARMACOLOGY
[Mechanism of action and pharmacodynamics]

2. PHARMACOKINETICS
[Absorption, distribution, metabolism, excretion]

3. TOXICOLOGY
[Acute, repeat-dose, genetic, reproductive toxicity]

4. SAFETY MARGINS
[Comparison of animal and human doses]

5. RISK ASSESSMENT
[Risk assessment for human studies]`,
                guidance: 'Follow EMA safety assessment guidelines'
              }
            ]
          }
        ],
        complianceChecklist: [
          { id: 'eudract', item: 'EudraCT registration', description: 'Registered in EudraCT database', required: true },
          { id: 'protocol-eu', item: 'Clinical protocol', description: 'EU-compliant protocol', required: true },
          { id: 'quality', item: 'Quality Overall Summary', description: 'QOS document', required: true },
          { id: 'safety-pharm', item: 'Safety and Pharmacology', description: 'Nonclinical safety data', required: true },
          { id: 'ib-eu', item: 'Investigator\'s Brochure', description: 'Current IB', required: true },
          { id: 'insurance', item: 'Insurance/Compensation', description: 'Proof of insurance', required: true }
        ]
      }
    }
  },
  {
    id: 'bla-template',
    name: 'Biologics License Application (BLA)',
    description: 'Application for approval to market a biologic product in the United States',
    type: 'BLA',
    icon: '🧬',
    estimatedPages: 100,
    standards: {
      usFda: {
        title: 'BLA - US FDA',
        regulatoryNotes: 'Submitted under 21 CFR 601. Required for biologics approval in the United States.',
        sections: [
          {
            id: 'bla-form',
            title: 'Form FDA 356H - BLA',
            required: true,
            guidance: 'Complete BLA application form',
            subsections: [
              {
                id: 'bla-cover',
                title: 'BLA Cover Letter',
                placeholder: 'Enter BLA cover letter and submission information',
                content: `BIOLOGICS LICENSE APPLICATION COVER LETTER

Date: [DATE]
To: Center for Drug Evaluation and Research / Center for Biologics Evaluation and Research
Food and Drug Administration
[ADDRESS]

RE: Biologics License Application (BLA) for [PRODUCT NAME]
BLA Number: [BLA NUMBER]

Dear Sir/Madam:

[Company Name] hereby submits this Biologics License Application for [Product Name], a [description of biologic].

This BLA is submitted under 21 CFR 601 and includes:
- Form FDA 356H
- Chemistry and Manufacturing Controls (CMC) information
- Nonclinical Laboratory and Animal Study Data
- Human Pharmacology and Bioavailability Data
- Microbiology Data
- Clinical Microbiology Data
- Clinical Data
- Case Report Forms and Tabulations
- Statistical Section
- Case Report Narratives
- Deviations from Protocol

[Additional submission details]`,
                guidance: 'Include complete submission information'
              },
              {
                id: 'product-info',
                title: 'Product Information',
                placeholder: 'Describe the biologic product',
                content: `BIOLOGIC PRODUCT INFORMATION

Product Name: [PRODUCT NAME]
Established Name: [ESTABLISHED NAME]
Dosage Form: [FORM]
Route of Administration: [ROUTE]
Strength: [STRENGTH]
Indication: [INDICATION]

Manufacturing Cell Line:
[Description of cell line and origin]

Biological Source Material:
[Description of source material]

Manufacturing Process:
[Overview of manufacturing process]

Quality Control:
[Quality control procedures and specifications]`,
                guidance: 'Provide comprehensive product information'
              }
            ]
          },
          {
            id: 'cmc-biologic',
            title: 'Chemistry, Manufacturing, and Controls',
            required: true,
            guidance: 'Provide detailed CMC information for biologic',
            subsections: [
              {
                id: 'drug-substance',
                title: 'Drug Substance',
                placeholder: 'Describe drug substance characterization',
                content: `DRUG SUBSTANCE

Characterization:
[Complete characterization of drug substance]

Stability:
[Stability data under various conditions]

Specification:
[Proposed specification and acceptance criteria]

Analytical Methods:
[Analytical methods and validation]

Impurities:
[Characterization of impurities and process-related impurities]`,
                guidance: 'Include comprehensive drug substance data'
              },
              {
                id: 'drug-product',
                title: 'Drug Product',
                placeholder: 'Describe drug product formulation and manufacturing',
                content: `DRUG PRODUCT

Formulation:
[Complete formulation with all components]

Manufacturing Process:
[Detailed manufacturing process description]

Process Validation:
[Process validation studies and results]

Stability:
[Long-term, intermediate, and accelerated stability data]

Container Closure:
[Description and qualification of container closure system]

Specification:
[Proposed specification and acceptance criteria]`,
                guidance: 'Include all drug product information'
              }
            ]
          },
          {
            id: 'nonclinical',
            title: 'Nonclinical Laboratory and Animal Study Data',
            required: true,
            guidance: 'Provide nonclinical safety and pharmacology data',
            subsections: [
              {
                id: 'nonclin-summary',
                title: 'Nonclinical Summary',
                placeholder: 'Summarize nonclinical studies',
                content: `NONCLINICAL LABORATORY AND ANIMAL STUDY DATA

Pharmacology:
[Mechanism of action and pharmacodynamic studies]

Pharmacokinetics:
[Absorption, distribution, metabolism, excretion]

Toxicology:
[Acute, subchronic, chronic, and special toxicity studies]

Reproductive Toxicology:
[Fertility and developmental toxicity studies]

Genotoxicity:
[Genetic toxicology studies]

Carcinogenicity:
[Carcinogenicity studies if applicable]`,
                guidance: 'Include all relevant nonclinical data'
              }
            ]
          },
          {
            id: 'clinical-data',
            title: 'Clinical Data',
            required: true,
            guidance: 'Provide comprehensive clinical trial data',
            subsections: [
              {
                id: 'clinical-summary',
                title: 'Clinical Summary',
                placeholder: 'Summarize clinical trial results',
                content: `CLINICAL DATA SUMMARY

Study Overview:
[Summary of all clinical studies conducted]

Study Results:
[Efficacy and safety results from clinical trials]

Adverse Events:
[Summary of adverse events observed]

Pharmacokinetics:
[Human pharmacokinetic data]

Special Populations:
[Data in special populations if available]

Comparative Effectiveness:
[Comparison with existing therapies]

Risk-Benefit Assessment:
[Overall risk-benefit assessment]`,
                guidance: 'Include all clinical trial data'
              }
            ]
          }
        ],
        complianceChecklist: [
          { id: 'form-356h', item: 'Form FDA 356H', description: 'BLA application form', required: true },
          { id: 'cmc-bla', item: 'CMC Data', description: 'Complete CMC information', required: true },
          { id: 'nonclin-bla', item: 'Nonclinical Data', description: 'Pharmacology and toxicology', required: true },
          { id: 'clinical-bla', item: 'Clinical Data', description: 'Clinical trial results', required: true },
          { id: 'case-reports', item: 'Case Report Forms', description: 'CRF and tabulations', required: true },
          { id: 'statistical', item: 'Statistical Section', description: 'Statistical analysis', required: true },
          { id: 'financial-bla', item: 'Financial Disclosure', description: 'Form FDA 3454 and 3455', required: true }
        ]
      },
      euEma: {
        title: 'BLA - EU EMA',
        regulatoryNotes: 'Submitted under EMA centralized procedure. Required for biologic approval in EU.',
        sections: [
          {
            id: 'ema-application',
            title: 'EMA Application',
            required: true,
            guidance: 'Complete EMA application for biologic',
            subsections: [
              {
                id: 'ema-cover',
                title: 'Application Cover Letter',
                placeholder: 'Enter EMA application cover letter',
                content: `EMA BIOLOGIC APPLICATION COVER LETTER

Date: [DATE]
To: European Medicines Agency
Committee for Medicinal Products for Human Use (CHMP)
[ADDRESS]

RE: Marketing Authorization Application for [PRODUCT NAME]

Dear Sir/Madam:

[Company Name] hereby submits this Marketing Authorization Application for [Product Name].

This application is submitted under the centralized procedure and includes:
- Application Form
- Quality Overall Summary
- Nonclinical Overview and Summaries
- Clinical Overview and Summaries
- Clinical Efficacy and Safety Data
- Risk Management Plan
- Proposed Labeling

[Additional details]`,
                guidance: 'Include complete application information'
              }
            ]
          },
          {
            id: 'quality-ema',
            title: 'Quality Overall Summary',
            required: true,
            guidance: 'Provide quality information per EMA guidelines',
            subsections: [
              {
                id: 'quality-ema-detail',
                title: 'Quality Information',
                placeholder: 'Describe quality data for biologic',
                content: `QUALITY OVERALL SUMMARY

1. DRUG SUBSTANCE
[Complete characterization of drug substance]

2. DRUG PRODUCT
[Complete description of drug product]

3. ANALYTICAL METHODS
[Analytical methods and validation]

4. STABILITY
[Stability data and conditions]

5. CONTAINER CLOSURE
[Container closure system]`,
                guidance: 'Follow EMA quality guidelines'
              }
            ]
          }
        ],
        complianceChecklist: [
          { id: 'ema-app', item: 'EMA Application', description: 'Complete application', required: true },
          { id: 'quality-ema', item: 'Quality Data', description: 'QOS and CMC', required: true },
          { id: 'nonclin-ema', item: 'Nonclinical Data', description: 'Safety and pharmacology', required: true },
          { id: 'clinical-ema', item: 'Clinical Data', description: 'Clinical trial results', required: true },
          { id: 'rmp', item: 'Risk Management Plan', description: 'RMP document', required: true }
        ]
      }
    }
  },
  {
    id: 'nda-template',
    name: 'New Drug Application (NDA)',
    description: 'Application for approval to market a new chemical drug product',
    type: 'NDA',
    icon: '💊',
    estimatedPages: 75,
    standards: {
      usFda: {
        title: 'NDA - US FDA',
        regulatoryNotes: 'Submitted under 21 CFR 314. Required for new drug approval in the United States.',
        sections: [
          {
            id: 'nda-form',
            title: 'Form FDA 356H - NDA',
            required: true,
            guidance: 'Complete NDA application form',
            subsections: [
              {
                id: 'nda-cover',
                title: 'NDA Cover Letter',
                placeholder: 'Enter NDA cover letter and submission information',
                content: `NEW DRUG APPLICATION COVER LETTER

Date: [DATE]
To: Center for Drug Evaluation and Research
Food and Drug Administration
[ADDRESS]

RE: New Drug Application (NDA) for [DRUG NAME]
NDA Number: [NDA NUMBER]

Dear Sir/Madam:

[Company Name] hereby submits this New Drug Application for [Drug Name] ([Generic Name]), a [drug class] indicated for the treatment of [indication].

This NDA is submitted under 21 CFR 314 and includes:
- Form FDA 356H
- Chemistry and Manufacturing Controls (CMC) information
- Nonclinical Laboratory and Animal Study Data
- Human Pharmacology and Bioavailability Data
- Microbiology Data (if applicable)
- Clinical Microbiology Data (if applicable)
- Clinical Data
- Case Report Forms and Tabulations
- Statistical Section
- Case Report Narratives
- Deviations from Protocol

[Additional submission details]`,
                guidance: 'Include complete submission information'
              },
              {
                id: 'drug-info-nda',
                title: 'Drug Information',
                placeholder: 'Describe the drug product',
                content: `DRUG PRODUCT INFORMATION

Drug Name: [DRUG NAME]
Generic Name: [GENERIC NAME]
Chemical Name: [CHEMICAL NAME]
CAS Number: [CAS NUMBER]
Molecular Formula: [FORMULA]
Molecular Weight: [WEIGHT]

Dosage Form: [FORM]
Strength: [STRENGTH]
Route of Administration: [ROUTE]
Proposed Indication: [INDICATION]
Proposed Dose and Duration: [DOSE INFORMATION]`,
                guidance: 'Provide complete drug information'
              }
            ]
          },
          {
            id: 'cmc-nda',
            title: 'Chemistry, Manufacturing, and Controls',
            required: true,
            guidance: 'Provide detailed CMC information',
            subsections: [
              {
                id: 'drug-sub-nda',
                title: 'Drug Substance',
                placeholder: 'Describe drug substance',
                content: `DRUG SUBSTANCE

Structure and Nomenclature:
[Chemical structure and nomenclature]

Characterization:
[Complete characterization of drug substance]

Stability:
[Stability data under various conditions]

Specification:
[Proposed specification and acceptance criteria]

Analytical Methods:
[Analytical methods and validation]`,
                guidance: 'Include comprehensive drug substance data'
              },
              {
                id: 'drug-prod-nda',
                title: 'Drug Product',
                placeholder: 'Describe drug product formulation',
                content: `DRUG PRODUCT

Formulation:
[Complete formulation with all components and amounts]

Manufacturing Process:
[Detailed manufacturing process description]

Process Validation:
[Process validation studies and results]

Stability:
[Long-term, intermediate, and accelerated stability data]

Container Closure:
[Description and qualification of container closure system]

Specification:
[Proposed specification and acceptance criteria]`,
                guidance: 'Include all drug product information'
              }
            ]
          },
          {
            id: 'nonclinical-nda',
            title: 'Nonclinical Laboratory and Animal Study Data',
            required: true,
            guidance: 'Provide nonclinical safety data',
            subsections: [
              {
                id: 'nonclin-nda',
                title: 'Nonclinical Data Summary',
                placeholder: 'Summarize nonclinical studies',
                content: `NONCLINICAL LABORATORY AND ANIMAL STUDY DATA

Pharmacology:
[Mechanism of action and pharmacodynamic studies]

Pharmacokinetics:
[Absorption, distribution, metabolism, excretion]

Toxicology:
[Acute, subchronic, chronic toxicity studies]

Reproductive Toxicology:
[Fertility and developmental toxicity studies]

Genotoxicity:
[Genetic toxicology studies]

Carcinogenicity:
[Carcinogenicity studies if applicable]`,
                guidance: 'Include all relevant nonclinical data'
              }
            ]
          },
          {
            id: 'clinical-nda',
            title: 'Clinical Data',
            required: true,
            guidance: 'Provide comprehensive clinical trial data',
            subsections: [
              {
                id: 'clinical-nda-sum',
                title: 'Clinical Summary',
                placeholder: 'Summarize clinical trial results',
                content: `CLINICAL DATA SUMMARY

Study Overview:
[Summary of all clinical studies conducted]

Phase I Studies:
[Pharmacology and safety in healthy volunteers]

Phase II Studies:
[Preliminary efficacy and safety in patient population]

Phase III Studies:
[Efficacy and safety in intended population]

Study Results:
[Primary and secondary endpoint results]

Adverse Events:
[Summary of adverse events observed]

Risk-Benefit Assessment:
[Overall risk-benefit assessment]`,
                guidance: 'Include all clinical trial data'
              }
            ]
          }
        ],
        complianceChecklist: [
          { id: 'form-356h-nda', item: 'Form FDA 356H', description: 'NDA application form', required: true },
          { id: 'cmc-nda', item: 'CMC Data', description: 'Complete CMC information', required: true },
          { id: 'nonclin-nda', item: 'Nonclinical Data', description: 'Pharmacology and toxicology', required: true },
          { id: 'clinical-nda', item: 'Clinical Data', description: 'Clinical trial results', required: true },
          { id: 'case-reports-nda', item: 'Case Report Forms', description: 'CRF and tabulations', required: true },
          { id: 'statistical-nda', item: 'Statistical Section', description: 'Statistical analysis', required: true },
          { id: 'financial-nda', item: 'Financial Disclosure', description: 'Form FDA 3454 and 3455', required: true }
        ]
      },
      euEma: {
        title: 'NDA - EU EMA',
        regulatoryNotes: 'Submitted under EMA centralized procedure. Required for drug approval in EU.',
        sections: [
          {
            id: 'ema-app-nda',
            title: 'EMA Application',
            required: true,
            guidance: 'Complete EMA application for new drug',
            subsections: [
              {
                id: 'ema-cover-nda',
                title: 'Application Cover Letter',
                placeholder: 'Enter EMA application cover letter',
                content: `EMA MARKETING AUTHORIZATION APPLICATION COVER LETTER

Date: [DATE]
To: European Medicines Agency
Committee for Medicinal Products for Human Use (CHMP)
[ADDRESS]

RE: Marketing Authorization Application for [DRUG NAME]

Dear Sir/Madam:

[Company Name] hereby submits this Marketing Authorization Application for [Drug Name].

This application is submitted under the centralized procedure and includes:
- Application Form
- Quality Overall Summary
- Nonclinical Overview and Summaries
- Clinical Overview and Summaries
- Clinical Efficacy and Safety Data
- Risk Management Plan
- Proposed Labeling

[Additional details]`,
                guidance: 'Include complete application information'
              }
            ]
          },
          {
            id: 'quality-nda-ema',
            title: 'Quality Overall Summary',
            required: true,
            guidance: 'Provide quality information per EMA guidelines',
            subsections: [
              {
                id: 'quality-nda-ema-detail',
                title: 'Quality Information',
                placeholder: 'Describe quality data for drug',
                content: `QUALITY OVERALL SUMMARY

1. DRUG SUBSTANCE
[Complete characterization of drug substance]

2. DRUG PRODUCT
[Complete description of drug product]

3. ANALYTICAL METHODS
[Analytical methods and validation]

4. STABILITY
[Stability data and conditions]

5. CONTAINER CLOSURE
[Container closure system]`,
                guidance: 'Follow EMA quality guidelines'
              }
            ]
          }
        ],
        complianceChecklist: [
          { id: 'ema-app-nda', item: 'EMA Application', description: 'Complete application', required: true },
          { id: 'quality-ema-nda', item: 'Quality Data', description: 'QOS and CMC', required: true },
          { id: 'nonclin-ema-nda', item: 'Nonclinical Data', description: 'Safety and pharmacology', required: true },
          { id: 'clinical-ema-nda', item: 'Clinical Data', description: 'Clinical trial results', required: true },
          { id: 'rmp-nda', item: 'Risk Management Plan', description: 'RMP document', required: true }
        ]
      }
    }
  }
];

// Helper function to get template by ID
export const getTemplateById = (id: string): RegulatoryTemplate | undefined => {
  return regulatoryTemplates.find(template => template.id === id);
};

// Helper function to get template content based on standard
export const getTemplateContent = (templateId: string, standard: 'usFda' | 'euEma'): TemplateContent | undefined => {
  const template = getTemplateById(templateId);
  return template ? template.standards[standard] : undefined;
};

// Helper function to generate document from template
export const generateDocumentFromTemplate = (templateId: string, standard: 'usFda' | 'euEma'): string => {
  const content = getTemplateContent(templateId, standard);
  if (!content) return '';

  let document = `# ${content.title}\n\n`;
  document += `**Regulatory Notes:** ${content.regulatoryNotes}\n\n`;

  content.sections.forEach(section => {
    document += `## ${section.title}\n\n`;
    document += `**Guidance:** ${section.guidance}\n`;
    document += `**Required:** ${section.required ? 'Yes' : 'No'}\n\n`;

    section.subsections.forEach(subsection => {
      document += `### ${subsection.title}\n\n`;
      document += `**Guidance:** ${subsection.guidance}\n\n`;
      document += subsection.content + '\n\n';
    });
  });

  document += `## Compliance Checklist\n\n`;
  content.complianceChecklist.forEach(item => {
    const checked = item.required ? '✓' : '○';
    document += `- [${checked}] ${item.item}: ${item.description}\n`;
  });

  return document;
};
