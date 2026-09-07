const { z } = require('zod');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }

    req.validated = result.data;
    next();
  };
}

const schemas = {
  register: z.object({
    body: z.object({
      email: z.string().email().max(254),
      password: z.string().min(8).max(128).regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
        'Password must contain uppercase, lowercase, number, and special character'
      ),
      fullName: z.string().min(2).max(200),
      specialty: z.string().max(100).optional(),
      hospitalName: z.string().max(200).optional(),
    }),
  }),

  login: z.object({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
  }),

  identifyPatient: z.object({
    body: z.object({
      abhaId: z.string().max(50).optional(),
      fullName: z.string().min(2).max(200).optional(),
      language: z.enum(['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml']).optional(),
      phoneNumber: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
  }),

  startSession: z.object({
    body: z.object({
      patientId: z.string().uuid(),
    }),
  }),

  sendMessage: z.object({
    body: z.object({
      message: z.string().min(1).max(2000),
    }),
    params: z.object({
      sessionId: z.string().uuid(),
    }),
  }),
};

module.exports = { validate, schemas };
