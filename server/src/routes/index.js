const express = require('express');
const authRoutes = require('./auth.routes');
const symptomsRoutes = require('./symptoms.routes');
const medicationsRoutes = require('./medications.routes');
const appointmentsRoutes = require('./appointments.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/symptoms', symptomsRoutes);
router.use('/medications', medicationsRoutes);
router.use('/appointments', appointmentsRoutes);

module.exports = router;
