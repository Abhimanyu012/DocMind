import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../db/pool';
import { env } from '../../config/env';
import { HttpError } from '../../lib/httpError';
import { RegisterInput, LoginInput } from './auth.schemas';
import { AuthUser } from '../../middleware/auth';

export interface UserResponse {
  id: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
}

export class AuthService {
  // WHY: Pure business logic for registering a new user. Handles hashing and uniqueness checks.
  async register(input: RegisterInput): Promise<UserResponse> {
    const { email, password, role } = input;

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      throw new HttpError(409, 'User with this email already exists', 'EMAIL_EXISTS');
    }

    // Hash password with salt rounds = 10
    // WHY: Never store plain-text passwords. Bcrypt provides strong one-way cryptographic hashing.
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user into PostgreSQL using parameterized query to prevent SQL Injection
    const result = await query<UserResponse>(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, role, created_at`,
      [email.toLowerCase(), passwordHash, role]
    );

    return result.rows[0];
  }

  // WHY: Validates credentials and signs a JWT for stateless session authorization.
  async login(input: LoginInput): Promise<{ token: string; user: UserResponse }> {
    const { email, password } = input;

    // Retrieve user by email
    const result = await query<{
      id: string;
      email: string;
      password_hash: string;
      role: 'user' | 'admin';
      created_at: string;
    }>('SELECT id, email, password_hash, role, created_at FROM users WHERE email = $1', [
      email.toLowerCase(),
    ]);

    const user = result.rows[0];
    if (!user) {
      throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Compare provided password with stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Sign JWT payload
    const tokenPayload: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    };
  }

  // WHY: Retrieves the authenticated user's current profile from the database.
  async getMe(userId: string): Promise<UserResponse> {
    const result = await query<UserResponse>(
      'SELECT id, email, role, created_at FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];
    if (!user) {
      throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
    }

    return user;
  }
}

export const authService = new AuthService();
