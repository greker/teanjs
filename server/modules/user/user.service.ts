import * as crypto from 'crypto';
import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateUserDto } from './dtos/createUser.dto';
import { UserEntity } from './user.entity';
import { EntityManager } from 'typeorm';
import { UserRepository } from './user.repository';
import { CustomFindManyOptions, CustomFindOneOptions } from '../../common/typeorm/customTypes';
import { EntityNotFoundExceptionHandler } from '../../common/decorators/entityNotFoundExceptionHandler.decorator';

@Injectable()
export class UserService {
    constructor(private readonly userRepository: UserRepository) {}

    public async hashPassword(originalPassword: string, defaultSalt?: string): Promise<{ hash: string; salt: string }> {
        const len = 128;
        const iterations = 30547;

        const generateSalt = (): Promise<string> => {
            return new Promise((resolve, reject) => {
                crypto.randomBytes(len, (saltError, saltValue) => {
                    if (saltError) {
                        return reject(saltError);
                    }

                    return resolve(saltValue.toString('base64'));
                });
            });
        };

        return await new Promise(async (resolve, reject) => {
            const saltStr = defaultSalt || (await generateSalt());
            crypto.pbkdf2(originalPassword, saltStr, iterations, len, 'sha1', (hashError, hashPassword) => {
                if (hashError) {
                    return reject(hashError);
                }

                return resolve({
                    salt: saltStr,
                    hash: hashPassword.toString('base64')
                });
            });
        });
    }

    public async createUser(
        createUserDto: CreateUserDto,
        options: { transactionalEntityManager?: EntityManager } = {}
    ): Promise<UserEntity> {
        const userCount = await this.userRepository.count({
            where: { email: createUserDto.email },
            ...options,
            force: true
        });

        if (userCount) {
            throw new BadRequestException('This email is already use.');
        }

        const user = this.userRepository.create(createUserDto);
        const { id } = await this.userRepository.save(user, options);
        return await this.userRepository.findOneOrFail(id, options);
    }

    @EntityNotFoundExceptionHandler()
    public async findOneUserOrFail(options: CustomFindOneOptions<UserEntity> = {}): Promise<UserEntity> {
        return await this.userRepository.findOneOrFail(options);
    }

    @EntityNotFoundExceptionHandler()
    public async findUserById(id: number, options: CustomFindOneOptions<UserEntity> = {}): Promise<UserEntity> {
        return await this.userRepository.findOneOrFail(id, options);
    }

    public async findUserByIds(ids: number[], options: CustomFindManyOptions<UserEntity> = {}): Promise<UserEntity[]> {
        return await this.userRepository.findByIds(ids, options);
    }
}