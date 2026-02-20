/**
 * Calculate profile completion percentage
 * This is a utility function, not a server action
 */
export function calculateProfileCompletion(user: {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | null;
  bio?: string | null;
  profileImage?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostcode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
}): { percentage: number; missingFields: string[] } {
  const requiredFields: { key: keyof typeof user; label: string }[] = [
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "phone", label: "Phone Number" },
    { key: "dateOfBirth", label: "Date of Birth" },
    { key: "profileImage", label: "Profile Photo" },
    { key: "addressStreet", label: "Street Address" },
    { key: "addressCity", label: "City" },
    { key: "addressState", label: "State" },
    { key: "addressPostcode", label: "Postcode" },
    { key: "emergencyContactName", label: "Emergency Contact Name" },
    { key: "emergencyContactPhone", label: "Emergency Contact Phone" },
    { key: "emergencyContactRelation", label: "Emergency Contact Relationship" },
  ];

  const missingFields: string[] = [];
  let filledCount = 0;

  for (const field of requiredFields) {
    const value = user[field.key];
    if (value && String(value).trim() !== "") {
      filledCount++;
    } else {
      missingFields.push(field.label);
    }
  }

  const percentage = Math.round((filledCount / requiredFields.length) * 100);
  return { percentage, missingFields };
}
