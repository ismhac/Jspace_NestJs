import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { IUser } from 'src/users/users.interface';
import { RegisterUserDto } from 'src/users/dto/create-user.dto';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';
import { Response } from "express";
import { RolesService } from 'src/roles/roles.service';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private roleService: RolesService
    ) { }

    logout = async (response: Response, user: IUser) => {
        await this.usersService.updateUserToken("", user._id);
        response.clearCookie("refresh_token");
        return "OK"
    }

    processNewToken = async (refreshToken: string, response: Response) => {
        try {
            this.jwtService.verify(refreshToken, {
                secret: this.configService.get<string>("JWT_REFRESH_TOKEN_SECRET")
            })

            let user = await this.usersService.findUserByToken(refreshToken);
            if (user) {
                // update refresh token
                const { _id, name, email, role } = user;
                const payload = {
                    sub: "token refresh",
                    iss: "from server",
                    _id,
                    name,
                    email,
                    role
                }

                const refresh_token = this.createRefreshToken(payload);

                // update user with refresh token
                response.clearCookie("refresh_token");
                await this.usersService.updateUserToken(refresh_token, _id.toString())

                // fetch user's role
                const userRole = user.role as unknown as { _id: string, name: string };
                const temp = await this.roleService.findOne(userRole._id);

                // set refresh_token as cookies
                response.cookie('refresh_token', refresh_token, {
                    httpOnly: true,
                    maxAge: ms(this.configService.get<string>('JWT_REFRESH_EXPIRE'))
                })

                return {
                    access_token: this.jwtService.sign(payload),
                    user: {
                        _id,
                        name,
                        email,
                        role,
                        permission: temp?.permissions ?? []
                    }
                };

            } else {
                throw new BadRequestException(`Invalid refresh token. Please login!`)
            }
        } catch (error) {
            throw new BadRequestException(`Invalid refresh token. Please login!`)
        }
    }

    createRefreshToken = (payload: any) => {
        const refreshToken = this.jwtService.sign(payload, {
            secret: this.configService.get<string>("JWT_REFRESH_TOKEN_SECRET"),
            expiresIn: ms(this.configService.get<string>('JWT_REFRESH_EXPIRE')) / 1000,
        })
        return refreshToken;
    }

    async register(user: RegisterUserDto) {
        let newUser = await this.usersService.register(user)
        return {
            _id: newUser?._id,
            createdAt: newUser?.createdAt
        }
    }

    // username/pass là 2 tham số thư viện passport ném về
    async validateUser(username: string, pass: string): Promise<any> {
        const user = await this.usersService.findOneByUsername(username);
        if (user) {
            const isValid = this.usersService.isValidPassword(pass, user.password);
            if (isValid === true) {
                const userRole = user.role as unknown as { _id: string, name: string };
                const temp = await this.roleService.findOne(userRole._id);

                const objUser = {
                    ...user.toObject(),
                    permissions: temp?.permissions ?? [],
                }
                return objUser;
            }
        }
        return null;
    }

    async login(user: IUser, response: Response) {
        const { _id, name, email, role, permissions } = user;
        const payload = {
            sub: "token login",
            iss: "from server",
            _id,
            name,
            email,
            role
        }

        const refresh_token = this.createRefreshToken(payload);

        // update user with refresh token --> update in usersService
        await this.usersService.updateUserToken(refresh_token, _id)

        // set refresh_token as cookies
        response.cookie('refresh_token', refresh_token, {
            httpOnly: true,
            maxAge: ms(this.configService.get<string>('JWT_REFRESH_EXPIRE'))
        })

        return {
            access_token: this.jwtService.sign(payload),
            refresh_token: refresh_token,
            user: {
                _id,
                name,
                email,
                role,
                permissions
            }
        };
    }
}
