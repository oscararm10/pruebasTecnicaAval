import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { parse as parseYaml } from 'yaml';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './handlers/router';
import { getLocalDbPath } from './shared/container';

process.env.LOCAL_MODE = process.env.LOCAL_MODE || 'true';
process.env.APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const dbPath = getLocalDbPath();
const openApiPath = path.join(__dirname, '..', 'openapi.yaml');

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/openapi.yaml', (_req, res) => {
  res.type('application/yaml').send(fs.readFileSync(openApiPath, 'utf8'));
});

const openApiDocument = parseYaml(fs.readFileSync(openApiPath, 'utf8')) as Record<
  string,
  unknown
>;
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: 'Aval API — Swagger',
    swaggerOptions: {
      url: '/api/openapi.yaml',
      persistAuthorization: false,
    },
  })
);

app.all('*', async (req, res) => {
  const event = toApiGatewayEvent(req);
  const result = await handler(event, {} as never, () => undefined);

  if (!result) {
    res.status(500).json({ error: 'Sin respuesta del handler' });
    return;
  }

  res.status(result.statusCode);
  for (const [key, value] of Object.entries(result.headers || {})) {
    if (value !== undefined) res.setHeader(key, String(value));
  }

  if (result.isBase64Encoded) {
    res.send(Buffer.from(result.body, 'base64'));
    return;
  }

  try {
    res.send(JSON.parse(result.body));
  } catch {
    res.send(result.body);
  }
});

app.listen(PORT, () => {
  console.log(`Aval backend local en http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/api/docs`);
  console.log(`OpenAPI: http://localhost:${PORT}/api/openapi.yaml`);
  console.log(`LOCAL_MODE=${process.env.LOCAL_MODE}`);
  console.log(`SQLite: ${dbPath}`);
});

function toApiGatewayEvent(req: express.Request): APIGatewayProxyEvent {
  return {
    body: req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : null,
    headers: req.headers as Record<string, string>,
    multiValueHeaders: {},
    httpMethod: req.method,
    isBase64Encoded: false,
    path: req.path,
    pathParameters: null,
    queryStringParameters: Object.keys(req.query).length
      ? (req.query as Record<string, string>)
      : null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as never,
    resource: req.path,
  };
}
