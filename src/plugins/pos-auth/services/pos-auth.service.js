import { Inject, Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { PosUser } from '../entities/pos-user.entity';
import crypto from 'crypto';

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

@Injectable()
export class PosAuthService {
    constructor(@Inject(TransactionalConnection) connection) {
        this.connection = connection;
    }

    async ensureAdminExists(ctx) {
        const repo = this.connection.getRepository(ctx, PosUser);
        const admin = await repo.findOne({ where: { username: 'admin' } });
        if (!admin) {
            const user = new PosUser({
                username: 'admin',
                passwordHash: hashPassword('admin'),
                role: 'admin',
                displayName: 'Administrator',
                active: true,
            });
            await repo.save(user);
        }
    }

    async login(ctx, username, password, loginRole) {
        const repo = this.connection.getRepository(ctx, PosUser);
        await this.ensureAdminExists(ctx);

        const user = await repo.findOne({ where: { username } });
        if (!user) {
            throw new Error('Invalid username or password.');
        }
        if (!user.active) {
            throw new Error('Account is disabled. Contact admin.');
        }
        if (user.passwordHash !== hashPassword(password)) {
            throw new Error('Invalid username or password.');
        }
        // Role check: admin login only for admin, user login only for user
        if (loginRole === 'admin' && user.role !== 'admin') {
            throw new Error('This account does not have admin access.');
        }
        if (loginRole === 'user' && user.role !== 'user') {
            throw new Error('Please use Admin Login for admin accounts.');
        }

        // Return session token (simple: base64 of id:role:timestamp)
        const token = Buffer.from(`${user.id}:${user.role}:${Date.now()}`).toString('base64');
        return {
            token,
            userId: user.id.toString(),
            username: user.username,
            role: user.role,
            displayName: user.displayName,
        };
    }

    async validateToken(ctx, token) {
        try {
            const decoded = Buffer.from(token, 'base64').toString('utf8');
            const [idStr, role] = decoded.split(':');
            const id = parseInt(idStr);
            const repo = this.connection.getRepository(ctx, PosUser);
            const user = await repo.findOne({ where: { id } });
            if (!user || !user.active) return null;
            return {
                userId: user.id.toString(),
                username: user.username,
                role: user.role,
                displayName: user.displayName,
            };
        } catch {
            return null;
        }
    }

    async createUser(ctx, input) {
        const repo = this.connection.getRepository(ctx, PosUser);
        // Check duplicate
        const existing = await repo.findOne({ where: { username: input.username } });
        if (existing) {
            throw new Error(`Username "${input.username}" already exists.`);
        }
        const user = new PosUser({
            username: input.username,
            passwordHash: hashPassword(input.password),
            role: input.role || 'user',
            displayName: input.displayName || input.username,
            active: true,
        });
        return repo.save(user);
    }

    async listUsers(ctx) {
        const repo = this.connection.getRepository(ctx, PosUser);
        await this.ensureAdminExists(ctx);
        return repo.find({ order: { createdAt: 'DESC' } });
    }

    async updateUser(ctx, id, input) {
        const repo = this.connection.getRepository(ctx, PosUser);
        const user = await repo.findOne({ where: { id: parseInt(id) } });
        if (!user) throw new Error('User not found.');
        if (input.displayName !== undefined) user.displayName = input.displayName;
        if (input.active !== undefined) user.active = input.active;
        if (input.password) user.passwordHash = hashPassword(input.password);
        return repo.save(user);
    }

    async deleteUser(ctx, id) {
        const repo = this.connection.getRepository(ctx, PosUser);
        const user = await repo.findOne({ where: { id: parseInt(id) } });
        if (!user) throw new Error('User not found.');
        if (user.role === 'admin') throw new Error('Cannot delete admin account.');
        await repo.remove(user);
        return true;
    }
}
