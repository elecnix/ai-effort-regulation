import { Request, Response, NextFunction } from 'express';

export interface ValidationRule {
  param: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

export function validateQueryParams(rules: ValidationRule[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.query[rule.param];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${rule.param} is required`);
        continue;
      }

      if (value === undefined || value === null || value === '') {
        continue; // Skip optional params
      }

      // Type validation
      if (rule.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${rule.param} must be a number`);
          continue;
        }
        if (rule.min !== undefined && num < rule.min) {
          errors.push(`${rule.param} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && num > rule.max) {
          errors.push(`${rule.param} must be at most ${rule.max}`);
        }
      }

      if (rule.type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`${rule.param} must be a string`);
          continue;
        }
        if (rule.min !== undefined && value.length < rule.min) {
          errors.push(`${rule.param} must be at least ${rule.min} characters`);
        }
        if (rule.max !== undefined && value.length > rule.max) {
          errors.push(`${rule.param} must be at most ${rule.max} characters`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${rule.param} has invalid format`);
        }
      }

      if (rule.type === 'boolean') {
        if (value !== 'true' && value !== 'false' && value !== '1' && value !== '0') {
          errors.push(`${rule.param} must be a boolean (true/false)`);
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
      return;
    }

    next();
  };
}

export function validatePathParams(rules: ValidationRule[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.params[rule.param];

      if (rule.required && !value) {
        errors.push(`${rule.param} is required`);
        continue;
      }

      if (!value) {
        continue;
      }

      // Type validation
      if (rule.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${rule.param} must be a number`);
        }
      }

      if (rule.type === 'string' && rule.pattern) {
        if (!rule.pattern.test(value)) {
          errors.push(`${rule.param} has invalid format`);
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
      return;
    }

    next();
  };
}

export function validateEnvVariables() {
  const required = [
    'OLLAMA_BASE_URL'
  ];

  const optional = [
    'PORT',
    'MAX_MESSAGE_LENGTH',
    'INBOX_DB_PATH',
    'NODE_ENV',
    'OPENROUTER_API_KEY'
  ];

  const missing: string[] = [];
  const warnings: string[] = [];

  for (const varName of required) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check for common misconfigurations
  if (process.env.OLLAMA_BASE_URL && !process.env.OLLAMA_BASE_URL.startsWith('http')) {
    warnings.push('OLLAMA_BASE_URL should start with http:// or https://');
  }

  if (process.env.PORT) {
    const port = parseInt(process.env.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      warnings.push('PORT must be a valid port number (1-65535)');
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease set these variables in your .env file or environment.');
    console.error('\nExample .env file:');
    console.error('OLLAMA_BASE_URL=http://localhost:11434');
    console.error('PORT=6740');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Environment variable warnings:');
    warnings.forEach(w => console.warn(`   - ${w}`));
  }

  console.log('✅ Environment variables validated');
  console.log(`   OLLAMA_BASE_URL: ${process.env.OLLAMA_BASE_URL}`);
  console.log(`   PORT: ${process.env.PORT || '6740 (default)'}`);
  if (process.env.OPENROUTER_API_KEY) {
    console.log('   OPENROUTER_API_KEY: ***configured***');
  } else {
    console.log('   OPENROUTER_API_KEY: not set (using Ollama only)');
  }
}
