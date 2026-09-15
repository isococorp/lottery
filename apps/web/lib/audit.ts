import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { prisma } from "./prisma";
import { redactSensitiveFields } from "./redact";

const LOG_DIR = process.env.AUDIT_LOG_DIR ?? "./logs";
const RETENTION_DAYS = process.env.AUDIT_LOG_RETENTION_DAYS ?? "90";

const fileLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: "app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: `${RETENTION_DAYS}d`,
      zippedArchive: true,
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  fileLogger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  );
}

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "SESSION_EXPIRED"
  | "ACCOUNT_LOCKED"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET_BY_ADMIN"
  | "USER_CREATE"
  | "USER_UPDATE"
  | "USER_STATUS_CHANGE"
  | "ROLE_CHANGE"
  | "USER_DELETE"
  | "FORCE_LOGOUT"
  | "VIEW_AUDIT_LOG"
  | "EXPORT_DATA"
  | "DRAW_FETCH"
  | "DRAW_UPSERT"
  | "SYSTEM_ERROR";

type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

interface AuditEntry {
  userId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  targetType?: string | null;
  targetId?: string | null;
  ipAddress: string;
  userAgent: string;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: unknown;
  severity?: Severity;
}

export async function writeAuditLog(entry: AuditEntry) {
  const severity = entry.severity ?? "INFO";

  const redactedBefore = entry.beforeState
    ? redactSensitiveFields(entry.beforeState)
    : undefined;
  const redactedAfter = entry.afterState
    ? redactSensitiveFields(entry.afterState)
    : undefined;
  const redactedMeta = entry.metadata
    ? redactSensitiveFields(entry.metadata)
    : undefined;

  const fileEntry = {
    level: severity.toLowerCase(),
    action: entry.action,
    userId: entry.userId,
    actorEmail: entry.actorEmail,
    ip: entry.ipAddress,
    ua: entry.userAgent,
    method: entry.method,
    path: entry.path,
    statusCode: entry.statusCode,
    targetType: entry.targetType,
    targetId: entry.targetId,
  };
  fileLogger.log(severity.toLowerCase() as string, fileEntry);

  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        actorEmail: entry.actorEmail,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        method: entry.method,
        path: entry.path,
        statusCode: entry.statusCode,
        beforeState: redactedBefore ? JSON.stringify(redactedBefore) : null,
        afterState: redactedAfter ? JSON.stringify(redactedAfter) : null,
        metadata: redactedMeta ? JSON.stringify(redactedMeta) : null,
        severity,
      },
    });
  } catch (err) {
    fileLogger.error({
      level: "error",
      action: "AUDIT_DB_WRITE_FAILED",
      error: String(err),
      originalAction: entry.action,
    });
  }
}

export function getClientInfo(req: Request) {
  const headers = new Headers(req.headers);
  const ipAddress =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = headers.get("user-agent") ?? "unknown";
  return { ipAddress, userAgent };
}
