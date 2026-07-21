const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { parsePagination } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { userId: req.user.id };

    const [data, total] = await Promise.all([
      prisma.medication.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.medication.count({ where }),
    ]);

    res.status(200).json({ data, pagination: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, dosage, frequency } = req.body;
    const medication = await prisma.medication.create({
      data: { userId: req.user.id, name, dosage, frequency },
    });
    res.status(201).json(medication);
  } catch (err) {
    next(err);
  }
}

async function findOwned(id, userId) {
  const medication = await prisma.medication.findUnique({ where: { id } });
  if (!medication || medication.userId !== userId) {
    return null;
  }
  return medication;
}

async function getOne(req, res, next) {
  try {
    const medication = await findOwned(req.params.id, req.user.id);
    if (!medication) {
      throw new AppError(404, 'NOT_FOUND', 'Medicamento no encontrado');
    }
    res.status(200).json(medication);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await findOwned(req.params.id, req.user.id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Medicamento no encontrado');
    }

    const medication = await prisma.medication.update({ where: { id: req.params.id }, data: req.body });
    res.status(200).json(medication);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await findOwned(req.params.id, req.user.id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Medicamento no encontrado');
    }

    await prisma.medication.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function upsertLog(req, res, next) {
  try {
    const medication = await findOwned(req.params.id, req.user.id);
    if (!medication) {
      throw new AppError(404, 'NOT_FOUND', 'Medicamento no encontrado');
    }

    const { date, taken } = req.body;
    const parsedDate = new Date(`${date}T00:00:00.000Z`);

    const log = await prisma.medicationLog.upsert({
      where: { medicationId_date: { medicationId: medication.id, date: parsedDate } },
      update: { taken },
      create: { medicationId: medication.id, date: parsedDate, taken },
    });

    res.status(200).json(log);
  } catch (err) {
    next(err);
  }
}

async function listLogs(req, res, next) {
  try {
    const medication = await findOwned(req.params.id, req.user.id);
    if (!medication) {
      throw new AppError(404, 'NOT_FOUND', 'Medicamento no encontrado');
    }

    const where = { medicationId: medication.id };
    if (req.query.from || req.query.to) {
      where.date = {};
      if (req.query.from) where.date.gte = new Date(`${req.query.from}T00:00:00.000Z`);
      if (req.query.to) where.date.lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }

    const logs = await prisma.medicationLog.findMany({ where, orderBy: { date: 'asc' } });
    res.status(200).json({ data: logs });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getOne, update, remove, findOwned, upsertLog, listLogs };
