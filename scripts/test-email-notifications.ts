/**
 * Email Notification Test Script
 *
 * Sends sample emails of all notification templates to sharma089.vishal@gmail.com
 * for review and testing.
 *
 * Usage: npx tsx scripts/test-email-notifications.ts
 */

// Load environment variables - load .env first, then .env.local (like Next.js does)
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") }); // Load .env first
config({ path: resolve(process.cwd(), ".env.local"), override: true }); // Then .env.local with override

import { sendBrevoEmail } from "../src/lib/services/email/brevo";
import { getEmailTemplate } from "../src/lib/services/email/templates";
import { NotificationType } from "@prisma/client";

const TEST_EMAIL = "sharma089.vishal@gmail.com";
const TEST_USER_NAME = "Nick Sharma";

interface TestEmailConfig {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  data?: any;
}

const testEmails: TestEmailConfig[] = [
  // MESSAGE NOTIFICATIONS (4)
  {
    type: "NEW_MESSAGE",
    title: "New Message from John Doe",
    message: "John Doe sent you a message: 'Hey, are you available for a shift swap this Saturday?'",
    link: "/messages",
    data: {
      senderName: "John Doe",
      messagePreview: "Hey, are you available for a shift swap this Saturday?",
    },
  },
  {
    type: "MESSAGE_REPLY",
    title: "Jane Smith replied to your message",
    message: "Jane Smith replied: 'Yes, I can cover for you on Monday afternoon!'",
    link: "/messages",
    data: {
      senderName: "Jane Smith",
      originalMessage: "Can someone cover my shift on Monday?",
      replyText: "Yes, I can cover for you on Monday afternoon!",
    },
  },
  {
    type: "MESSAGE_MENTION",
    title: "Mike Johnson mentioned you",
    message: "Mike Johnson mentioned you in #general: '@Nick what time does the shift start tomorrow?'",
    link: "/messages",
    data: {
      senderName: "Mike Johnson",
      channelName: "#general",
      messageText: "@Nick what time does the shift start tomorrow?",
    },
  },
  {
    type: "MESSAGE_REACTION",
    title: "Sarah Lee reacted to your message",
    message: "Sarah Lee reacted 👍 to your message in #team-updates",
    link: "/messages",
    data: {
      senderName: "Sarah Lee",
      reaction: "👍",
      messageText: "Great job on closing last night, team!",
    },
  },

  // POST NOTIFICATIONS (3)
  {
    type: "POST_MENTION",
    title: "Alex Brown mentioned you in a post",
    message: "Alex Brown mentioned you in the Announcements channel: '@Nick please review the new schedule'",
    link: "/posts",
    data: {
      authorName: "Alex Brown",
      channelName: "Announcements",
      postContent: "@Nick please review the new schedule for next week and confirm availability",
    },
  },
  {
    type: "POST_PINNED",
    title: "Important: Team Meeting - Monday 10 AM",
    message: "Manager pinned an important post: 'Mandatory team meeting on Monday at 10 AM to discuss Q4 goals'",
    link: "/posts",
    data: {
      pinnedBy: "Store Manager",
      postTitle: "Team Meeting - Monday 10 AM",
      postContent: "Mandatory team meeting on Monday at 10 AM to discuss Q4 goals. Attendance is required for all staff.",
    },
  },
  {
    type: "POST_DELETED",
    title: "Your post was removed",
    message: "Your post in #general was removed by a moderator",
    link: "/posts",
    data: {
      channelName: "#general",
      reason: "Off-topic content",
      moderatorName: "Admin User",
    },
  },

  // TIME-OFF NOTIFICATIONS (4)
  {
    type: "TIME_OFF_REQUEST",
    title: "New Time-Off Request from Emily Davis",
    message: "Emily Davis has requested time off from Dec 20-27, 2024 (Vacation - Family trip)",
    link: "/admin/time-off",
    data: {
      employeeName: "Emily Davis",
      startDate: "December 20, 2024",
      endDate: "December 27, 2024",
      type: "Vacation",
      reason: "Family trip to Hawaii",
      daysRequested: 7,
    },
  },
  {
    type: "TIME_OFF_APPROVED",
    title: "Your vacation request has been approved!",
    message: "Good news! Your vacation request for Dec 20-27, 2024 has been approved by your manager.",
    link: "/time-off",
    data: {
      startDate: "December 20, 2024",
      endDate: "December 27, 2024",
      type: "Vacation",
      approvedBy: "Store Manager",
      approvedAt: new Date().toISOString(),
    },
  },
  {
    type: "TIME_OFF_REJECTED",
    title: "Your time-off request was not approved",
    message: "Your sick leave request for November 15, 2024 was denied. Reason: Insufficient staffing on requested date.",
    link: "/time-off",
    data: {
      startDate: "November 15, 2024",
      endDate: "November 15, 2024",
      type: "Sick Leave",
      rejectedBy: "Store Manager",
      reason: "Insufficient staffing on requested date. Please try to reschedule or find coverage.",
    },
  },
  {
    type: "TIME_OFF_CANCELLED",
    title: "Time-off request cancelled",
    message: "Your time-off request for January 5-10, 2025 has been cancelled.",
    link: "/time-off",
    data: {
      startDate: "January 5, 2025",
      endDate: "January 10, 2025",
      type: "Personal",
      cancelledBy: "Nick Sharma",
      cancelReason: "Plans changed",
    },
  },

  // USER/SYSTEM NOTIFICATIONS (4)
  {
    type: "USER_CREATED",
    title: "Welcome to Staff Portal!",
    message: "Your account has been created successfully. Get started by completing your profile and setting your availability.",
    link: "/profile",
    data: {
      userName: TEST_USER_NAME,
      setupSteps: [
        "Complete your profile information",
        "Set your weekly availability",
        "Review the employee handbook",
        "Join your team channels",
      ],
    },
  },
  {
    type: "USER_UPDATED",
    title: "Your profile has been updated",
    message: "Your profile information was updated successfully on " + new Date().toLocaleDateString(),
    link: "/profile",
    data: {
      updatedFields: ["Email address", "Phone number", "Emergency contact"],
      updatedBy: "Nick Sharma",
      updatedAt: new Date().toISOString(),
    },
  },
  {
    type: "ROLE_CHANGED",
    title: "Congratulations! You've been promoted",
    message: "You've been promoted from Staff to Shift Manager. Your new permissions are now active.",
    link: "/profile",
    data: {
      previousRole: "Staff",
      newRole: "Shift Manager",
      changedBy: "Store Manager",
      effectiveDate: new Date().toLocaleDateString(),
      newPermissions: [
        "Approve time-off requests",
        "Manage team schedules",
        "View team availability",
        "Send team announcements",
      ],
    },
  },
  {
    type: "SYSTEM_ANNOUNCEMENT",
    title: "System Maintenance - Saturday Night",
    message: "The Staff Portal will be offline for scheduled maintenance on Saturday, Nov 16 from 11 PM to 2 AM.",
    link: "/",
    data: {
      announcementTitle: "Scheduled System Maintenance",
      announcementBody: "The Staff Portal will be offline for scheduled maintenance on Saturday, November 16th from 11:00 PM to 2:00 AM EST. During this time, you will not be able to access the portal. Please plan accordingly.",
      impact: "No access to portal, schedules, or messaging",
      workaround: "Contact your manager directly for urgent scheduling needs",
      postedBy: "IT Administrator",
      postedAt: new Date().toISOString(),
    },
  },
];

async function sendTestEmails() {
  console.log("\n🧪 EMAIL NOTIFICATION TEST SUITE");
  console.log("================================\n");
  console.log(`📧 Test recipient: ${TEST_EMAIL}`);
  console.log(`📝 Total templates to test: ${testEmails.length}\n`);

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < testEmails.length; i++) {
    const test = testEmails[i];
    const testNumber = i + 1;

    console.log(`\n[${testNumber}/${testEmails.length}] Testing: ${test.type}`);
    console.log(`   Title: ${test.title}`);

    try {
      // Get the email template
      const { subject, htmlContent } = getEmailTemplate(
        test.type,
        test.title,
        test.message,
        test.link
      );

      // Send the email
      const result = await sendBrevoEmail({
        to: TEST_EMAIL,
        toName: TEST_USER_NAME,
        subject,
        htmlContent,
      });

      if (result.success) {
        console.log(`   ✅ SUCCESS - Message ID: ${result.messageId}`);
        successCount++;
      } else {
        console.log(`   ❌ FAILED - ${result.error}`);
        failureCount++;
      }
    } catch (error) {
      console.log(`   ❌ ERROR - ${error instanceof Error ? error.message : String(error)}`);
      failureCount++;
    }

    // Add a small delay between emails to avoid rate limiting
    if (i < testEmails.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Summary
  console.log("\n\n📊 TEST SUMMARY");
  console.log("===============");
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📧 Total: ${testEmails.length}`);
  console.log(`\n📬 Check inbox: ${TEST_EMAIL}`);

  if (successCount === testEmails.length) {
    console.log("\n🎉 All test emails sent successfully!");
  } else if (successCount > 0) {
    console.log("\n⚠️  Some emails failed to send. Check logs above for details.");
  } else {
    console.log("\n❌ All emails failed. Please check:");
    console.log("   1. BREVO_API_KEY is set in .env.local");
    console.log("   2. Brevo API key is valid");
    console.log("   3. Sender email is verified in Brevo");
  }
}

// Run the tests
sendTestEmails()
  .then(() => {
    console.log("\n✨ Test script completed\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
