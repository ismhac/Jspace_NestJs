import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './auth/guard/jwt-auth.guard';
import { TransformInterceptor } from './core/transform.interceptor';
import { PermissionsService } from './permissions/permissions.service';
import { DatabasesService } from './databases/databases.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);                   // using .env
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));               // use guard - jwt-auth.guard.ts
  app.useGlobalInterceptors(new TransformInterceptor(reflector)); // custom response - transform.interceptor.ts

  app.useStaticAssets(join(__dirname, '..', 'public'));           // js, css, images
  app.setBaseViewsDir(join(__dirname, '..', 'views'));            // views
  app.setViewEngine('ejs');                                       // view engine

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
  }));

  // config cookies
  // app.use(cookieParser());

  // config CORS
  app.enableCors({
    origin: [
      /^(.*)/,
    ],
    "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
    "preflightContinue": false,
    "optionsSuccessStatus": 204,
    credentials: true,
  });

  // config versioning
  app.setGlobalPrefix('api')
  app.enableVersioning({
    type: VersioningType.URI, // default: /v 
    defaultVersion: ['1'] // => /api/v1 or /api/v2
  });

  // config helmet
  app.use(helmet());

  // config swagger
  const config = new DocumentBuilder()
    .setTitle('RM APIs Document')
    .setDescription('The API description')
    .setVersion('1.0')
    // .addTag('')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'Bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'token',
    )
    // .addSecurityRequirements('token')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('swagger', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      // defaultModelsExpandDepth: -1, // disable show dto
    },
  });


  await app.listen(configService.get<string>('PORT') || 8000, async () => {
    const permissionService = app.get(PermissionsService);

    // get info from existingRoutes
    const server: any = app.getHttpServer();
    const existingRoutes = server._events.request._router;
    const routesWithRoute = existingRoutes.stack.filter(layer => layer.route);

    // create array permissions from routes info
    const initialPermissions = routesWithRoute.map(route => ({
      apiPath: route.route.path,
      method: Object.keys(route.route.methods)[0].toUpperCase(),
      module: route.route.path.split("/")[3]?.toUpperCase(),
    }));

    // init permissions data
    // console.table(initialPermissions);
    await permissionService.initializePermissions(initialPermissions);

    let databaseService = await app.get(DatabasesService);
    await databaseService.initData();
  });
}
bootstrap();
