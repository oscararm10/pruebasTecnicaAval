# Aval — Flujo de aprobaciones con firma digital concatenada

Aplicación web **cliente-servidor** para el ciclo completo de una **solicitud de compra** con tres aprobadores, validación por **OTP**, firmas digitales concatenadas, simulación de correo y generación de **PDF de evidencia**.

Cumple el escenario de la prueba técnica: Frontend (React + Webpack Module Federation) + Backend REST serverless (AWS Lambda, API Gateway, DynamoDB, S3), con modo local para desarrollo sin cuenta AWS.

---

## Tabla de contenidos

1. [Objetivo](#1-objetivo)
2. [Funcionalidades](#2-funcionalidades)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Arquitectura](#4-arquitectura)
5. [Supuestos](#5-supuestos)
6. [Estructura del repositorio](#6-estructura-del-repositorio)
7. [Requisitos previos](#7-requisitos-previos)
8. [Arranque local](#8-arranque-local)
9. [Guía de demo (paso a paso)](#9-guía-de-demo-paso-a-paso)
10. [Modelo de dominio y estados](#10-modelo-de-dominio-y-estados)
11. [API REST](#11-api-rest)
12. [Frontend (vistas y MFEs)](#12-frontend-vistas-y-mfes)
13. [Backend (capas y persistencia)](#13-backend-capas-y-persistencia)
14. [OTP, tokens y seguridad](#14-otp-tokens-y-seguridad)
15. [PDF de evidencia](#15-pdf-de-evidencia)
16. [Pruebas y cobertura](#16-pruebas-y-cobertura)
17. [Despliegue en AWS (SAM)](#17-despliegue-en-aws-sam)
18. [Scripts disponibles](#18-scripts-disponibles)
19. [Variables de entorno](#19-variables-de-entorno)
20. [Troubleshooting](#20-troubleshooting)

---

## 1. Objetivo

Diseñar e implementar un flujo de aprobaciones con firmas digitales concatenadas:

1. Un **solicitante** crea una solicitud de compra (título, descripción, monto, 3 aprobadores con roles distintos).
2. El sistema guarda la solicitud en estado **Pendiente**, genera un **token UUID** por aprobador y simula el envío de correo con link de aprobación.
3. Cada aprobador abre el link, valida un **OTP** (válido 3 minutos), ve el detalle y **aprueba** (firma) o **rechaza**.
4. Al completar las 3 firmas se genera un **PDF** con datos y firmas; el estado pasa a **Completada** y el frontend permite descargarlo.

---

## 2. Funcionalidades

| # | Requisito | Implementación |
|---|-----------|----------------|
| 1 | Crear solicitud de compra | Formulario en `/nueva` → `POST /api/solicitudes` |
| 2 | 3 aprobadores con roles distintos | Validación de negocio en backend |
| 3 | Token único por aprobador + link | UUID en query `approver_token` |
| 4 | Notificaciones simuladas | Persistidas y expuestas en `/api/mock-mail` |
| 5 | OTP único, TTL 3 minutos | Hash SHA-256 + `otpExpiresAt` |
| 6 | Aprobar / rechazar con firma | Nombre + timestamp (+ firma simulada en PDF) |
| 7 | Panel de estados del solicitante | Lista + detalle con badges |
| 8 | PDF al completar 3 firmas | `pdfkit` → S3 (AWS) o SQLite (local) |
| 9 | Descarga de evidencia | `GET /api/solicitudes/{id}/evidencia.pdf` |
| 10 | Arquitectura serverless | SAM: Lambda + API GW + DynamoDB + S3 |
| 11 | Micro-frontends | Webpack Module Federation |
| 12 | Cobertura ≥ 60% | Jest en backend y frontend |

---

## 3. Stack tecnológico

### Backend

| Tecnología | Uso |
|------------|-----|
| Node.js 18+ / TypeScript | Runtime y tipado |
| Express | Servidor local de desarrollo |
| AWS Lambda + API Gateway | Exposición REST en AWS |
| DynamoDB | Persistencia NoSQL (producción) |
| SQLite (`better-sqlite3`) | Persistencia local (solo desarrollo) |
| S3 | Almacenamiento de PDFs |
| pdfkit | Generación de evidencia PDF |
| AWS SAM | Infraestructura como código |
| Jest + ts-jest | Pruebas unitarias |

### Frontend

| Tecnología | Uso |
|------------|-----|
| React 18 | UI |
| React Router 6 | Navegación |
| Axios | Cliente HTTP |
| Webpack 5 | Bundler + **Module Federation** |
| Jest + Testing Library | Pruebas |

---

## 4. Arquitectura

```
                    ┌─────────────────────────────────────┐
                    │           Frontend (React)          │
                    │  Shell (host) + Module Federation   │
                    │  :3000  — proxy /api → :4000        │
                    └──────────────────┬──────────────────┘
                                       │ REST JSON
                    ┌──────────────────▼──────────────────┐
                    │     API (local Express / API GW)    │
                    │     handlers/router.ts (Lambda)     │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │         SolicitudService            │
                    │  create · OTP · decide · PDF · mail │
                    └──────────────────┬──────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
     SolicitudStore              MailStore                 PdfStore
   (SQLite / DynamoDB)      (SQLite / DynamoDB)      (SQLite / S3)
```

**Modo local:** `LOCAL_MODE=true` (por defecto si no hay `TABLE_NAME`) usa SQLite en `backend/.data/aval.db`.

**Modo AWS:** DynamoDB + S3 configurados por variables de entorno de la Lambda.

---

## 5. Supuestos

Decisiones y simplificaciones adoptadas para la prueba técnica (no es un producto de producción listo):

| Tema | Supuesto |
|------|----------|
| Correo | No hay SMTP/SES real. Los “correos” se simulan, se persisten y se consultan en `GET /api/mock-mail` y en la vista **Mock mail**. |
| Firma digital | Es una firma **simulada**: nombre del aprobador + timestamp (y representación tipográfica en el PDF). No hay PKI, certificados ni firma criptográfica del documento. |
| Aprobadores | Cada solicitud exige **exactamente 3** aprobadores con **roles distintos**. |
| OTP | 6 dígitos, hash SHA-256 al persistir, TTL de **3 minutos**. Si el OTP sigue vigente al reabrir el link, se **reutiliza**; si expiró, se genera uno nuevo. |
| Sesión post-OTP | Tras validar el OTP, la ventana para aprobar/rechazar es de ~**15 minutos**. |
| Rechazo | Si un aprobador rechaza, la solicitud pasa a **Rechazada** y **no** se genera PDF. |
| PDF de evidencia | Solo se genera cuando los **3** aprobadores firman (estado **Completada**). |
| Persistencia local | Con `LOCAL_MODE=true` se usa **SQLite** (`backend/.data/aval.db`), no AWS. En AWS: DynamoDB + S3. |
| Links de aprobación | Se construyen con `APP_BASE_URL` (por defecto `http://localhost:3000` en local). |
| Frontend / API en local | El webpack-dev-server hace proxy de `/api` → `http://localhost:4000`. Hace falta tener **backend y frontend** corriendo a la vez. |
| Micro-frontends | Solicitante y Aprobador se exponen con Module Federation en el **mismo** build/host (shell), no como despliegues remotos independientes. |
| CORS | En demo está abierto (`*`). En un entorno real debería restringirse al origen del frontend. |
| Autenticación del solicitante | No hay login de solicitante; cualquiera puede crear y listar solicitudes en esta demo. |

> En producción se esperarían correo real (SES/SMTP), rate-limit de OTP, HTTPS, CORS restringido y un modelo de firma alineado a requisitos legales/PKI si aplica.

---

## 6. Estructura del repositorio

```
Aval/
├── README.md                 ← Este documento
├── package.json              ← Scripts raíz (install / dev / test)
├── .gitignore
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js
│   ├── openapi.yaml          ← OpenAPI 3 / Swagger (spec + guía de pruebas)
│   ├── template.yaml         ← SAM (API GW, Lambda, DynamoDB, S3)
│   ├── samconfig.toml
│   ├── Makefile              ← Build SAM
│   ├── src/
│   │   ├── domain/types.ts
│   │   ├── handlers/         ← API Gateway / Express adapters
│   │   ├── services/         ← Lógica de negocio + PDF
│   │   ├── repositories/     ← SQLite / DynamoDB / S3
│   │   ├── shared/           ← OTP, response, DI container
│   │   └── local-server.ts   ← Express local :4000 (+ Swagger UI)
│   └── tests/
│
└── frontend/
    ├── package.json
    ├── webpack.config.js     ← Module Federation
    ├── jest.config.js
    ├── public/index.html
    └── src/
        ├── shell/            ← Host MFE (layout + rutas)
        ├── solicitante/      ← MFE: crear / listar / detalle
        ├── aprobador/        ← MFE: OTP + decisión
        └── shared/           ← API client, tipos, estilos
```

---

## 7. Requisitos previos

- **Node.js** 18 o superior (probado con Node 24)
- **npm** 9+
- Navegador moderno
- *(Opcional para AWS)* [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html), credenciales AWS y Docker (para `sam build` con Makefile en algunos entornos)

---

## 8. Arranque local

Abra **dos terminales** en la raíz del proyecto.

### Terminal 1 — Dependencias (una sola vez)

```bash
npm run install:all
```

Equivalente a:

```bash
npm install --prefix backend
npm install --prefix frontend
```

### Terminal 2 — Backend

```bash
npm run dev:backend
```

- URL: `http://localhost:4000`
- Swagger UI: `http://localhost:4000/api/docs`
- Spec OpenAPI: [`backend/openapi.yaml`](backend/openapi.yaml) (`/api/openapi.yaml`)
- Modo: SQLite local (`LOCAL_MODE=true`)
- Persistencia: `backend/.data/aval.db` (sobrevive reinicios; borrar el archivo resetea los datos)

### Terminal 3 — Frontend

```bash
npm run dev:frontend
```

- URL: `http://localhost:3000`
- Proxy Webpack: `/api` → `http://localhost:4000`

Abra el navegador en: **http://localhost:3000**

---

## 9. Guía de demo (paso a paso)

1. Ir a **Nueva solicitud**.
2. Completar:
   - Título, descripción, monto, nombre del solicitante
   - 3 aprobadores (nombre, email, **roles distintos**, p. ej. Gerente / Finanzas / Compras)
3. Enviar. Queda en estado **Pendiente**.
4. En el detalle verá los **links de aprobación** (simulación de email).
5. Abrir un link (o ir a **Mock mail** y usar el link).
6. Al abrir el link, si el OTP sigue vigente se **reutiliza**; si expiró se genera uno nuevo. Consúltelo en **Mock mail** (el del link del aprobador o el asunto “OTP para aprobar”).
7. Ingresar el OTP → se muestra el detalle de la compra.
8. **Aprobar y firmar** o **Rechazar**.
9. Repetir con los otros 2 aprobadores (si todos aprueban).
10. Estado **Completada** → botón **Descargar PDF**.

> Si un aprobador **rechaza**, la solicitud pasa a **Rechazada** y no se genera PDF.

---

## 10. Modelo de dominio y estados

### Solicitud

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador |
| `titulo` | string | Título |
| `descripcion` | string | Descripción |
| `monto` | number | Monto (> 0) |
| `solicitante` | string | Nombre del solicitante |
| `estado` | enum | Ver tabla de estados |
| `aprobadores` | array[3] | Aprobadores asociados |
| `evidenciaKey` | string? | Clave del PDF cuando existe |
| `createdAt` / `updatedAt` | ISO date | Auditoría |

**Estados de solicitud**

```
Pendiente ──(3 firmas)──► Completada  (+ PDF)
    │
    └──(1 rechazo)──► Rechazada
```

### Aprobador

| Campo | Descripción |
|-------|-------------|
| `token` | UUID único para el link de aprobación |
| `rol` | Debe ser distinto entre los 3 |
| `estado` | `Pendiente` \| `Firmado` \| `Rechazado` |
| `firma` | `{ nombre, fecha, imagenSimulada? }` al decidir |

**Estados de aprobador**

```
Pendiente ──(aprobar)──► Firmado
    │
    └──(rechazar)──► Rechazado
```

---

## 11. API REST

Base local: `http://localhost:4000`  
Base AWS: `https://{api-id}.execute-api.{region}.amazonaws.com/Prod`

**Documentación OpenAPI / Swagger**

| Recurso | URL / ruta |
|---------|------------|
| Swagger UI (Try it out) | [http://localhost:4000/api/docs](http://localhost:4000/api/docs) |
| Spec YAML | [`backend/openapi.yaml`](backend/openapi.yaml) o `GET /api/openapi.yaml` |

La guía de pruebas paso a paso está en la descripción del spec (visible en Swagger UI).

Todas las respuestas de error siguen el formato:

```json
{ "error": "mensaje descriptivo" }
```

### `POST /api/solicitudes`

Crea la solicitud, asocia 3 aprobadores, genera tokens y simula 3 correos.

**Body**

```json
{
  "titulo": "Laptops desarrollo",
  "descripcion": "Compra de 10 laptops para el equipo",
  "monto": 25000000,
  "solicitante": "Ana Pérez",
  "aprobadores": [
    { "nombre": "Carlos Ruiz", "email": "carlos@empresa.com", "rol": "Gerente" },
    { "nombre": "Laura Gómez", "email": "laura@empresa.com", "rol": "Finanzas" },
    { "nombre": "Pedro Díaz", "email": "pedro@empresa.com", "rol": "Compras" }
  ]
}
```

**Respuesta `201`**

```json
{
  "solicitud": { "id": "...", "estado": "Pendiente", "aprobadores": [/*...*/] },
  "mails": [
    {
      "to": "carlos@empresa.com",
      "subject": "Aprobación requerida: ...",
      "link": "http://localhost:3000/approve?solicitud_id=...&approver_token=...",
      "otp": "123456"
    }
  ]
}
```

### `GET /api/solicitudes`

Lista todas las solicitudes (más recientes primero).

```json
{ "items": [ /* Solicitud[] */ ] }
```

### `GET /api/solicitudes/{id}`

Detalle de una solicitud con estado de cada aprobador y firmas.

### `GET /api/approve?approver_token={uuid}`

Inicia el desafío OTP para el aprobador (reutiliza OTP vigente o genera uno nuevo si expiró).

```json
{
  "solicitudId": "...",
  "aprobadorNombre": "Carlos Ruiz",
  "aprobadorRol": "Gerente",
  "requiresOtp": true,
  "otpHint": "OTP enviado (ver /api/mock-mail). Válido 3 minutos."
}
```

### `POST /api/approve/otp`

Valida el OTP. Si es correcto, abre sesión de decisión (~15 min).

**Body**

```json
{
  "approver_token": "uuid-del-aprobador",
  "otp": "123456"
}
```

**Respuesta `200`**

```json
{
  "sessionValidUntil": "2026-08-06T20:15:00.000Z",
  "solicitud": { /* detalle completo */ }
}
```

### `POST /api/approve/decision`

Registra la decisión. Requiere sesión OTP válida.

**Body**

```json
{
  "approver_token": "uuid-del-aprobador",
  "decision": "aprobar"
}
```

`decision` admite: `"aprobar"` | `"rechazar"`.

Al tercer `aprobar`, el backend genera el PDF y marca la solicitud como `Completada`.

### `GET /api/solicitudes/{id}/evidencia.pdf`

Descarga el PDF. Solo disponible si `estado === Completada`.

- Content-Type: `application/pdf`
- En API Gateway el body viaja en base64 (`isBase64Encoded`)

### `GET /api/mock-mail`

Lista correos simulados. Query opcional: `?solicitud_id={id}`.

También aceptado: `GET /mock-mail`.

### `OPTIONS *`

CORS habilitado (`Access-Control-Allow-Origin: *`).

---

## 12. Frontend (vistas y MFEs)

### Rutas

| Ruta | Vista | Descripción |
|------|-------|-------------|
| `/` | Lista | Panel del solicitante |
| `/nueva` | Formulario | Crear solicitud |
| `/solicitudes/:id` | Detalle | Estados, links, descargar PDF |
| `/approve?solicitud_id=&approver_token=` | Aprobador | OTP + firmar/rechazar |
| `/mock-mail` | Mock mail | Bandeja simulada |

### Module Federation

En `frontend/webpack.config.js` el host `avalShell` **expone**:

- `./SolicitanteApp` → `src/solicitante/SolicitanteApp.tsx`
- `./AprobadorApp` → `src/aprobador/AprobadorApp.tsx`

Comparten como singleton: `react`, `react-dom`, `react-router-dom`.

El shell monta ambos MFEs por rutas; el `remoteEntry.js` permite consumirlos desde otros hosts.

---

## 13. Backend (capas y persistencia)

| Capa | Responsabilidad |
|------|-----------------|
| `handlers/` | Traduce HTTP ↔ casos de uso; no contiene reglas de negocio |
| `services/solicitudService.ts` | Crear, OTP, decidir, listar mails, evidencia |
| `services/pdfService.ts` | Render del PDF con pdfkit |
| `repositories/` | Abstracción `SolicitudStore` / `MailStore` / `PdfStore` |
| `shared/container.ts` | Elige SQLite (local) vs DynamoDB+S3 (AWS) |

### DynamoDB (diseño single-table)

| PK | SK | Uso |
|----|----|-----|
| `SOL#{id}` | `META` | Solicitud completa |
| `TOKEN#{uuid}` | `META` | Lookup token → solicitud + aprobador |
| `MAIL#{id}` | `META` | Correo simulado |

GSI1: listados por tipo (`SOLICITUDES` / `MAILS`) ordenados por fecha.

### S3

Objetos: `evidencias/{solicitudId}.pdf`

---

## 14. OTP, tokens y seguridad

| Aspecto | Comportamiento |
|---------|----------------|
| Token de aprobador | UUID v4 en el link; no reutilizable entre aprobadores |
| OTP | 6 dígitos; se hashea con SHA-256 antes de persistir |
| TTL OTP | **3 minutos** desde generación |
| Regeneración | Solo si no hay OTP o ya expiró; si sigue vigente se reutiliza |
| Sesión post-OTP | ~15 minutos para poder aprobar/rechazar |
| Firma | Nombre del aprobador + timestamp ISO |
| CORS | Abierto en demo (`*`); restringir en producción |

> En producción real se recomienda SMTP/SES, rate-limit de OTP, HTTPS obligatorio y tokens de un solo uso más estrictos.

---

## 15. PDF de evidencia

Generado automáticamente cuando los **3** aprobadores están en `Firmado`.

Contenido:

- Datos de la solicitud (id, título, descripción, monto, solicitante, fechas, estado)
- Tabla/sección de aprobadores: rol, nombre, email, estado, firma y timestamp
- Firma tipográfica simulada (estilo cursiva + línea)

Endpoint de descarga: `/api/solicitudes/{id}/evidencia.pdf`  
En AWS, API Gateway trata `application/pdf` como binario (`BinaryMediaTypes`). El frontend descarga con `Accept: application/pdf` y arma un blob local.

---

## 16. Pruebas y cobertura

### Ejecutar

```bash
# Ambos paquetes
npm test

# Por separado
npm test --prefix backend
npm test --prefix frontend
```

### Umbral

Configurado en Jest: **mínimo 60%** (líneas / statements).  
Cobertura observada en desarrollo:

- Backend ≈ **94%** statements / **73%** branches  
- Frontend ≈ **82%** statements / **83%** lines  

### Qué se prueba

- **Backend:** OTP, validaciones de creación, flujo completo de 3 firmas + PDF, rechazo, expiración de OTP, helpers HTTP
- **Frontend:** badges, helpers API, lista de solicitudes, formulario de creación, flujo OTP → firmar del aprobador

Reportes HTML: `backend/coverage/` y `frontend/coverage/`.

---

## 17. Despliegue en AWS (SAM)

### Recursos provisionados (`backend/template.yaml`)

| Recurso | Tipo |
|---------|------|
| `AvalApi` | API Gateway REST (CORS + PDF binario) |
| `AvalFunction` | Lambda Node.js 20 (router único `{proxy+}`) |
| `AvalTable` | DynamoDB on-demand + GSI1 |
| `EvidenciasBucket` | S3 cifrado, sin acceso público |

### Pasos

```bash
cd backend
npm ci
npm run build

# Primera vez (interactivo)
sam build
sam deploy --guided --parameter-overrides AppBaseUrl=https://URL-DE-SU-FRONTEND

# Despliegues siguientes
sam build
sam deploy
```

Anote la salida `ApiUrl` del stack.

### Conectar el frontend a la API desplegada

1. Anote el `ApiUrl` del stack SAM.
2. En `frontend/.env` (copie desde `frontend/.env.example`):

```env
API_BASE_URL=https://xxxx.execute-api.us-east-1.amazonaws.com/Prod
```

3. Reinicie el frontend (`npm run dev:frontend`). Debe verse en consola:
   `[aval] API_BASE_URL=https://...`
4. Axios, el proxy `/api` y el link del PDF usarán ese host.

Sin `API_BASE_URL`, el frontend espera backend local en `http://localhost:4000`.

El parámetro `AppBaseUrl` se usa para armar los links de los correos simulados (`/approve?solicitud_id=...&approver_token=...`).

### Limpieza

```bash
sam delete --stack-name aval-aprobaciones
```

---

## 18. Scripts disponibles

### Raíz

| Script | Descripción |
|--------|-------------|
| `npm run install:all` | Instala backend + frontend |
| `npm run dev:backend` | Backend local con hot reload |
| `npm run dev:frontend` | Webpack dev server :3000 |
| `npm test` | Tests de ambos paquetes |
| `npm run build:backend` | Compila TypeScript → `backend/dist` |
| `npm run build:frontend` | Build producción Webpack → `frontend/dist` |

### Backend (`backend/`)

| Script | Descripción |
|--------|-------------|
| `npm run dev` | `ts-node-dev` local-server |
| `npm start` | `ts-node` local-server |
| `npm run build` | `tsc` |
| `npm test` | Jest + coverage |

### Frontend (`frontend/`)

| Script | Descripción |
|--------|-------------|
| `npm start` | Webpack serve desarrollo |
| `npm run build` | Bundle producción + `remoteEntry.js` |
| `npm test` | Jest + Testing Library + coverage |

---

## 19. Variables de entorno

| Variable | Default local | Descripción |
|----------|---------------|-------------|
| `LOCAL_MODE` | `true` | Usa SQLite en lugar de AWS |
| `PORT` | `4000` | Puerto Express |
| `APP_BASE_URL` | `http://localhost:3000` | Base de links en correos |
| `SQLITE_PATH` | `backend/.data/aval.db` | Ruta del archivo SQLite (solo local) |
| `TABLE_NAME` | — | Tabla DynamoDB (AWS) |
| `BUCKET_NAME` | — | Bucket S3 de PDFs (AWS) |
| `API_BASE_URL` | `''` (mismo origen / proxy `:4000`) | Base del API en frontend (`frontend/.env`) |

---

## 20. Troubleshooting

| Problema | Solución |
|----------|----------|
| Frontend no llama al API | Verifique que el backend esté en `:4000` **o** que `frontend/.env` tenga `API_BASE_URL` y reinicie Webpack |
| PDF proxy ECONNREFUSED | El link iba a `:4000` sin backend local; configure `API_BASE_URL` en `frontend/.env` y reinicie |
| PDF dañado / corrupto | API Gateway no decodificaba binario; redespliegue con `application~1pdf` y use el botón Descargar (blob). No uses `*/*` en BinaryMediaTypes |
| Network Error / ERR_FAILED al crear solicitud | Suele ser CORS o `BinaryMediaTypes: */*` rompiendo JSON; quite `*/*`, redespliegue SAM y recargue el frontend |
| OTP inválido | Use el OTP del mail de ese aprobador en Mock mail (si expiró, reabra el link) |
| OTP expirado | Espere < 3 min o vuelva a abrir el link de aprobación |
| “Sesión OTP inválida” | Valide de nuevo el OTP antes de aprobar/rechazar |
| PDF 400 / no disponible | Solo existe cuando los 3 aprobaron (`Completada`) |
| Roles duplicados al crear | Los 3 roles deben ser distintos |
| Quieres resetear datos en local | Borre `backend/.data/aval.db` (y reinicie el backend si está corriendo) |
| `sam build` falla en Windows | Ejecute el build en WSL/CI Linux, o compile con `npm run build` y ajuste el artefacto |
| CORS en AWS | El template ya permite origen `*`; si usa dominio propio, restrínjalo |

---

## Licencia / uso

Proyecto elaborado como **prueba técnica**. Uso libre para evaluación y demostración.
