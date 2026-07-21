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
      prisma.appointment.findMany({ where, orderBy: { datetime: 'asc' }, skip, take: limit }),
      prisma.appointment.count({ where }),
    ]);

    res.status(200).json({ data, pagination: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { doctor, specialty, datetime, location } = req.body;
    const appointment = await prisma.appointment.create({
      data: { userId: req.user.id, doctor, specialty, datetime: new Date(datetime), location },
    });
    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
}

async function findOwned(id, userId) {
  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment || appointment.userId !== userId) {
    return null;
  }
  return appointment;
}

async function getOne(req, res, next) {
  try {
    const appointment = await findOwned(req.params.id, req.user.id);
    if (!appointment) {
      throw new AppError(404, 'NOT_FOUND', 'Cita no encontrada');
    }
    res.status(200).json(appointment);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await findOwned(req.params.id, req.user.id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Cita no encontrada');
    }

    const data = { ...req.body };
    if (data.datetime) {
      data.datetime = new Date(data.datetime);
    }

    const appointment = await prisma.appointment.update({ where: { id: req.params.id }, data });
    res.status(200).json(appointment);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await findOwned(req.params.id, req.user.id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Cita no encontrada');
    }

    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getOne, update, remove };
