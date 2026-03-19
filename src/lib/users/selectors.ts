import { Prisma } from "@prisma/client";

// Deliberately narrow, high-frequency auth projection.
// Avoids pulling the full oversized User model into every auth-context fetch.
export const userAuthContextSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  profileImage: true,
  roleId: true,
  venueId: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      name: true,
      description: true,
      rolePermissions: {
        select: {
          permission: {
            select: {
              resource: true,
              action: true,
            },
          },
        },
      },
    },
  },
  venue: {
    select: {
      id: true,
      name: true,
      code: true,
      active: true,
    },
  },
  venues: {
    select: {
      venueId: true,
      isPrimary: true,
      venue: {
        select: {
          id: true,
          name: true,
          code: true,
          active: true,
        },
      },
    },
  },
});

export type UserAuthContext = Prisma.UserGetPayload<{
  select: typeof userAuthContextSelect;
}>;
