const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const controller = require('../controllers/appointments.controller');
const {
  appointmentBodySchema,
  appointmentUpdateSchema,
  appointmentQuerySchema,
} = require('../schemas/appointment.schema');

const router = express.Router();

router.use(authMiddleware);

router.get('/', validate(appointmentQuerySchema, 'query'), controller.list);
router.post('/', validate(appointmentBodySchema), controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', validate(appointmentUpdateSchema), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
