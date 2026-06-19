import { Inject, Injectable } from '@nestjs/common';
import { Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { PosUser, PosUserRole } from '../entities/pos-user.entity';

const BCRYPT_ROUNDS = 10;
const TOKEN_TTL = '24h';
const LOG_CTX = 'PosAuthPlugin';

export type LoginRole = PosUserRole | undefined;

export interface LoginResult {
    token: string;
    userId: string;
    username: string;
    role: PosUserRole;
    displayName: string;
}

export interface ValidateTokenResult {
    userId: string;
    username: string;
    role: PosUserRole;
    displayName: string;
}

export interface CreatePosUserInput {
    username: string;
    password: string;
    role?: PosUserRole;
    displayName?: string;
}

export interface UpdatePosUserInput {
    displayName?: string;
    password?: string;
    active?: boolean;
}

interface JwtPayload {
    sub: number;
    role: PosUserRole;
    username: string;
}

function legacySha256(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function isBcryptHash(h: unknown): boolean {
    return typeof h === 'string' && /^\$2[aby]\$/.test(h);
}

function getJwtSecret(): string {
    const s = process.env.JWT_SECRET;
    if (!s) {
        throw new Error('JWT_SECRET is not set. Generate one with: openssl rand -hex 32');
    }
    return s;
}

@Injectable()
export class PosAuthService {
    constructor(@Inject(TransactionalConnection) private connection: TransactionalConnection) {}

    async ensureAdminExists(ctx: RequestContext): Promise<void> {
        const repo = this.connection.getRepository(ctx, PosUser);
        const admin = await repo.findOne({ where: { username: 'admin' } });
        if (admin) return;

        const initialPassword = process.env.POS_ADMIN_INITIAL_PASSWORD;
        if (!initialPassword) {
            Logger.warn(
                'POS admin user not found and POS_ADMIN_INITIAL_PASSWORD is not set; skipping bootstrap. ' +
                    'Set POS_ADMIN_INITIAL_PASSWORD in .env to auto-create the first admin.',
                LOG_CTX,
            );
            return;
        }
        const user = new PosUser({
            username: 'admin',
            passwordHash: await bcrypt.hash(initialPassword, BCRYPT_ROUNDS),
            role: 'admin',
            displayName: 'Administrator',
            active: true,
        });
        await repo.save(user);
        Logger.info('POS admin user bootstrapped from POS_ADMIN_INITIAL_PASSWORD.', LOG_CTX);
    }

    async login(
        ctx: RequestContext,
        username: string,
        password: string,
        loginRole: LoginRole,
    ): Promise<LoginResult> {
        const repo = this.connection.getRepository(ctx, PosUser);
        await this.ensureAdminExists(ctx);

        const user = await repo.findOne({ where: { username } });
        if (!user || !user.active) {
            throw new Error('Invalid username or password.');
        }

        let ok = false;
        if (isBcryptHash(user.passwordHash)) {
            ok = await bcrypt.compare(password, user.passwordHash);
        } else {
            const legacy = legacySha256(password);
            const a = Buffer.from(user.passwordHash || '', 'utf8');
            const b = Buffer.from(legacy, 'utf8');
            ok = a.length === b.length && crypto.timingSafeEqual(a, b);
            if (ok) {
                user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
                await repo.save(user);
                Logger.info(`Upgraded legacy password hash for user "${user.username}".`, LOG_CTX);
            }
        }
        if (!ok) {
            throw new Error('Invalid username or password.');
        }

        if (loginRole === 'admin' && user.role !== 'admin') {
            throw new Error('This account does not have admin access.');
        }
        if (loginRole === 'user' && user.role !== 'user') {
            throw new Error('Please use Admin Login for admin accounts.');
        }

        const token = jwt.sign(
            { sub: user.id, role: user.role, username: user.username },
            getJwtSecret(),
            { expiresIn: TOKEN_TTL, algorithm: 'HS256' },
        );
        return {
            token,
            userId: String(user.id),
            username: user.username,
            role: user.role,
            displayName: user.displayName,
        };
    }

    async validateToken(ctx: RequestContext, token: string): Promise<ValidateTokenResult | null> {
        let payload: JwtPayload;
        try {
            payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as JwtPayload;
        } catch {
            return null;
        }
        const repo = this.connection.getRepository(ctx, PosUser);
        const user = await repo.findOne({ where: { id: payload.sub } as any });
        if (!user || !user.active) return null;
        return {
            userId: String(user.id),
            username: user.username,
            role: user.role,
            displayName: user.displayName,
        };
    }

    async createUser(ctx: RequestContext, input: CreatePosUserInput): Promise<PosUser> {
        const repo = this.connection.getRepository(ctx, PosUser);
        const existing = await repo.findOne({ where: { username: input.username } });
        if (existing) {
            throw new Error(`Username "${input.username}" already exists.`);
        }
        const user = new PosUser({
            username: input.username,
            passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
            role: input.role || 'user',
            displayName: input.displayName || input.username,
            active: true,
        });
        return repo.save(user);
    }

    async listUsers(ctx: RequestContext): Promise<PosUser[]> {
        const repo = this.connection.getRepository(ctx, PosUser);
        await this.ensureAdminExists(ctx);
        return repo.find({ order: { createdAt: 'DESC' } });
    }

    async updateUser(
        ctx: RequestContext,
        id: number | string,
        input: UpdatePosUserInput,
    ): Promise<PosUser> {
        const repo = this.connection.getRepository(ctx, PosUser);
        const user = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!user) throw new Error('User not found.');
        if (input.displayName !== undefined) user.displayName = input.displayName;
        if (input.active !== undefined) user.active = input.active;
        if (input.password) user.passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
        return repo.save(user);
    }

    async deleteUser(ctx: RequestContext, id: number | string): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, PosUser);
        const user = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!user) throw new Error('User not found.');
        if (user.role === 'admin') throw new Error('Cannot delete admin account.');
        await repo.remove(user);
        return true;
    }
}
