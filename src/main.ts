import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const appService = appContext.get(AppService);

  await appService.run(1738627200);
  await appContext.close();
}
bootstrap();
