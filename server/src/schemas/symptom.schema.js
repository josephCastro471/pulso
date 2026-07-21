const { z } = require('zod');

const symptomBodySchema = z.object({
  datetime: z.string().datetime({ message: 'datetime debe ser ISO 8601' }),
  description: z.string().trim().min(1, 'La descripción es requerida'),
  intensity: z.number().int().min(1, 'La intensidad mínima es 1').max(5, 'La intensidad máxima es 5'),
});

const symptomUpdateSchema = symptomBodySchema.partial();

const symptomQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

module.exports = { symptomBodySchema, symptomUpdateSchema, symptomQuerySchema };
