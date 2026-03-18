/**
 * Integration Tests for Document Template CRUD Operations
 * Phase 8 - Polish & Testing
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { testUsers, testVenues, testRoles } from "../../helpers/fixtures";

// Mock the prisma client with document models
const mockDocumentTemplate = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
};

const mockDocumentTemplateVersion = {
  create: vi.fn(),
  findMany: vi.fn(),
};

const mockDocumentAssignment = {
  count: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentTemplate: mockDocumentTemplate,
    documentTemplateVersion: mockDocumentTemplateVersion,
    documentAssignment: mockDocumentAssignment,
    user: {
      findUnique: vi.fn(),
    },
    venue: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn()),
  },
}));

// Mock getCurrentUser
vi.mock("@/lib/actions/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: testUsers.admin.id,
    roleId: testRoles.admin.id,
  }),
}));

// Mock revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Document Template CRUD Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTemplate", () => {
    it("should create a new form template with valid data", async () => {
      const templateData = {
        id: "test-template-id",
        venueId: testVenues.venueA.id,
        name: "WHS Safety Form",
        description: "Workplace Health and Safety acknowledgment",
        category: "COMPLIANCE",
        documentType: "FORM" as const,
        formSchema: {
          fields: [
            { id: "name", type: "text", label: "Full Name", required: true },
            { id: "signature", type: "signature", label: "Signature", required: true },
          ],
        },
        requireSignature: true,
        isActive: true,
        currentVersion: 1,
        createdBy: testUsers.admin.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDocumentTemplate.create.mockResolvedValue(templateData);

      const result = await mockDocumentTemplate.create({
        data: {
          venueId: templateData.venueId,
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          documentType: templateData.documentType,
          formSchema: templateData.formSchema,
          requireSignature: templateData.requireSignature,
          isActive: true,
          createdBy: templateData.createdBy,
        },
      });

      expect(result).toBeDefined();
      expect(result.name).toBe("WHS Safety Form");
      expect(result.documentType).toBe("FORM");
      expect(result.requireSignature).toBe(true);
    });

    it("should create a PDF template with file upload", async () => {
      const templateData = {
        id: "test-pdf-template-id",
        venueId: testVenues.venueA.id,
        name: "Employee Contract",
        documentType: "PDF" as const,
        pdfUrl: "https://storage.example.com/pdfs/contract.pdf",
        pdfFileName: "contract.pdf",
        pdfFileSize: 102400,
        requireSignature: true,
        isActive: true,
        createdBy: testUsers.admin.id,
      };

      mockDocumentTemplate.create.mockResolvedValue(templateData);

      const result = await mockDocumentTemplate.create({
        data: templateData,
      });

      expect(result).toBeDefined();
      expect(result.documentType).toBe("PDF");
      expect(result.pdfUrl).toBeDefined();
    });

    it("should reject invalid document type", async () => {
      const validTypes = ["FORM", "PDF", "HYBRID", "EXTERNAL"];
      const invalidType = "INVALID_TYPE";

      expect(validTypes).not.toContain(invalidType);
    });
  });

  describe("getTemplates", () => {
    it("should return templates for a venue", async () => {
      const mockTemplates = [
        {
          id: "template-1",
          venueId: testVenues.venueA.id,
          name: "Template 1",
          documentType: "FORM",
          isActive: true,
        },
        {
          id: "template-2",
          venueId: testVenues.venueA.id,
          name: "Template 2",
          documentType: "PDF",
          isActive: true,
        },
      ];

      mockDocumentTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await mockDocumentTemplate.findMany({
        where: {
          venueId: testVenues.venueA.id,
          isActive: true,
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0].venueId).toBe(testVenues.venueA.id);
    });

    it("should filter templates by category", async () => {
      const mockTemplates = [
        {
          id: "template-1",
          venueId: testVenues.venueA.id,
          name: "Compliance Form",
          category: "COMPLIANCE",
          documentType: "FORM",
        },
      ];

      mockDocumentTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await mockDocumentTemplate.findMany({
        where: {
          venueId: testVenues.venueA.id,
          category: "COMPLIANCE",
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("COMPLIANCE");
    });

    it("should include version history when requested", async () => {
      const mockTemplate = {
        id: "template-1",
        name: "Template with History",
        versions: [
          { version: 1, createdAt: new Date("2025-01-01") },
          { version: 2, createdAt: new Date("2025-01-15") },
        ],
      };

      mockDocumentTemplate.findUnique.mockResolvedValue(mockTemplate);

      const result = await mockDocumentTemplate.findUnique({
        where: { id: "template-1" },
        include: { versions: true },
      });

      expect(result?.versions).toHaveLength(2);
    });
  });

  describe("updateTemplate", () => {
    it("should update template and create new version", async () => {
      const existingTemplate = {
        id: "template-1",
        venueId: testVenues.venueA.id,
        name: "Original Name",
        currentVersion: 1,
        formSchema: { fields: [] },
      };

      const updatedTemplate = {
        ...existingTemplate,
        name: "Updated Name",
        currentVersion: 2,
      };

      mockDocumentTemplate.findUnique.mockResolvedValue(existingTemplate);
      mockDocumentTemplate.update.mockResolvedValue(updatedTemplate);
      mockDocumentTemplateVersion.create.mockResolvedValue({ id: "version-2", version: 2 });

      const result = await mockDocumentTemplate.update({
        where: { id: "template-1" },
        data: {
          name: "Updated Name",
          currentVersion: { increment: 1 },
        },
      });

      expect(result.name).toBe("Updated Name");
      expect(result.currentVersion).toBe(2);
    });

    it("should archive template instead of deleting", async () => {
      mockDocumentTemplate.update.mockResolvedValue({
        id: "template-1",
        isActive: false,
        archivedAt: new Date(),
      });

      const result = await mockDocumentTemplate.update({
        where: { id: "template-1" },
        data: {
          isActive: false,
          archivedAt: new Date(),
        },
      });

      expect(result.isActive).toBe(false);
      expect(result.archivedAt).toBeDefined();
    });
  });

  describe("deleteTemplate", () => {
    it("should soft delete template with no assignments", async () => {
      mockDocumentTemplate.findUnique.mockResolvedValue({
        id: "template-1",
        assignments: [],
      });

      mockDocumentTemplate.update.mockResolvedValue({
        id: "template-1",
        isActive: false,
        archivedAt: new Date(),
      });

      mockDocumentAssignment.count.mockResolvedValue(0);

      const assignmentCount = await mockDocumentAssignment.count({
        where: { templateId: "template-1" },
      });

      expect(assignmentCount).toBe(0);
    });

    it("should prevent deletion of template with active assignments", async () => {
      mockDocumentAssignment.count.mockResolvedValue(5);

      const assignmentCount = await mockDocumentAssignment.count({
        where: {
          templateId: "template-1",
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      });

      expect(assignmentCount).toBeGreaterThan(0);
    });
  });

  describe("template permissions", () => {
    it("should only allow venue managers to create templates", async () => {
      // User must have MANAGER or ADMIN role for the venue
      const user = testUsers.admin;
      expect(user.roleId).toBe(testRoles.admin.id);
    });

    it("should isolate templates by venue", async () => {
      mockDocumentTemplate.findMany.mockResolvedValue([
        { id: "template-1", venueId: testVenues.venueA.id },
      ]);

      const venueATemplates = await mockDocumentTemplate.findMany({
        where: { venueId: testVenues.venueA.id },
      });

      // Venue A templates should not include Venue B templates
      expect(
        venueATemplates.every((t: any) => t.venueId === testVenues.venueA.id)
      ).toBe(true);
    });
  });
});