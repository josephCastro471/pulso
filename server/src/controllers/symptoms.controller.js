const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { parsePagination, parseDateRange } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const datetimeFilter = parseDateRange(req.query);

    const where = {
      userId: req.user.id,
      ...(datetimeFilter ? { datetime: datetimeFilter } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.symptom.findMany({ where, orderBy: { datetime: 'desc' }, skip, take: limit }),
      prisma.symptom.count({ where }),
    ]);

    res.status(200).json({ data, pagination: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { datetime, description, intensity } = req.body;
    const symptom = await prisma.symptom.create({
      data: { userId: req.user.id, datetime: new Date(datetime), description, intensity },
    });
    res.status(201).json(symptom);
  } catch (err) {
    next(err);
  }
}

async function findOwned(id, userId) {
  const symptom = await prisma.symptom.findUnique({ where: { id } });
  if (!symptom || symptom.userId !== userId) {
    return null;
  }
  return symptom;
}

async function getOne(req, res, next) {
  try {
    const symptom = await findOwned(req.params.id, req.user.id);
    if (!symptom) {
      throw new AppError(404, 'NOT_FOUND', 'Síntoma no encontrado');
    }
    res.status(200).json(symptom);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await findOwned(req.params.id, req.user.id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Síntoma no encontrado');
    }

    const data = { ...req.body };
    if (data.datetime) {
      data.datetime = new Date(data.datetime);
    }

    const symptom = await prisma.symptom.update({ where: { id: req.params.id }, data });
    res.status(200).json(symptom);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await findOwned(req.params.id, req.user.id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Síntoma no encontrado');
    }

    await prisma.symptom.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getOne, update, remove };
