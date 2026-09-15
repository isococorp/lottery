import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@tianming.local";
  const password = process.env.SEED_ADMIN_PASSWORD;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed admin '${email}' already exists — skipping.`);
    return;
  }

  const tempPwd = password ?? generateTempPassword();
  const mustChangePassword = !password;

  const hash = await argon2.hash(tempPwd, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const user = await prisma.user.create({
    data: {
      email,
      username: email.split("@")[0],
      displayName: "Super Admin",
      passwordHash: hash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      mustChangePassword,
    },
  });

  console.log(`\nCreated SUPER_ADMIN: ${user.email}`);
  console.log(`Password: ${tempPwd}`);
  if (mustChangePassword) {
    console.log("User will be forced to change password on first login.\n");
  }
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const special = "!@#$%";
  const bytes = crypto.randomBytes(12);
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[bytes[i] % chars.length];
  pwd += special[bytes[10] % special.length];
  pwd += bytes[11] % 10;
  return pwd;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
