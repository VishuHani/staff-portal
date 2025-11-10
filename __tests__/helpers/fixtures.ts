/**
 * Test Data Fixtures
 * Provides reusable test data for venue, user, and role testing
 */

import { faker } from "@faker-js/faker";

// ============================================================================
// VENUE FIXTURES
// ============================================================================

export const createVenueFixture = (overrides?: Partial<Venue>) => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  code: faker.string.alpha({ length: 3, casing: "upper" }),
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const testVenues = {
  venueA: createVenueFixture({
    id: "cltestvenueavenueaaaa",
    name: "Venue A",
    code: "VNA",
    active: true,
  }),
  venueB: createVenueFixture({
    id: "cltestvenuebvenuebbbb",
    name: "Venue B",
    code: "VNB",
    active: true,
  }),
  venueC: createVenueFixture({
    id: "cltestvenuecvenuecccc",
    name: "Venue C (Inactive)",
    code: "VNC",
    active: false,
  }),
};

// ============================================================================
// ROLE FIXTURES
// ============================================================================

export const createRoleFixture = (overrides?: Partial<Role>) => ({
  id: faker.string.uuid(),
  name: faker.helpers.arrayElement(["ADMIN", "MANAGER", "STAFF"]),
  description: faker.lorem.sentence(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const testRoles = {
  admin: createRoleFixture({
    id: "cltestroleadminaaaaa",
    name: "ADMIN",
    description: "System administrator",
  }),
  manager: createRoleFixture({
    id: "cltestrolemanageraaaa",
    name: "MANAGER",
    description: "Venue manager",
  }),
  staff: createRoleFixture({
    id: "cltestrolestaffaaaaa",
    name: "STAFF",
    description: "Staff member",
  }),
};

// ============================================================================
// USER FIXTURES
// ============================================================================

export const createUserFixture = (overrides?: Partial<User>) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  phone: faker.phone.number(),
  profileImage: faker.image.avatar(),
  bio: faker.lorem.paragraph(),
  dateOfBirth: faker.date.past({ years: 30 }),
  active: true,
  roleId: testRoles.staff.id,
  storeId: null,
  profileCompletedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const testUsers = {
  // User 1: Venue A (primary), Venue B (secondary)
  user1: createUserFixture({
    id: "cltest001user1aaaa",
    email: "user1@example.com",
    firstName: "User",
    lastName: "One",
    roleId: testRoles.staff.id,
  }),
  // User 2: Venue B (primary)
  user2: createUserFixture({
    id: "cltest002user2bbbb",
    email: "user2@example.com",
    firstName: "User",
    lastName: "Two",
    roleId: testRoles.staff.id,
  }),
  // User 3: Venue A (primary), Venue C (inactive)
  user3: createUserFixture({
    id: "cltest003user3cccc",
    email: "user3@example.com",
    firstName: "User",
    lastName: "Three",
    roleId: testRoles.manager.id,
  }),
  // User 4: Venue C (primary) - only inactive venue
  user4: createUserFixture({
    id: "cltest004user4dddd",
    email: "user4@example.com",
    firstName: "User",
    lastName: "Four",
    roleId: testRoles.staff.id,
  }),
  // User 5: No venues assigned
  user5: createUserFixture({
    id: "cltest005user5eeee",
    email: "user5@example.com",
    firstName: "User",
    lastName: "Five",
    roleId: testRoles.staff.id,
  }),
  // Admin User: All venues access
  admin: createUserFixture({
    id: "cltestadminadminaaaa",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    roleId: testRoles.admin.id,
  }),
};

// ============================================================================
// USER VENUE FIXTURES
// ============================================================================

export const createUserVenueFixture = (overrides?: Partial<UserVenue>) => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  venueId: faker.string.uuid(),
  isPrimary: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const testUserVenues = [
  // User 1: Venue A (primary), Venue B
  createUserVenueFixture({
    userId: testUsers.user1.id,
    venueId: testVenues.venueA.id,
    isPrimary: true,
  }),
  createUserVenueFixture({
    userId: testUsers.user1.id,
    venueId: testVenues.venueB.id,
    isPrimary: false,
  }),
  // User 2: Venue B (primary)
  createUserVenueFixture({
    userId: testUsers.user2.id,
    venueId: testVenues.venueB.id,
    isPrimary: true,
  }),
  // User 3: Venue A (primary), Venue C (inactive)
  createUserVenueFixture({
    userId: testUsers.user3.id,
    venueId: testVenues.venueA.id,
    isPrimary: true,
  }),
  createUserVenueFixture({
    userId: testUsers.user3.id,
    venueId: testVenues.venueC.id,
    isPrimary: false,
  }),
  // User 4: Venue C (primary)
  createUserVenueFixture({
    userId: testUsers.user4.id,
    venueId: testVenues.venueC.id,
    isPrimary: true,
  }),
  // User 5: No venues
  // Admin: All venues
  createUserVenueFixture({
    userId: testUsers.admin.id,
    venueId: testVenues.venueA.id,
    isPrimary: true,
  }),
  createUserVenueFixture({
    userId: testUsers.admin.id,
    venueId: testVenues.venueB.id,
    isPrimary: false,
  }),
  createUserVenueFixture({
    userId: testUsers.admin.id,
    venueId: testVenues.venueC.id,
    isPrimary: false,
  }),
];

// ============================================================================
// POST FIXTURES
// ============================================================================

export const createPostFixture = (overrides?: Partial<Post>) => ({
  id: faker.string.uuid(),
  content: faker.lorem.paragraph(),
  mediaUrls: null,
  pinned: false,
  edited: false,
  editedAt: null,
  authorId: faker.string.uuid(),
  channelId: faker.string.uuid(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ============================================================================
// COMMENT FIXTURES
// ============================================================================

export const createCommentFixture = (overrides?: Partial<Comment>) => ({
  id: faker.string.uuid(),
  content: faker.lorem.sentence(),
  postId: faker.string.uuid(),
  userId: faker.string.uuid(),
  parentId: null,
  edited: false,
  editedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ============================================================================
// CONVERSATION FIXTURES
// ============================================================================

export const createConversationFixture = (overrides?: Partial<Conversation>) => ({
  id: faker.string.uuid(),
  title: null,
  isGroup: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ============================================================================
// MESSAGE FIXTURES
// ============================================================================

export const createMessageFixture = (overrides?: Partial<Message>) => ({
  id: faker.string.uuid(),
  content: faker.lorem.sentence(),
  conversationId: faker.string.uuid(),
  senderId: faker.string.uuid(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ============================================================================
// TIME-OFF REQUEST FIXTURES
// ============================================================================

export const createTimeOffRequestFixture = (overrides?: Partial<TimeOffRequest>) => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  startDate: faker.date.future(),
  endDate: faker.date.future(),
  reason: faker.lorem.sentence(),
  status: "PENDING" as const,
  reviewedById: null,
  reviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Venue {
  id: string;
  name: string;
  code: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  profileImage: string | null;
  bio: string | null;
  dateOfBirth: Date | null;
  active: boolean;
  roleId: string;
  storeId: string | null;
  profileCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserVenue {
  id: string;
  userId: string;
  venueId: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  content: string;
  mediaUrls: string | null;
  pinned: boolean;
  edited: boolean;
  editedAt: Date | null;
  authorId: string;
  channelId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  content: string;
  postId: string;
  userId: string;
  parentId: string | null;
  edited: boolean;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  title: string | null;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  content: string;
  conversationId: string;
  senderId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeOffRequest {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// AVAILABILITY FIXTURES
// ============================================================================

export const createAvailabilityFixture = (overrides?: Partial<Availability>) => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  dayOfWeek: faker.number.int({ min: 0, max: 6 }),
  isAvailable: faker.datatype.boolean(),
  isAllDay: false,
  startTime: "09:00",
  endTime: "17:00",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ============================================================================
// TYPE DEFINITIONS (continued)
// ============================================================================

export interface Availability {
  id: string;
  userId: string;
  dayOfWeek: number;
  isAvailable: boolean;
  isAllDay: boolean;
  startTime: string | null;
  endTime: string | null;
  createdAt: Date;
  updatedAt: Date;
}
