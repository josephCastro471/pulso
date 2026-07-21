const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const controller = require('../controllers/medications.controller');
const {
  medicationBodySchema,
  medicationUpdateSchema,
  medicationQuerySchema,
  medicationLogSchema,
  medicationLogQuerySchema,
} = require('../schemas/medication.schema');

const router = express.Router();

router.use(authMiddleware);

router.get('/', validate(medicationQuerySchema, 'query'), controller.list);
router.post('/', validate(medicationBodySchema), controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', validate(medicationUpdateSchema), controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/logs', validate(medicationLogSchema), controller.upsertLog);
router.get('/:id/logs', validate(medicationLogQuerySchema, 'query'), controller.listLogs);

module.exports = router;
