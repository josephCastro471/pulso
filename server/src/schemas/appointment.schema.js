const { z } = require('zod');

const appointmentBodySchema = z.object({
  doctor: z.string().trim().min(1, 'El doctor es requerido'),
  specialty: z.string().trim().min(1, 'La especialidad es requerida'),
  datetime: z.string().datetime({ message: 'datetime debe ser ISO 8601' }),
  location: z.string().trim().min(1, 'La ubicación es requerida'),
});

const appointmentUpdateSchema = appointmentBodySchema.partial();

const appointmentQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

module.exports = { appointmentBodySchema, appointmentUpdateSchema, appointmentQuerySchema };
