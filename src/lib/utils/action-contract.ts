import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type ActionSuccess<T extends object = object> = {
  success: true;
} & T;

export type ActionFailure = {
  success: false;
  error: string;
};

export type ActionResult<T extends object = object> = {
  success: boolean;
  error?: string;
} & Partial<T>;

export function actionSuccess<T extends object>(data: T): ActionResult<T> {
  return {
    success: true,
    ...data,
  };
}

export function actionFailure(error: string): ActionResult {
  return {
    success: false,
    error,
  };
}

export function logActionError(
  action: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  if (context && Object.keys(context).length > 0) {
    console.error(`[${action}]`, { error, ...context });
    return;
  }

  console.error(`[${action}]`, error);
}

export function revalidatePaths(paths: string[] | string, ...rest: string[]) {
  const normalizedPaths = Array.isArray(paths) ? paths : [paths, ...rest];

  for (const path of new Set(normalizedPaths)) {
    revalidatePath(path);
  }
}

export function isPrismaUniqueViolation(error: unknown, target?: string | string[]) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2002") {
    return false;
  }

  if (!target) {
    return true;
  }

  const expectedTargets = Array.isArray(target) ? target : [target];
  const actualTargets = error.meta?.target;
  const normalizedTargets = Array.isArray(actualTargets)
    ? actualTargets
    : typeof actualTargets === "string"
      ? [actualTargets]
      : [];

  if (normalizedTargets.length === 0) {
    return true;
  }

  return normalizedTargets.some((actual) =>
    expectedTargets.some((expected) => actual.includes(expected))
  );
}
