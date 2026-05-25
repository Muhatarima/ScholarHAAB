import { Errors } from '@/lib/errors/AppError';

export function validateQuestion(input: unknown): string {
  if (typeof input !== 'string') {
    throw Errors.INVALID_INPUT('Question must be a string');
  }

  const trimmed = input.trim();
  if (trimmed.length < 3) {
    throw Errors.INVALID_INPUT('Question too short');
  }

  if (trimmed.length > 2000) {
    throw Errors.INVALID_INPUT('Question too long (max 2000 characters)');
  }

  const dangerous = /<script|javascript:|on\w+=/i;
  if (dangerous.test(trimmed)) {
    throw Errors.INVALID_INPUT('Invalid input');
  }

  return trimmed;
}

export function validateEmail(input: unknown): string {
  if (typeof input !== 'string') throw Errors.INVALID_INPUT('Invalid email');

  const trimmed = input.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) throw Errors.INVALID_INPUT('Invalid email format');
  if (trimmed.length > 254) throw Errors.INVALID_INPUT('Email too long');

  return trimmed;
}

export function validateSubject(input: unknown): string {
  const valid = [
    'Physics',
    'Chemistry',
    'Mathematics',
    'Biology',
    'English',
    'Economics',
    'Computer Science',
    'Accounting',
    'General',
  ];

  if (typeof input !== 'string') return 'General';

  const match = valid.find((subject) => subject.toLowerCase() === input.toLowerCase());
  return match || 'General';
}
