import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment before seeding."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {}, // never clobber an existing admin's password on re-seed
    create: {
      email,
      passwordHash,
      name: "Administratör",
      role: Role.ADMIN,
    },
  });

  // Link an Inspector profile to the admin so signature/cert fields exist.
  await prisma.inspector.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      name: user.name,
      title: "Certifierad besiktningsman SBR",
      certBody: "SBR",
      email: user.email,
    },
  });

  // Ensure the singleton settings row exists.
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  console.log(`Seeded admin user: ${user.email}`);
  console.log("IMPORTANT: rotate this password after first login.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
