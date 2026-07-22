import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  if (users.length === 0) {
    console.log("Inga användare hittades.");
    return;
  }

  for (const u of users) {
    console.log(`${u.email}  |  roll: ${u.role}  |  namn: ${u.name}  |  skapad: ${u.createdAt.toISOString()}  |  id: ${u.id}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
