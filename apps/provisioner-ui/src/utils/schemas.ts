import { z } from 'zod';

const alphanumericRegex = /^[a-zA-Z0-9]+$/;

export const typificationSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Name can only contain letters, numbers, underscores, and hyphens')
    .refine((val) => !val.startsWith('-') && !val.endsWith('-'), {
      message: 'Name cannot start or end with a hyphen',
    }),
  prefijo1: z
    .string()
    .min(1, 'Prefix 1 is required')
    .min(2, 'Prefix 1 must be at least 2 characters')
    .max(20, 'Prefix 1 must be less than 20 characters')
    .regex(alphanumericRegex, 'Prefix 1 can only contain letters and numbers'),
  prefijo2: z
    .string()
    .min(1, 'Prefix 2 is required')
    .min(2, 'Prefix 2 must be at least 2 characters')
    .max(20, 'Prefix 2 must be less than 20 characters')
    .regex(alphanumericRegex, 'Prefix 2 can only contain letters and numbers'),
  seq_digits: z
    .number()
    .min(1, 'Sequence digits must be at least 1')
    .max(6, 'Sequence digits must be at most 6'),
  edit_reason: z.string().optional(),
});

export type TypificationFormData = z.infer<typeof typificationSchema>;

export const vmClassSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s_-]+$/, 'Name can only contain letters, numbers, spaces, underscores, and hyphens'),
  description: z
    .string()
    .min(1, 'Description is required')
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be less than 500 characters'),
  cpu_cores: z
    .number()
    .min(1, 'CPU cores must be at least 1')
    .max(256, 'CPU cores cannot exceed 256'),
  memory_mb: z
    .number()
    .min(512, 'Memory must be at least 512 MB')
    .max(1048576, 'Memory cannot exceed 1 TB (1048576 MB)'),
  storage_gb: z
    .number()
    .min(1, 'Storage must be at least 1 GB')
    .max(16384, 'Storage cannot exceed 16 TB (16384 GB)'),
  cpu_reservation_percent: z
    .number()
    .min(0, 'CPU reservation cannot be negative')
    .max(100, 'CPU reservation cannot exceed 100%'),
  memory_reservation_percent: z
    .number()
    .min(0, 'Memory reservation cannot be negative')
    .max(100, 'Memory reservation cannot exceed 100%'),
  provisioning_type: z.enum(['thin', 'thick']).refine(
    (val) => ['thin', 'thick'].includes(val),
    { message: 'Please select a provisioning type' }
  ),
  edit_reason: z.string().optional(),
});

export type VMClassFormData = z.infer<typeof vmClassSchema>;

export function getTypificationErrors(formData: TypificationFormData): Partial<Record<keyof TypificationFormData, string>> {
  const errors: Partial<Record<keyof TypificationFormData, string>> = {};

  if (!formData.name.trim()) {
    errors.name = 'Name is required';
  } else if (formData.name.length < 3) {
    errors.name = 'Name must be at least 3 characters';
  } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.name)) {
    errors.name = 'Name can only contain letters, numbers, underscores, and hyphens';
  }

  if (!formData.prefijo1.trim()) {
    errors.prefijo1 = 'Prefix 1 is required';
  } else if (!alphanumericRegex.test(formData.prefijo1)) {
    errors.prefijo1 = 'Prefix 1 can only contain letters and numbers';
  }

  if (!formData.prefijo2.trim()) {
    errors.prefijo2 = 'Prefix 2 is required';
  } else if (!alphanumericRegex.test(formData.prefijo2)) {
    errors.prefijo2 = 'Prefix 2 can only contain letters and numbers';
  }

  if (formData.seq_digits < 1 || formData.seq_digits > 6) {
    errors.seq_digits = 'Sequence digits must be between 1 and 6';
  }

  return errors;
}

export function getVMClassErrors(formData: VMClassFormData): Partial<Record<keyof VMClassFormData, string>> {
  const errors: Partial<Record<keyof VMClassFormData, string>> = {};

  if (!formData.name.trim()) {
    errors.name = 'Name is required';
  }

  if (!formData.description.trim()) {
    errors.description = 'Description is required';
  } else if (formData.description.length < 10) {
    errors.description = 'Description must be at least 10 characters';
  }

  if (formData.cpu_cores < 1) {
    errors.cpu_cores = 'CPU cores must be at least 1';
  }

  if (formData.memory_mb < 512) {
    errors.memory_mb = 'Memory must be at least 512 MB';
  }

  if (formData.storage_gb < 1) {
    errors.storage_gb = 'Storage must be at least 1 GB';
  }

  return errors;
}

export function validateTypification(formData: TypificationFormData): boolean {
  const errors = getTypificationErrors(formData);
  return Object.keys(errors).length === 0;
}

export function validateVMClass(formData: VMClassFormData): boolean {
  const errors = getVMClassErrors(formData);
  return Object.keys(errors).length === 0;
}
