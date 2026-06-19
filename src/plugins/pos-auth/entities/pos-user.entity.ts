import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

export type PosUserRole = 'admin' | 'user';

@Entity()
export class PosUser extends VendureEntity {
    constructor(input?: DeepPartial<PosUser>) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true })
    username!: string;

    @Column({ type: 'varchar' })
    passwordHash!: string;

    @Column({ type: 'varchar', default: 'user' })
    role!: PosUserRole;

    @Column({ type: 'varchar', default: '' })
    displayName!: string;

    @Column({ type: 'boolean', default: true })
    active!: boolean;
}
