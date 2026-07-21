const express = require('express');
const authRoutes = require('./auth.routes');
const symptomsRoutes = require('./symptoms.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/symptoms', symptomsRoutes);

module.exports = router;
