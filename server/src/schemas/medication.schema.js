const { z } = require('zod');

const medicationBodySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido'),
  dosage: z.string().trim().min(1, 'La dosis es requerida'),
  frequency: z.string().trim().min(1, 'La frecuencia es requerida'),
});

const medicationUpdateSchema = medicationBodySchema.partial();

const medicationQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

const medicationLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date debe tener formato YYYY-MM-DD'),
  taken: z.boolean(),
});

const medicationLogQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

module.exports = {
  medicationBodySchema,
  medicationUpdateSchema,
  medicationQuerySchema,
  medicationLogSchema,
  medicationLogQuerySchema,
};
