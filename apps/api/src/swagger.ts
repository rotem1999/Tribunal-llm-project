import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Mounts Swagger UI at /api/docs and emits openapi.json (SPEC §15.1). The
 * per-endpoint @Api* decorators live with their controllers; this wires the
 * document together. In production the UI is gated behind SWAGGER_ENABLED.
 */
export function setupSwagger(app: INestApplication): void {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && process.env.SWAGGER_ENABLED !== 'true') return;

  const config = new DocumentBuilder()
    .setTitle('Tribunal API')
    .setDescription(
      'A courtroom over a charge sheet: 4 advocates speak, 3 judges each return a verdict + the token economy.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  try {
    writeFileSync(
      resolve(process.cwd(), 'apps/api/openapi.json'),
      JSON.stringify(document, null, 2),
      'utf8',
    );
  } catch {
    // Emitting the artifact is best-effort; never block boot on it.
  }
}
