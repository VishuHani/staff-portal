import { NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;

export function apiSuccess<T extends JsonRecord>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      success: true,
      data,
      ...data,
    },
    init
  );
}

export function apiError(message: string, status = 500, extra?: JsonRecord) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(extra ?? {}),
    },
    { status }
  );
}
