const prisma = require('../src/config/db');

afterEach(async () => {
  await prisma.medicationLog.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.symptom.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
