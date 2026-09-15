import argon2 from "argon2";

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

const MIN_LENGTH = 10;

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < MIN_LENGTH) return `รหัสผ่านต้องมีอย่างน้อย ${MIN_LENGTH} ตัวอักษร`;
  if (!/[a-z]/.test(password)) return "รหัสผ่านต้องมีตัวอักษรพิมพ์เล็กอย่างน้อย 1 ตัว";
  if (!/[A-Z]/.test(password)) return "รหัสผ่านต้องมีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว";
  if (!/[0-9]/.test(password)) return "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว";
  return null;
}

export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const special = "!@#$%";
  const crypto = require("crypto") as typeof import("crypto");
  const bytes = crypto.randomBytes(12);
  let pwd = "";
  for (let i = 0; i < 10; i++) {
    pwd += chars[bytes[i] % chars.length];
  }
  pwd += special[bytes[10] % special.length];
  pwd += bytes[11] % 10;
  return pwd;
}
