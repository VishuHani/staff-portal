// ============================================================================
// AI Prompt Templates for Australian Workplace Forms
// ============================================================================

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  prompt: string;
  exampleFields?: string[];
  tips?: string[];
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // ============================================================================
  // Onboarding & HR Forms
  // ============================================================================
  {
    id: 'employee-onboarding',
    name: 'Employee Onboarding Form',
    description: 'New employee details, tax file declaration, and account setup',
    category: 'Onboarding',
    icon: '👤',
    prompt: `Create a comprehensive Australian employee onboarding form with the following sections:

**Personal Details:**
- Full legal name (first, middle, last)
- Preferred name
- Date of birth
- Gender (with non-binary option)
- Personal email
- Personal phone number
- Residential address (Australian format with state and postcode)

**Emergency Contact:**
- Primary contact name and relationship
- Primary contact phone
- Secondary contact (optional)

**Tax File Declaration (TFN Declaration):**
- Tax File Number (with option to provide later)
- Employment basis (full-time, part-time, casual)
- Australian resident for tax purposes (yes/no)
- Tax-free threshold claimed (yes/no)
- HELP/HECS debt (yes/no)
- Financial supplement debt (yes/no)

**Superannuation:**
- Do you have a preferred super fund? (yes/no)
- If yes: Fund name, ABN, USI, Member Number
- If no: Acknowledge employer's default fund

**Bank Details:**
- BSB (6 digits)
- Account number
- Account holder name

**Employment Details:**
- Position/Job title
- Department
- Employment type
- Start date
- Probation period acknowledgement

**Policy Acknowledgements:**
- Code of conduct
- Workplace health and safety
- Privacy policy
- Social media policy
- Electronic communication policy

**Declarations:**
- Information accuracy declaration
- Signature and date`,
    exampleFields: ['firstName', 'lastName', 'dateOfBirth', 'tfNumber', 'superannuationChoice', 'bankBSB', 'bankAccountNumber'],
    tips: [
      'TFN is optional - employees can choose to provide it later',
      'Superannuation choice form is required by law',
      'Include clear privacy statement about data handling'
    ]
  },
  {
    id: 'contractor-agreement',
    name: 'Contractor Agreement Form',
    description: 'Independent contractor details and agreement terms',
    category: 'Onboarding',
    icon: '📋',
    prompt: `Create an Australian independent contractor agreement form with:

**Contractor Details:**
- Business name (if applicable)
- ABN (Australian Business Number)
- Individual or company name
- Contact person
- Business address
- Phone and email
- Business structure (sole trader, company, partnership, trust)

**Services:**
- Description of services to be provided
- Service location
- Equipment provided by contractor
- Equipment provided by principal

**Payment Terms:**
- Rate/fee structure (hourly, daily, fixed)
- Rate amount (AUD)
- Invoice frequency
- Payment terms (e.g., 14 days)
- GST registered (yes/no)

**Insurance & Compliance:**
- Public liability insurance (amount)
- Professional indemnity insurance (amount)
- Workers compensation (if applicable)
- Safe work method statement (for construction)

**Terms:**
- Start date
- End date or project completion
- Termination notice period
- Confidentiality agreement
- Intellectual property assignment
- Non-compete clause (if applicable)

**Declarations:**
- ABN verification
- GST status
- Contractor acknowledges they are not an employee
- Signature and date`,
    exampleFields: ['businessName', 'abn', 'serviceDescription', 'rateAmount', 'gstRegistered', 'publicLiabilityAmount'],
    tips: [
      'ABN verification is mandatory for contractor payments',
      'Clear distinction between employee and contractor is legally required',
      'Consider including personal services income tests'
    ]
  },
  {
    id: 'volunteer-registration',
    name: 'Volunteer Registration Form',
    description: 'Volunteer application with WWCC and emergency contacts',
    category: 'Onboarding',
    icon: '🤝',
    prompt: `Create a volunteer registration form for Australian organisations with:

**Personal Information:**
- Full name
- Date of birth
- Address
- Phone number
- Email address
- Preferred contact method

**Emergency Contact:**
- Name and relationship
- Phone number

**Volunteer Preferences:**
- Areas of interest (checkboxes)
- Availability (days and times)
- Skills and qualifications
- Previous volunteer experience
- Languages spoken

**Working with Children Check (WWCC):**
- WWCC number
- State/Territory issued
- Expiry date
- Status (cleared/pending)

**Police Check:**
- Have current police check? (yes/no)
- Date obtained
- Willing to obtain one? (yes/no)

**References:**
- Reference 1: Name, relationship, phone
- Reference 2: Name, relationship, phone

**Health & Safety:**
- Any medical conditions we should know about
- Allergies
- Medications
- Dietary requirements

**Agreements:**
- Volunteer agreement
- Code of conduct
- Privacy statement
- Photo consent
- Signature and date`,
    exampleFields: ['fullName', 'dateOfBirth', 'wwccNumber', 'wwccState', 'availabilityDays', 'skills'],
    tips: [
      'WWCC is mandatory for volunteers working with children in most states',
      'Check state-specific requirements for WWCC validity',
      'Consider insurance coverage for volunteers'
    ]
  },

  // ============================================================================
  // Leave & Time Off
  // ============================================================================
  {
    id: 'annual-leave-request',
    name: 'Annual Leave Request',
    description: 'Annual/recreational leave application form',
    category: 'Leave',
    icon: '🏖️',
    prompt: `Create an annual leave request form for Australian employees with:

**Employee Details:**
- Employee name (auto-filled if possible)
- Employee ID
- Department
- Position

**Leave Details:**
- Leave type (annual, recreational)
- Start date
- End date
- Total days requested
- Partial day? (yes/no)
- If partial: time range

**Leave Balance:**
- Current annual leave balance (display only)
- Leave being taken
- Remaining balance after request

**Contact During Leave:**
- Emergency contact number
- Email contact during leave? (yes/no)
- Out of office message needed? (yes/no)

**Handover:**
- Who will cover your duties?
- Handover notes
- Urgent matters to be aware of

**Supporting Documents:**
- Attachment upload (optional)

**Declarations:**
- I confirm this request complies with leave policies
- Signature and date

**Manager Section:**
- Approved / Rejected / More information required
- Manager comments
- Manager signature
- Date`,
    exampleFields: ['employeeId', 'leaveType', 'startDate', 'endDate', 'totalDays', 'handoverPerson'],
    tips: [
      'Annual leave accrues at 4 weeks per year for full-time employees',
      'Consider minimum notice periods for leave requests',
      'Some awards have specific leave provisions'
    ]
  },
  {
    id: 'personal-carers-leave',
    name: 'Personal/Carer\'s Leave Form',
    description: 'Sick leave or carer\'s leave application',
    category: 'Leave',
    icon: '🏥',
    prompt: `Create a personal/carer's leave form for Australian employees with:

**Employee Details:**
- Employee name
- Employee ID
- Department

**Leave Type:**
- Personal leave (own illness/injury)
- Carer's leave (caring for family member)
- Family and domestic violence leave

**Leave Details:**
- Date(s) of absence
- Was this a partial day? (yes/no)
- If partial: time absent
- Total hours/days

**Medical Certificate:**
- Medical certificate provided? (yes/no)
- If no, reason (optional for first 2 days in some cases)
- Certificate upload

**For Carer's Leave:**
- Name of person being cared for
- Relationship to employee
- Nature of illness/injury (optional)

**For Family & Domestic Violence Leave:**
- Confirmation of eligibility (no proof required by law)
- Support services offered (information display)

**Contact:**
- Contact number during absence
- Expected return date

**Declaration:**
- Information is true and correct
- Signature and date

**Manager Use:**
- Approved / Rejected
- Notes
- Date`,
    exampleFields: ['leaveType', 'absenceDate', 'medicalCertificateProvided', 'caredForPerson', 'relationship'],
    tips: [
      'Personal leave accrues at 10 days per year for full-time employees',
      'Medical certificates may be required after 2 consecutive days',
      'Employees can take carer\'s leave for immediate family or household members'
    ]
  },
  {
    id: 'parental-leave-request',
    name: 'Parental Leave Request',
    description: 'Maternity, paternity, or adoption leave application',
    category: 'Leave',
    icon: '👶',
    prompt: `Create a parental leave request form for Australian employees with:

**Employee Details:**
- Employee name
- Employee ID
- Department
- Position
- Employment type
- Length of service

**Leave Type:**
- Primary carer leave (birth mother/primary adopter)
- Partner leave (father/partner)
- Adoption leave
- Surrogacy leave
- Special maternity leave

**Expected Due Date:**
- Expected date of birth/placement
- Expected start date of leave
- Expected return date

**Leave Entitlements:**
- Government Paid Parental Leave (18 weeks)
- Dad and Partner Pay (2 weeks)
- Employer-funded leave (if applicable)
- Annual leave to be taken (optional)
- Total leave period

**Partner Leave Details (if applicable):**
- Partner's name
- Partner's expected due date
- Leave dates requested

**Supporting Documents:**
- Medical certificate (required for birth-related leave)
- Adoption documentation (if applicable)
- Other supporting documents

**Work Arrangements:**
- Key responsibilities to be covered
- Proposed handover plan
- Contact during leave preference

**Return to Work:**
- Intention to return to work (yes/undecided)
- Preferred return date
- Interest in part-time/flexible arrangements?

**Declarations:**
- Information is accurate
- Understand notification requirements
- Signature and date

**Manager Section:**
- Approved / Discussion required
- Temporary replacement arrangements
- Manager signature and date`,
    exampleFields: ['leaveType', 'expectedDueDate', 'leaveStartDate', 'governmentPPL', 'employerLeave', 'intentionToReturn'],
    tips: [
      'Employees are entitled to 12 months unpaid parental leave after 12 months service',
      'Must give at least 10 weeks written notice before leave starts',
      'Can request up to 24 months of leave total'
    ]
  },

  // ============================================================================
  // Workplace Safety
  // ============================================================================
  {
    id: 'incident-report',
    name: 'Incident Report Form',
    description: 'Workplace incident, injury, or near miss reporting',
    category: 'Safety',
    icon: '⚠️',
    prompt: `Create a workplace incident report form for Australian WHS compliance with:

**Reporter Details:**
- Name of person completing form
- Position
- Contact number
- Date and time of report

**Incident Details:**
- Date of incident
- Time of incident
- Exact location
- Type of incident (injury, near miss, property damage, environmental)
- Was it a notifiable incident? (serious injury/death/dangerous incident)

**Person(s) Involved:**
- Name(s)
- Position/role
- Contact details
- Was the person an employee, contractor, visitor, or member of public?

**Incident Description:**
- Detailed description of what happened
- What was the person doing?
- What equipment/substances were involved?
- What were the environmental conditions?

**Injury Details (if applicable):**
- Nature of injury (cut, sprain, fracture, etc.)
- Body part affected
- Severity (first aid only, medical treatment, hospital admission)
- First aid provided (yes/no, by whom)
- Medical treatment sought (yes/no, where)

**Witnesses:**
- Witness 1: Name, contact
- Witness 2: Name, contact

**Immediate Actions Taken:**
- Actions to make area safe
- First aid administered
- Emergency services called
- Area secured

**Root Cause Analysis:**
- What caused the incident?
- Contributing factors
- Was adequate training provided?
- Were procedures being followed?

**Corrective Actions:**
- Recommended actions to prevent recurrence
- Responsible person
- Target completion date

**Notifications:**
- Has the HSR been notified? (yes/no)
- Has WHS regulator been notified? (for notifiable incidents)
- Has insurance been notified? (for workers compensation)

**Attachments:**
- Photos
- Diagrams
- CCTV footage reference
- Other documents

**Signatures:**
- Reporter signature and date
- Manager signature and date
- HSR notification acknowledged`,
    exampleFields: ['incidentDate', 'incidentTime', 'location', 'incidentType', 'injuryNature', 'witnessNames', 'correctiveActions'],
    tips: [
      'Notifiable incidents must be reported to the WHS regulator immediately',
      'Incident scene must be preserved for notifiable incidents',
      'Keep records for at least 5 years'
    ]
  },
  {
    id: 'hazard-report',
    name: 'Hazard Report Form',
    description: 'Workplace hazard identification and reporting',
    category: 'Safety',
    icon: '⚡',
    prompt: `Create a workplace hazard report form with:

**Reporter Details:**
- Name (can be anonymous)
- Position
- Department
- Date of report

**Hazard Details:**
- Location of hazard
- Date hazard identified
- Time hazard identified
- Type of hazard (physical, chemical, biological, ergonomic, psychosocial, environmental)

**Hazard Description:**
- Detailed description of the hazard
- What could go wrong?
- Who could be affected?
- How likely is it to cause harm?
- How severe could the harm be?

**Risk Assessment:**
- Likelihood (almost certain, likely, possible, unlikely, rare)
- Consequence (catastrophic, major, moderate, minor, insignificant)
- Risk rating (high, medium, low)

**Current Controls:**
- What controls are currently in place?
- Are they adequate? (yes/no/partially)

**Recommended Actions:**
- Suggested control measures
- Priority (immediate, urgent, routine)
- Who should action this?
- Suggested timeframe

**Photos/Evidence:**
- Photo upload
- Diagrams
- Other evidence

**Acknowledgement:**
- HSR notified (yes/no)
- Manager notified (yes/no)

**Action Tracking (for management use):**
- Action assigned to
- Due date
- Status (pending, in progress, completed)
- Completion date
- Verification notes`,
    exampleFields: ['hazardLocation', 'hazardType', 'description', 'likelihood', 'consequence', 'riskRating', 'recommendedControls'],
    tips: [
      'Use the hierarchy of controls: eliminate, substitute, engineer, administrate, PPE',
      'Encourage reporting without fear of blame',
      'Regular hazard hunts should be conducted'
    ]
  },
  {
    id: 'swms',
    name: 'Safe Work Method Statement',
    description: 'SWMS for high-risk construction work',
    category: 'Safety',
    icon: '🦺',
    prompt: `Create a Safe Work Method Statement (SWMS) form for high-risk construction work with:

**Project Details:**
- Project name
- Project address
- Principal contractor
- ABN
- Contact person and phone

**SWMS Details:**
- SWMS number
- Date prepared
- Revision number
- Prepared by
- Reviewed by

**Work Activity:**
- Description of high-risk construction work
- Work location on site
- Planned start date
- Expected duration

**High-Risk Work Types (checkboxes):**
- Risk of falling more than 2 metres
- Work on a telecommunication tower
- Demolition of a load-bearing structure
- Work in or near a confined space
- Work in or near a shaft or trench
- Use of explosives
- Work on or near pressurised gas mains
- Work on or near chemical, fuel or refrigerant lines
- Work on or near energised electrical installations
- Tilt-up or precast concrete
- Work in an area that may have a contaminated atmosphere
- Work requiring temporary load-bearing support
- Work in a traffic corridor
- Mobile plant work
- Diving work
- Other (specify)

**Job Steps and Risk Controls:**
For each step:
- Job step description
- Hazards and risks
- Risk controls (using hierarchy of controls)
- Responsible person

**Training and Competency:**
- Required licences/tickets
- Required training
- Required PPE

**Emergency Procedures:**
- Nearest first aid location
- Nearest emergency exit
- Assembly point
- Emergency contact numbers
- Rescue procedures (if working at heights/confined space)

**Consultation:**
- Workers consulted (names and signatures)
- HSR consulted (name and signature)
- Date of consultation

**Review and Approval:**
- Principal contractor approval
- Name, position, signature, date
- Review date (must be reviewed if conditions change)

**Monitoring:**
- Site supervisor name
- Monitoring frequency
- Non-conformance procedure`,
    exampleFields: ['projectName', 'projectAddress', 'principalContractor', 'workDescription', 'highRiskTypes', 'jobSteps', 'riskControls'],
    tips: [
      'SWMS is mandatory for high-risk construction work under WHS laws',
      'Must be developed before work starts',
      'Must be reviewed if notifiable incident occurs or controls are inadequate'
    ]
  },

  // ============================================================================
  // Performance & Development
  // ============================================================================
  {
    id: 'performance-review',
    name: 'Performance Review Form',
    description: 'Employee performance appraisal and development plan',
    category: 'Performance',
    icon: '📊',
    prompt: `Create an employee performance review form with:

**Review Details:**
- Employee name
- Employee ID
- Position
- Department
- Review period
- Review date
- Reviewer name and position

**Goals Review:**
For each goal set in previous period:
- Goal description
- Target
- Actual result
- Achievement rating (exceeded, met, partially met, not met)
- Comments

**Core Competencies Assessment:**
Rate each competency (1-5 scale):
- Job knowledge and skills
- Quality of work
- Productivity/efficiency
- Communication
- Teamwork and collaboration
- Problem-solving
- Initiative
- Reliability/attendance
- Customer service (if applicable)
- Leadership (if applicable)

**Strengths:**
- Key strengths demonstrated
- Notable achievements

**Areas for Development:**
- Skills to develop
- Knowledge gaps
- Behavioural improvements needed

**Goals for Next Period:**
For each goal:
- Goal description
- Success measures
- Target date
- Support/resources needed

**Development Plan:**
- Training needs
- Development activities
- Career aspirations
- Mentoring/coaching needs

**Overall Rating:**
- Overall performance rating (outstanding, exceeds expectations, meets expectations, needs improvement, unsatisfactory)
- Justification for rating

**Employee Comments:**
- Employee's perspective on review
- Areas of agreement/disagreement

**Signatures:**
- Employee signature and date
- Reviewer signature and date
- Manager signature and date
- HR use only`,
    exampleFields: ['employeeName', 'reviewPeriod', 'goalsAchieved', 'competencyRatings', 'strengths', 'developmentAreas', 'overallRating'],
    tips: [
      'Conduct reviews at least annually',
      'Focus on specific behaviours and outcomes, not personality',
      'Ensure goals are SMART (Specific, Measurable, Achievable, Relevant, Time-bound)'
    ]
  },
  {
    id: 'training-request',
    name: 'Training Request Form',
    description: 'Employee training and professional development request',
    category: 'Performance',
    icon: '📚',
    prompt: `Create a training request form with:

**Employee Details:**
- Employee name
- Employee ID
- Position
- Department
- Manager name

**Training Details:**
- Training name
- Training provider
- Training type (workshop, online, conference, qualification, coaching)
- Training category (technical, compliance, leadership, professional development)
- Description of training content
- Learning outcomes

**Training Schedule:**
- Start date
- End date
- Total duration (hours/days)
- Location (on-site, off-site, online)
- Session times

**Costs:**
- Course fee (AUD)
- Travel costs (AUD)
- Accommodation costs (AUD)
- Materials/resources (AUD)
- Total cost (AUD)

**Business Justification:**
- How does this training relate to current role?
- How will this benefit the organisation?
- Is this training required for compliance? (yes/no)
- Is this a prerequisite for another course? (yes/no)

**Development Plan Link:**
- Is this in the employee's development plan? (yes/no)
- Which goal does this support?

**Work Coverage:**
- Will work need to be covered during training? (yes/no)
- Who will cover?
- Handover requirements

**Post-Training Commitments:**
- Willing to share learnings with team? (yes/no)
- Willing to train others? (yes/no)
- Commitment to remain with organisation for X months after training? (if applicable)

**Approvals:**
- Manager approval (approved/rejected/pending discussion)
- Manager comments
- Manager signature and date
- Department head approval (if over $X)
- HR approval (if applicable)

**Post-Training (to be completed after training):**
- Training completed date
- Was training objectives met? (yes/partially/no)
- Key learnings summary
- How will learnings be applied?
- Would you recommend this training? (yes/no)
- Training rating (1-5)`,
    exampleFields: ['trainingName', 'trainingProvider', 'trainingType', 'startDate', 'endDate', 'totalCost', 'businessJustification'],
    tips: [
      'Consider return on investment for expensive training',
      'Document knowledge transfer commitments',
      'Some training may require a training agreement for repayment if employee leaves'
    ]
  },

  // ============================================================================
  // Finance & Expenses
  // ============================================================================
  {
    id: 'expense-claim',
    name: 'Expense Claim Form',
    description: 'Employee expense reimbursement request',
    category: 'Finance',
    icon: '💰',
    prompt: `Create an employee expense claim form with:

**Employee Details:**
- Employee name
- Employee ID
- Department
- Manager name

**Claim Details:**
- Claim reference number (auto-generated)
- Date of claim

**Expense Items:**
For each expense:
- Date of expense
- Expense category (travel, meals, accommodation, equipment, software, professional development, other)
- Description
- Business purpose
- Project/Client code (if applicable)
- Amount (AUD)
- GST amount (if applicable)
- Receipt attached (yes/no)

**Travel Details (if applicable):**
- Destination
- Purpose of travel
- Travel dates
- Transport method
- Distance (km) if using own vehicle

**Vehicle Expense (if applicable):**
- Vehicle registration
- Engine capacity (for rate calculation)
- Kilometres travelled
- Rate per km (ATO rate)
- Total vehicle expense

**Total Claim:**
- Total expenses (AUD)
- Total GST (AUD)
- Total claim amount (AUD)

**Payment Details:**
- Bank account name
- BSB
- Account number
- Same as salary account? (yes/no)

**Declarations:**
- All expenses are work-related
- Original receipts attached
- Not claimed elsewhere
- Understand false claims may result in disciplinary action
- Signature and date

**Approvals:**
- Manager approval (approved/rejected/more info required)
- Manager comments
- Manager signature and date
- Finance approval (if over threshold)
- Finance comments
- Finance signature and date

**Payment Processing:**
- Payment date
- Payment reference
- Processed by`,
    exampleFields: ['claimDate', 'expenseItems', 'totalAmount', 'businessPurpose', 'receiptAttached', 'bankDetails'],
    tips: [
      'Keep all receipts - required for claims over $75 for GST purposes',
      'Use ATO rates for vehicle expenses',
      'Submit claims within 30 days of expense'
    ]
  },
  {
    id: 'petty-cash',
    name: 'Petty Cash Voucher',
    description: 'Petty cash expenditure record',
    category: 'Finance',
    icon: '💵',
    prompt: `Create a petty cash voucher form with:

**Voucher Details:**
- Voucher number (auto-generated)
- Date
- Time

**Requester Details:**
- Name
- Department
- Position

**Expenditure Details:**
- Description of purchase
- Reason for purchase
- Category (office supplies, refreshments, postage, miscellaneous)
- Amount (AUD)

**Supplier Details:**
- Supplier name
- ABN (if over $75)

**Receipt Details:**
- Receipt number
- Receipt date
- Receipt amount
- Receipt attached (yes/no)

**Change/Refund:**
- Amount given
- Change returned (if applicable)

**Approval:**
- Approved by (name and position)
- Signature
- Date

**Payment:**
- Cash given by
- Signature
- Date

**Reconciliation (for finance use):**
- Voucher verified
- Receipt verified
- Entered in petty cash log
- Date entered
- Entered by`,
    exampleFields: ['voucherNumber', 'date', 'description', 'amount', 'category', 'receiptNumber'],
    tips: [
      'Petty cash should be limited to small amounts (typically under $100)',
      'Regular reconciliation is essential',
      'Consider moving to corporate cards for better tracking'
    ]
  },

  // ============================================================================
  // IT & Equipment
  // ============================================================================
  {
    id: 'it-access-request',
    name: 'IT Access Request Form',
    description: 'System access and software request',
    category: 'IT',
    icon: '🔐',
    prompt: `Create an IT access request form with:

**Requester Details:**
- Employee name
- Employee ID
- Position
- Department
- Manager name
- Start date (for new employees)

**Request Type:**
- New access
- Modify access
- Remove access
- Temporary access

**System Access Required:**
For each system:
- System name (dropdown with common systems)
- Access level (read-only, standard, administrator)
- Business justification
- Specific permissions needed

**Common Systems (checkboxes):**
- Email (Microsoft 365 / Google Workspace)
- File storage (SharePoint, Google Drive, network drives)
- HR system
- Payroll system
- CRM
- Project management
- Communication tools (Slack, Teams)
- Finance system
- Other (specify)

**Hardware Requirements:**
- Computer (laptop/desktop)
- Monitor(s)
- Phone (mobile/desk phone)
- Headset
- Other peripherals

**Software Requirements:**
- Standard software suite
- Specialised software (list)
- Licences needed

**Network Access:**
- VPN access required? (yes/no)
- Remote desktop access? (yes/no)
- WiFi access? (yes/no)

**Security:**
- Multi-factor authentication set up? (yes/no)
- Security training completed? (yes/no)
- Data classification level needed

**Approval:**
- Manager approval (approved/rejected)
- Manager comments
- Manager signature and date
- IT approval (approved/rejected)
- IT comments
- IT signature and date

**Provisioning (IT use only):**
- Access provisioned date
- Credentials provided method
- Provisioned by
- Notes`,
    exampleFields: ['employeeName', 'requestType', 'systemsRequired', 'accessLevel', 'hardwareRequired', 'businessJustification'],
    tips: [
      'Apply principle of least privilege',
      'Regular access reviews should be conducted',
      'Document access removal process for offboarding'
    ]
  },
  {
    id: 'equipment-checkout',
    name: 'Equipment Checkout Form',
    description: 'Company equipment loan and return tracking',
    category: 'IT',
    icon: '💻',
    prompt: `Create an equipment checkout form with:

**Checkout Details:**
- Checkout date
- Expected return date
- Checkout reference number

**Employee Details:**
- Employee name
- Employee ID
- Department
- Contact number
- Email

**Equipment Details:**
For each item:
- Asset tag number
- Equipment type (laptop, projector, camera, phone, tablet, other)
- Make and model
- Serial number
- Condition at checkout (new, excellent, good, fair)
- Accessories included (charger, case, cables, etc.)
- Current value (AUD)

**Purpose:**
- Reason for checkout
- Location where equipment will be used
- Project/event name (if applicable)

**Acknowledgement:**
- I accept responsibility for this equipment
- I will return equipment in good condition
- I understand I may be liable for damage/loss
- I will report any issues immediately
- Signature and date

**Checkout Approval:**
- Approved by (name and position)
- Signature
- Date

**Return Details:**
- Return date
- Condition at return (excellent, good, fair, damaged)
- All accessories returned? (yes/no)
- Missing items (if any)
- Issues noted
- Returned by (signature)
- Received by (name and signature)
- Date received

**Damage/Loss (if applicable):**
- Description of damage/loss
- Incident report number
- Insurance claim number
- Employee contribution amount
- Notes`,
    exampleFields: ['assetTag', 'equipmentType', 'makeModel', 'serialNumber', 'checkoutDate', 'expectedReturnDate', 'condition'],
    tips: [
      'Photograph equipment before checkout',
      'Regular audits of equipment should be conducted',
      'Consider insurance for high-value items'
    ]
  },

  // ============================================================================
  // Feedback & Complaints
  // ============================================================================
  {
    id: 'feedback-form',
    name: 'General Feedback Form',
    description: 'Employee feedback and suggestions',
    category: 'Feedback',
    icon: '💬',
    prompt: `Create a general feedback form with:

**Feedback Details:**
- Date
- Feedback type (suggestion, compliment, concern, idea)
- Can be submitted anonymously? (yes/no)

**Submitter Details (if not anonymous):**
- Name
- Department
- Position
- Email

**Feedback Topic:**
- Category (workplace culture, processes, facilities, communication, leadership, other)
- Specific topic

**Feedback Content:**
- What is your feedback?
- What is working well? (if applicable)
- What could be improved?
- Do you have a suggestion for improvement?

**Impact:**
- Who does this affect? (individual, team, department, whole organisation)
- How significant is this? (minor, moderate, significant)

**Follow-up:**
- Would you like follow-up on this feedback? (yes/no)
- Preferred contact method

**Privacy:**
- Can this feedback be shared with others? (yes/no)
- Can your name be associated with this feedback? (yes/no)

**Submission:**
- Signature (if not anonymous)
- Date

**Response (for management use):**
- Received date
- Assigned to
- Response date
- Action taken
- Feedback provided to submitter (yes/no, date)`,
    exampleFields: ['feedbackType', 'category', 'feedbackContent', 'suggestion', 'followUpRequested', 'anonymous'],
    tips: [
      'Anonymous feedback can be valuable but limits follow-up',
      'Always acknowledge feedback received',
      'Close the loop by communicating actions taken'
    ]
  },
  {
    id: 'grievance-form',
    name: 'Grievance/Complaint Form',
    description: 'Formal workplace grievance submission',
    category: 'Feedback',
    icon: '📝',
    prompt: `Create a workplace grievance form with:

**Complainant Details:**
- Name
- Position
- Department
- Contact number
- Email
- Preferred contact method

**Grievance Details:**
- Date of submission
- Type of grievance (workplace behaviour, discrimination, harassment, bullying, work conditions, management decision, other)
- Is this a formal grievance? (yes/no)

**Person(s) Subject of Grievance:**
- Name(s)
- Position(s)
- Department(s)
- Relationship to complainant

**Incident Details:**
- Date(s) of incident(s)
- Location(s)
- Was this a single incident or ongoing? (single/ongoing)
- Description of what happened (be specific)
- Witnesses (if any)

**Impact:**
- How has this affected you?
- How has this affected your work?
- Have you taken any sick leave as a result?

**Previous Actions:**
- Have you raised this informally? (yes/no)
- Who did you speak to?
- What was the outcome?
- Have you contacted HR? (yes/no)
- Have you contacted EAP? (yes/no)

**Desired Outcome:**
- What outcome are you seeking?
- What would resolve this grievance?

**Support Needs:**
- Do you need support during this process? (yes/no)
- Would you like a support person? (yes/no)
- Support person name and contact

**Confidentiality:**
- I understand this information will be kept confidential
- I understand information may need to be shared for investigation
- Signature and date

**Acknowledgement (HR use only):**
- Received by
- Date received
- Grievance reference number
- Initial assessment date
- Investigation required? (yes/no)
- Investigator assigned
- Target resolution date`,
    exampleFields: ['grievanceType', 'incidentDate', 'incidentLocation', 'description', 'personsInvolved', 'desiredOutcome', 'formalGrievance'],
    tips: [
      'Handle grievances promptly and confidentially',
      'Ensure procedural fairness for all parties',
      'Document all steps in the process',
      'Consider offering EAP support'
    ]
  }
];

// ============================================================================
// Template Categories
// ============================================================================

export const TEMPLATE_CATEGORIES = [
  { id: 'Onboarding', name: 'Onboarding & HR', icon: '👥' },
  { id: 'Leave', name: 'Leave & Time Off', icon: '📅' },
  { id: 'Safety', name: 'Workplace Safety', icon: '🦺' },
  { id: 'Performance', name: 'Performance & Development', icon: '📈' },
  { id: 'Finance', name: 'Finance & Expenses', icon: '💰' },
  { id: 'IT', name: 'IT & Equipment', icon: '💻' },
  { id: 'Feedback', name: 'Feedback & Complaints', icon: '💬' },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getTemplatesByCategory(category: string): PromptTemplate[] {
  return PROMPT_TEMPLATES.filter(t => t.category === category);
}

export function getTemplateById(id: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES.find(t => t.id === id);
}

export function searchTemplates(query: string): PromptTemplate[] {
  const lowerQuery = query.toLowerCase();
  return PROMPT_TEMPLATES.filter(t => 
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.category.toLowerCase().includes(lowerQuery)
  );
}
