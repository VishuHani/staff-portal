import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import { hasPermission } from '@/lib/rbac/permissions';

interface VenuePayConfigRequest {
  venueId: string;
  defaultWeekdayRate?: number | null;
  defaultSaturdayRate?: number | null;
  defaultSundayRate?: number | null;
  defaultPublicHolidayRate?: number | null;
  defaultOvertimeRate?: number | null;
  defaultLateRate?: number | null;
  overtimeThresholdHours?: number;
  overtimeMultiplier?: number | null;
  lateStartHour?: number;
  autoCalculateBreaks?: boolean;
  breakThresholdHours?: number;
  defaultBreakMinutes?: number;
  publicHolidayRegion?: string;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json({ error: 'Venue ID is required' }, { status: 400 });
    }

    // Check permissions - use 'venues' resource with 'manage' action
    const canManage = await hasPermission(user.id, 'venues', 'manage', venueId);
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payConfig = await prisma.venuePayConfig.findUnique({
      where: { venueId },
    });

    return NextResponse.json({ payConfig });
  } catch (error) {
    console.error('Error fetching venue pay config:', error);
    return NextResponse.json({ error: 'Failed to fetch pay config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: VenuePayConfigRequest = await request.json();

    // Validate required fields
    if (!body.venueId) {
      return NextResponse.json({ error: 'Venue ID is required' }, { status: 400 });
    }

    // Check permissions - use 'venues' resource with 'manage' action
    const canManage = await hasPermission(user.id, 'venues', 'manage', body.venueId);
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Upsert venue pay config
    const payConfig = await prisma.venuePayConfig.upsert({
      where: { venueId: body.venueId },
      update: {
        defaultWeekdayRate: body.defaultWeekdayRate !== undefined ? body.defaultWeekdayRate : undefined,
        defaultSaturdayRate: body.defaultSaturdayRate !== undefined ? body.defaultSaturdayRate : undefined,
        defaultSundayRate: body.defaultSundayRate !== undefined ? body.defaultSundayRate : undefined,
        defaultPublicHolidayRate: body.defaultPublicHolidayRate !== undefined ? body.defaultPublicHolidayRate : undefined,
        defaultOvertimeRate: body.defaultOvertimeRate !== undefined ? body.defaultOvertimeRate : undefined,
        defaultLateRate: body.defaultLateRate !== undefined ? body.defaultLateRate : undefined,
        overtimeThresholdHours: body.overtimeThresholdHours,
        overtimeMultiplier: body.overtimeMultiplier,
        lateStartHour: body.lateStartHour,
        autoCalculateBreaks: body.autoCalculateBreaks,
        breakThresholdHours: body.breakThresholdHours,
        defaultBreakMinutes: body.defaultBreakMinutes,
        publicHolidayRegion: body.publicHolidayRegion,
      },
      create: {
        venueId: body.venueId,
        defaultWeekdayRate: body.defaultWeekdayRate,
        defaultSaturdayRate: body.defaultSaturdayRate,
        defaultSundayRate: body.defaultSundayRate,
        defaultPublicHolidayRate: body.defaultPublicHolidayRate,
        defaultOvertimeRate: body.defaultOvertimeRate,
        defaultLateRate: body.defaultLateRate,
        overtimeThresholdHours: body.overtimeThresholdHours ?? 8,
        overtimeMultiplier: body.overtimeMultiplier ?? 1.5,
        lateStartHour: body.lateStartHour ?? 22,
        autoCalculateBreaks: body.autoCalculateBreaks ?? true,
        breakThresholdHours: body.breakThresholdHours ?? 4,
        defaultBreakMinutes: body.defaultBreakMinutes ?? 30,
        publicHolidayRegion: body.publicHolidayRegion ?? 'NSW',
      },
    });

    return NextResponse.json({ 
      success: true,
      payConfig 
    });
  } catch (error) {
    console.error('Error saving venue pay config:', error);
    return NextResponse.json({ error: 'Failed to save pay config' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json({ error: 'Venue ID is required' }, { status: 400 });
    }

    // Check permissions - use 'venues' resource with 'manage' action
    const canManage = await hasPermission(user.id, 'venues', 'manage', venueId);
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete venue pay config
    await prisma.venuePayConfig.delete({
      where: { venueId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting venue pay config:', error);
    return NextResponse.json({ error: 'Failed to delete pay config' }, { status: 500 });
  }
}
