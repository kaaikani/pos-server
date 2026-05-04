import { VendureEntity } from '@vendure/core';
import { Entity, Column } from 'typeorm';

@Entity()
export class PosUser extends VendureEntity {
    constructor(input) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true })
    username;

    @Column({ type: 'varchar' })
    passwordHash;

    @Column({ type: 'varchar', default: 'user' })
    role; // 'admin' | 'user'

    @Column({ type: 'varchar', default: '' })
    displayName;

    @Column({ type: 'boolean', default: true })
    active;
}
