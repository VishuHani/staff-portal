/**
 * Compliance Rules Database
 * 
 * Built-in compliance requirements for common form types across different regions.
 * This provides a baseline of requirements that can be enhanced by web research.
 */

// ============================================================================
// Types
// ============================================================================

export type FormCategory = 
  | 'employment-application'
  | 'employee-onboarding'
  | 'medical-patient'
  | 'financial-application'
  | 'legal-contract'
  | 'survey-feedback'
  | 'event-registration'
  | 'membership-application'
  | 'insurance-claim'
  | 'government-form'
  | 'educational-enrollment'
  | 'vendor-registration'
  | 'general';

export type Region = 'US' | 'EU' | 'AU' | 'UK' | 'CA' | 'NZ' | 'GLOBAL';

export interface ComplianceRule {
  /** Unique identifier for the rule */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Description of the requirement */
  description: string;
  /** Fields that must be included */
  requiredFields: string[];
  /** Fields that should NOT be included */
  prohibitedFields: string[];
  /** Required notices or disclaimers */
  requiredNotices: string[];
  /** Validation requirements */
  validationRules: {
    field: string;
    rule: string;
    message: string;
  }[];
  /** Links to official sources */
  sources: {
    name: string;
    url: string;
  }[];
}

export interface RegionCompliance {
  /** Region code */
  region: Region;
  /** Compliance rules for this region */
  rules: ComplianceRule[];
  /** General requirements */
  generalRequirements: string[];
}

// ============================================================================
// Compliance Database
// ============================================================================

export const complianceDatabase: Record<FormCategory, RegionCompliance[]> = {
  'employment-application': [
    {
      region: 'AU',
      rules: [
        {
          id: 'au-eeo',
          name: 'Equal Employment Opportunity',
          description: 'Australian anti-discrimination laws prohibit asking about certain personal attributes',
          requiredFields: [],
          prohibitedFields: [
            'age',
            'marital_status',
            'religion',
            'sexual_orientation',
            'political_opinion',
            'pregnancy_status',
            'disability_status'
          ],
          requiredNotices: [
            'We are an equal opportunity employer and value diversity'
          ],
          validationRules: [],
          sources: [
            {
              name: 'Australian Human Rights Commission',
              url: 'https://humanrights.gov.au/our-work/employers/guides/employment'
            }
          ]
        },
        {
          id: 'au-privacy',
          name: 'Privacy Act 1988',
          description: 'Collection and handling of personal information must comply with Australian Privacy Principles',
          requiredFields: [],
          prohibitedFields: [],
          requiredNotices: [
            'Privacy collection statement explaining why information is collected',
            'How information will be used and disclosed'
          ],
          validationRules: [
            {
              field: 'email',
              rule: 'email',
              message: 'Please enter a valid email address'
            }
          ],
          sources: [
            {
              name: 'Office of the Australian Information Commissioner',
              url: 'https://www.oaic.gov.au/privacy/australian-privacy-principles'
            }
          ]
        }
      ],
      generalRequirements: [
        'Include privacy collection notice',
        'Allow applicants to request access to their information',
        'Provide complaint mechanism for privacy issues'
      ]
    },
    {
      region: 'US',
      rules: [
        {
          id: 'us-eeo',
          name: 'Equal Employment Opportunity',
          description: 'US anti-discrimination laws prohibit certain questions',
          requiredFields: [],
          prohibitedFields: [
            'race',
            'color',
            'religion',
            'sex',
            'national_origin',
            'age',
            'disability',
            'genetic_information'
          ],
          requiredNotices: [
            'EEO statement: We are an equal opportunity employer'
          ],
          validationRules: [],
          sources: [
            {
              name: 'EEOC',
              url: 'https://www.eeoc.gov/employers/small-business'
            }
          ]
        },
        {
          id: 'us-ada',
          name: 'Americans with Disabilities Act',
          description: 'Cannot ask about disabilities before job offer',
          requiredFields: [],
          prohibitedFields: [
            'disability_status',
            'medical_conditions'
          ],
          requiredNotices: [
            'Reasonable accommodation notice for interviews'
          ],
          validationRules: [],
          sources: [
            {
              name: 'ADA',
              url: 'https://www.ada.gov/'
            }
          ]
        }
      ],
      generalRequirements: [
        'Include EEO statement',
        'Provide reasonable accommodation notice',
        'Include at-will employment disclaimer if applicable'
      ]
    },
    {
      region: 'EU',
      rules: [
        {
          id: 'eu-gdpr',
          name: 'GDPR Compliance',
          description: 'General Data Protection Regulation requirements',
          requiredFields: [
            'gdpr_consent'
          ],
          prohibitedFields: [],
          requiredNotices: [
            'Clear explanation of data processing purposes',
            'Legal basis for processing',
            'Data retention period',
            'Right to erasure notice',
            'Right to data portability notice'
          ],
          validationRules: [
            {
              field: 'gdpr_consent',
              rule: 'required',
              message: 'Consent is required under GDPR'
            }
          ],
          sources: [
            {
              name: 'GDPR.eu',
              url: 'https://gdpr.eu/'
            }
          ]
        }
      ],
      generalRequirements: [
        'Explicit consent checkbox for data processing',
        'Privacy policy link',
        'Cookie consent if applicable',
        'Data subject rights notice'
      ]
    }
  ],

  'employee-onboarding': [
    {
      region: 'AU',
      rules: [
        {
          id: 'au-tax',
          name: 'Tax File Number Declaration',
          description: 'Required tax information for employment',
          requiredFields: [
            'tax_file_number',
            'australian_resident_status',
            'tax_free_threshold_claim'
          ],
          prohibitedFields: [],
          requiredNotices: [
            'TFN is optional but may result in higher tax withholding'
          ],
          validationRules: [],
          sources: [
            {
              name: 'ATO',
              url: 'https://www.ato.gov.au/'
            }
          ]
        },
        {
          id: 'au-super',
          name: 'Superannuation',
          description: 'Superannuation fund details required',
          requiredFields: [
            'superannuation_fund_name',
            'superannuation_member_number',
            'superannuation_fund_abn'
          ],
          prohibitedFields: [],
          requiredNotices: [
            'Employer must contribute to employee superannuation fund'
          ],
          validationRules: [],
          sources: [
            {
              name: 'ATO Superannuation',
              url: 'https://www.ato.gov.au/individuals/super/'
            }
          ]
        },
        {
          id: 'au-fair-work',
          name: 'Fair Work Information Statement',
          description: 'Must provide Fair Work Information Statement',
          requiredFields: [],
          prohibitedFields: [],
          requiredNotices: [
            'Fair Work Information Statement must be provided to new employees'
          ],
          validationRules: [],
          sources: [
            {
              name: 'Fair Work Ombudsman',
              url: 'https://www.fairwork.gov.au/'
            }
          ]
        }
      ],
      generalRequirements: [
        'Emergency contact details',
        'Bank account for salary payment',
        'Superannuation fund details',
        'Fair Work Information Statement acknowledgment'
      ]
    }
  ],

  'medical-patient': [
    {
      region: 'US',
      rules: [
        {
          id: 'us-hipaa',
          name: 'HIPAA Privacy Rule',
          description: 'Health Insurance Portability and Accountability Act requirements',
          requiredFields: [],
          prohibitedFields: [],
          requiredNotices: [
            'Notice of Privacy Practices',
            'Patient rights under HIPAA',
            'How PHI will be used and disclosed'
          ],
          validationRules: [
            {
              field: 'ssn',
              rule: 'encrypted',
              message: 'SSN must be encrypted at rest and in transit'
            }
          ],
          sources: [
            {
              name: 'HHS HIPAA',
              url: 'https://www.hhs.gov/hipaa/'
            }
          ]
        }
      ],
      generalRequirements: [
        'HIPAA Notice of Privacy Practices',
        'Patient consent for treatment',
        'Authorization for release of information',
        'Emergency contact information'
      ]
    },
    {
      region: 'AU',
      rules: [
        {
          id: 'au-health-records',
          name: 'Health Records Act',
          description: 'Victorian Health Records Act requirements',
          requiredFields: [],
          prohibitedFields: [],
          requiredNotices: [
            'Collection notice for health information',
            'Purpose of collection',
            'How to access health records'
          ],
          validationRules: [],
          sources: [
            {
              name: 'Health Complaints Commissioner',
              url: 'https://hcc.vic.gov.au/'
            }
          ]
        }
      ],
      generalRequirements: [
        'Medicare number (optional)',
        'Private health insurance details',
        'Emergency contact',
        'Medical history consent'
      ]
    }
  ],

  'financial-application': [
    {
      region: 'AU',
      rules: [
        {
          id: 'au-aml-ctf',
          name: 'Anti-Money Laundering',
          description: 'AML/CTF requirements for financial services',
          requiredFields: [
            'full_legal_name',
            'date_of_birth',
            'residential_address',
            'identification_document'
          ],
          prohibitedFields: [],
          requiredNotices: [
            'Identification verification required',
            'Information may be verified with third parties'
          ],
          validationRules: [
            {
              field: 'date_of_birth',
              rule: 'minAge:18',
              message: 'Must be 18 years or older'
            }
          ],
          sources: [
            {
              name: 'AUSTRAC',
              url: 'https://www.austrac.gov.au/'
            }
          ]
        }
      ],
      generalRequirements: [
        '100 point ID check',
        'Proof of income',
        'Credit history consent',
        'Terms and conditions acceptance'
      ]
    }
  ],

  'legal-contract': [
    {
      region: 'GLOBAL',
      rules: [
        {
          id: 'contract-basics',
          name: 'Contract Fundamentals',
          description: 'Basic requirements for valid contracts',
          requiredFields: [
            'party_names',
            'agreement_date',
            'signature',
            'terms_acceptance'
          ],
          prohibitedFields: [],
          requiredNotices: [
            'Consider seeking legal advice before signing'
          ],
          validationRules: [],
          sources: []
        }
      ],
      generalRequirements: [
        'Clear identification of parties',
        'Consideration (what each party gives/receives)',
        'Terms and conditions',
        'Signature blocks for all parties',
        'Date of agreement'
      ]
    }
  ],

  'survey-feedback': [
    {
      region: 'GLOBAL',
      rules: [
        {
          id: 'survey-ethics',
          name: 'Survey Ethics',
          description: 'Ethical guidelines for surveys',
          requiredFields: [],
          prohibitedFields: [],
          requiredNotices: [
            'Participation is voluntary',
            'How data will be used',
            'Estimated completion time'
          ],
          validationRules: [],
          sources: []
        }
      ],
      generalRequirements: [
        'Clear purpose statement',
        'Estimated time to complete',
        'Voluntary participation notice',
        'Privacy statement',
        'Contact for questions'
      ]
    }
  ],

  'event-registration': [
    {
      region: 'GLOBAL',
      rules: [
        {
          id: 'event-basics',
          name: 'Event Registration Basics',
          description: 'Standard event registration requirements',
          requiredFields: [
            'attendee_name',
            'attendee_email'
          ],
          prohibitedFields: [],
          requiredNotices: [
            'Cancellation/refund policy',
            'Event terms and conditions'
          ],
          validationRules: [],
          sources: []
        }
      ],
      generalRequirements: [
        'Attendee contact information',
        'Dietary requirements (if applicable)',
        'Special needs/accessibility requirements',
        'Emergency contact for multi-day events'
      ]
    }
  ],

  'membership-application': [
    {
      region: 'GLOBAL',
      rules: [
        {
          id: 'membership-basics',
          name: 'Membership Application Basics',
          description: 'Standard membership requirements',
          requiredFields: [
            'member_name',
            'member_email',
            'membership_type'
          ],
          prohibitedFields: [],
          requiredNotices: [
            'Membership terms and conditions',
            'Fee structure',
            'Cancellation policy'
          ],
          validationRules: [],
          sources: []
        }
      ],
      generalRequirements: [
        'Membership category selection',
        'Payment information',
        'Terms and conditions acceptance',
        'Privacy notice'
      ]
    }
  ],

  'insurance-claim': [
    {
      region: 'AU',
      rules: [
        {
          id: 'au-insurance-claim',
          name: 'Insurance Claim Requirements',
          description: 'Requirements for insurance claims',
          requiredFields: [
            'policy_number',
            'incident_date',
            'incident_description',
            'claim_amount'
          ],
          prohibitedFields: [],
          requiredNotices: [
            'Fraud warning statement',
            'Claim processing timeline'
          ],
          validationRules: [],
          sources: [
            {
              name: 'ASIC',
              url: 'https://www.asic.gov.au/'
            }
          ]
        }
      ],
      generalRequirements: [
        'Policy holder details',
        'Incident details',
        'Supporting documentation',
        'Fraud warning'
      ]
    }
  ],

  'government-form': [
    {
      region: 'AU',
      rules: [
        {
          id: 'au-gov-forms',
          name: 'Australian Government Form Requirements',
          description: 'Standards for government forms',
          requiredFields: [],
          prohibitedFields: [],
          requiredNotices: [
            'Privacy collection statement',
            'Authority to collect information'
          ],
          validationRules: [],
          sources: [
            {
              name: 'Digital Service Standard',
              url: 'https://www.dta.gov.au/help-and-advice/digital-service-standard'
            }
          ]
        }
      ],
      generalRequirements: [
        'Clear purpose statement',
        'Privacy collection notice',
        'Agency contact details',
        'Complaint mechanism'
      ]
    }
  ],

  'educational-enrollment': [
    {
      region: 'AU',
      rules: [
        {
          id: 'au-education',
          name: 'Educational Enrollment Requirements',
          description: 'Requirements for student enrollment',
          requiredFields: [
            'student_name',
            'date_of_birth',
            'guardian_contact'
          ],
          prohibitedFields: [],
          requiredNotices: [
            'Privacy statement for student records',
            'Consent for educational services'
          ],
          validationRules: [],
          sources: []
        }
      ],
      generalRequirements: [
        'Student personal details',
        'Emergency contacts',
        'Medical information',
        'Previous education records',
        'Parent/guardian consent (minors)'
      ]
    }
  ],

  'vendor-registration': [
    {
      region: 'AU',
      rules: [
        {
          id: 'au-vendor',
          name: 'Vendor Registration Requirements',
          description: 'Requirements for vendor/supplier registration',
          requiredFields: [
            'business_name',
            'abn',
            'contact_person',
            'bank_details'
          ],
          prohibitedFields: [],
          requiredNotices: [
            'Terms of trade',
            'Privacy statement'
          ],
          validationRules: [
            {
              field: 'abn',
              rule: 'abn',
              message: 'Please enter a valid ABN'
            }
          ],
          sources: [
            {
              name: 'ABR',
              url: 'https://abr.business.gov.au/'
            }
          ]
        }
      ],
      generalRequirements: [
        'Business details',
        'ABN/ACN',
        'Bank details for payment',
        'Insurance certificates',
        'Terms and conditions'
      ]
    }
  ],

  'general': [
    {
      region: 'GLOBAL',
      rules: [
        {
          id: 'general-privacy',
          name: 'General Privacy',
          description: 'Basic privacy requirements for any form',
          requiredFields: [],
          prohibitedFields: [],
          requiredNotices: [
            'Why information is being collected',
            'How it will be used'
          ],
          validationRules: [],
          sources: []
        }
      ],
      generalRequirements: [
        'Clear purpose',
        'Privacy notice',
        'Contact information',
        'Submit confirmation'
      ]
    }
  ]
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect form category from description
 */
export function detectFormCategory(description: string): FormCategory {
  const lowerDesc = description.toLowerCase();
  
  const categoryKeywords: Record<FormCategory, string[]> = {
    'employment-application': ['job application', 'employment', 'job applicant', 'hiring', 'recruitment', 'apply for job'],
    'employee-onboarding': ['onboarding', 'new employee', 'new hire', 'employee registration', 'staff onboarding'],
    'medical-patient': ['patient', 'medical', 'health', 'hospital', 'clinic', 'healthcare', 'medical history'],
    'financial-application': ['loan', 'credit', 'mortgage', 'bank account', 'financial', 'banking'],
    'legal-contract': ['contract', 'agreement', 'legal', 'terms', 'binding'],
    'survey-feedback': ['survey', 'feedback', 'questionnaire', 'poll', 'opinion'],
    'event-registration': ['event', 'conference', 'workshop', 'seminar', 'registration', 'rsvp'],
    'membership-application': ['membership', 'member', 'join', 'subscription', 'club'],
    'insurance-claim': ['insurance', 'claim', 'policy', 'coverage', 'incident'],
    'government-form': ['government', 'official', 'department', 'agency', 'public service'],
    'educational-enrollment': ['enrollment', 'enrolment', 'student', 'school', 'university', 'course', 'education'],
    'vendor-registration': ['vendor', 'supplier', 'contractor', 'procurement', 'tender'],
    'general': []
  };
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => lowerDesc.includes(keyword))) {
      return category as FormCategory;
    }
  }
  
  return 'general';
}

/**
 * Get compliance rules for a form category and region
 */
export function getComplianceRules(
  category: FormCategory,
  region: Region = 'AU'
): RegionCompliance | null {
  const regionCompliance = complianceDatabase[category];
  if (!regionCompliance) return null;
  
  // Try to find exact region match
  const exactMatch = regionCompliance.find(rc => rc.region === region);
  if (exactMatch) return exactMatch;
  
  // Fall back to GLOBAL rules
  const globalMatch = regionCompliance.find(rc => rc.region === 'GLOBAL');
  if (globalMatch) return globalMatch;
  
  // Return first available region
  return regionCompliance[0] || null;
}

/**
 * Get all required fields for a form category
 */
export function getRequiredFields(
  category: FormCategory,
  region: Region = 'AU'
): string[] {
  const compliance = getComplianceRules(category, region);
  if (!compliance) return [];
  
  const fields = new Set<string>();
  
  for (const rule of compliance.rules) {
    for (const field of rule.requiredFields) {
      fields.add(field);
    }
  }
  
  return Array.from(fields);
}

/**
 * Get all prohibited fields for a form category
 */
export function getProhibitedFields(
  category: FormCategory,
  region: Region = 'AU'
): string[] {
  const compliance = getComplianceRules(category, region);
  if (!compliance) return [];
  
  const fields = new Set<string>();
  
  for (const rule of compliance.rules) {
    for (const field of rule.prohibitedFields) {
      fields.add(field);
    }
  }
  
  return Array.from(fields);
}

/**
 * Get all required notices for a form category
 */
export function getRequiredNotices(
  category: FormCategory,
  region: Region = 'AU'
): string[] {
  const compliance = getComplianceRules(category, region);
  if (!compliance) return [];
  
  const notices = new Set<string>();
  
  for (const rule of compliance.rules) {
    for (const notice of rule.requiredNotices) {
      notices.add(notice);
    }
  }
  
  return Array.from(notices);
}