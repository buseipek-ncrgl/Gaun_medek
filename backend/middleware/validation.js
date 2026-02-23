/**
 * Input Validation Middleware using Joi
 * Validates request body, params, and query
 */

import Joi from 'joi';
import { AppError } from '../utils/errorHandler.js';

/**
 * Generic validation middleware
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'body' ? req.body : source === 'params' ? req.params : req.query;
    
    const { error, value } = schema.validate(data, {
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true, // Remove unknown fields
      allowUnknown: false, // Don't allow unknown fields
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      const validationError = new AppError('Validation failed', 400);
      validationError.validationErrors = errors;
      return next(validationError);
    }

    // Replace request data with validated and sanitized data
    if (source === 'body') {
      req.body = value;
    } else if (source === 'params') {
      req.params = value;
    } else {
      req.query = value;
    }

    next();
  };
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  objectId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Invalid ObjectId format',
    'string.length': 'ObjectId must be 24 characters',
    'any.required': 'ObjectId is required',
  }),
  
  objectIdOptional: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'Invalid ObjectId format',
    'string.length': 'ObjectId must be 24 characters',
  }),

  examType: Joi.string().valid('midterm', 'final').required().messages({
    'any.only': 'examType must be either "midterm" or "final"',
    'any.required': 'examType is required',
  }),

  examCode: Joi.string().trim().min(1).max(50).required().messages({
    'string.empty': 'examCode cannot be empty',
    'string.min': 'examCode must be at least 1 character',
    'string.max': 'examCode must not exceed 50 characters',
    'any.required': 'examCode is required',
  }),

  studentNumber: Joi.string().trim().min(1).max(50).required().messages({
    'string.empty': 'studentNumber cannot be empty',
    'string.min': 'studentNumber must be at least 1 character',
    'string.max': 'studentNumber must not exceed 50 characters',
    'any.required': 'studentNumber is required',
  }),

  totalScore: Joi.number().min(0).max(100).required().messages({
    'number.min': 'totalScore must be at least 0',
    'number.max': 'totalScore must not exceed 100',
    'any.required': 'totalScore is required',
  }),

  percentage: Joi.number().min(0).max(100).required().messages({
    'number.min': 'percentage must be at least 0',
    'number.max': 'percentage must not exceed 100',
    'any.required': 'percentage is required',
  }),

  learningOutcomeCode: Joi.string().trim().min(1).max(20).required().messages({
    'string.empty': 'learningOutcomeCode cannot be empty',
    'string.min': 'learningOutcomeCode must be at least 1 character',
    'string.max': 'learningOutcomeCode must not exceed 20 characters',
    'any.required': 'learningOutcomeCode is required',
  }),

  learningOutcomes: Joi.array().items(Joi.string().trim().min(1).max(20)).optional().messages({
    'array.base': 'learningOutcomes must be an array',
  }),
};

/**
 * Exam validation schemas
 */
export const examSchemas = {
  create: Joi.object({
    courseId: commonSchemas.objectId,
    examType: commonSchemas.examType,
    examCode: commonSchemas.examCode,
    learningOutcomes: commonSchemas.learningOutcomes,
  }),

  update: Joi.object({
    examType: commonSchemas.examType.optional(),
    examCode: commonSchemas.examCode.optional(),
    learningOutcomes: commonSchemas.learningOutcomes,
    maxScore: Joi.number().min(0).max(100).optional(),
    passingScore: Joi.number().min(0).max(100).optional(),
    questions: Joi.array()
      .items(
        Joi.object({
          questionNumber: Joi.number().integer().min(1),
          learningOutcomeCode: Joi.string().allow('').optional(),
        })
      )
      .optional(),
  }),

  getById: Joi.object({
    id: commonSchemas.objectId,
  }),

  getByCourse: Joi.object({
    courseId: commonSchemas.objectId,
  }),
};

/**
 * Student Exam Result validation schemas
 */
export const studentExamResultSchemas = {
  createOrUpdate: Joi.object({
    studentNumber: commonSchemas.studentNumber,
    examId: commonSchemas.objectId,
    courseId: commonSchemas.objectId,
    totalScore: commonSchemas.totalScore,
    percentage: commonSchemas.percentage,
  }),
};

/**
 * Course validation schemas
 */
export const courseSchemas = {
  create: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    code: Joi.string().trim().min(1).max(50).required(),
    description: Joi.string().trim().max(1000).optional(),
    department: commonSchemas.objectIdOptional,
    program: commonSchemas.objectIdOptional,
    semester: Joi.number().integer().min(1).max(8).optional(),
  }),

  update: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    code: Joi.string().trim().min(1).max(50).optional(),
    description: Joi.string().trim().max(1000).optional(),
    department: commonSchemas.objectIdOptional,
    program: commonSchemas.objectIdOptional,
    semester: Joi.number().integer().min(1).max(8).optional(),
  }),
};

/**
 * Student validation schemas
 */
export const studentSchemas = {
  create: Joi.object({
    studentNumber: commonSchemas.studentNumber,
    name: Joi.string().trim().min(1).max(200).required(),
    surname: Joi.string().trim().min(1).max(200).required(),
    email: Joi.string().email().optional(),
    courseId: commonSchemas.objectId,
  }),

  update: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    surname: Joi.string().trim().min(1).max(200).optional(),
    email: Joi.string().email().optional(),
  }),
};

