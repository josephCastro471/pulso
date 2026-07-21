const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const controller = require('../controllers/symptoms.controller');
const {
  symptomBodySchema,
  symptomUpdateSchema,
  symptomQuerySchema,
} = require('../schemas/symptom.schema');

const router = express.Router();

router.use(authMiddleware);

router.get('/', validate(symptomQuerySchema, 'query'), controller.list);
router.post('/', validate(symptomBodySchema), controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', validate(symptomUpdateSchema), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
