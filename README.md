<p align="center">
  <img src="https://github.com/Amirust/lumia-backend/blob/main/readme_files/readme_cover.webp?raw=true" alt="Lumia" />
</p>

# Lumia

This is a hobby project. A friend of mine had a huge pile of anime screenshots and nowhere decent to keep them, so it grew into the idea of building a proper place to store them with an auto-tagger powered by a neural network ([Camie Tagger v2](https://huggingface.co/Camais03/camie-tagger-v2)).

Frontend lives here: https://github.com/Amirust/lumia-frontend

This repository is the backend.

## How it works

The backend is split into two parts:

- **NestJS** acts as the gateway and the main API. It handles auth, the gallery, images, tags, characters and anime, talks to Postgres and to the object storage, and orchestrates everything else.
- **A Rust microservice** does the heavy lifting. It generates WebP thumbnails and runs ONNX inference for tag detection. Keeping this in a separate service means the Node side never blocks on CPU-bound image work.

When an image is uploaded, Nest hands the file to the Rust service, which returns the predicted tags and a thumbnail. Nest stores the results and notifies the client.

### Tag detection

Tags come from the [Camie Tagger v2](https://huggingface.co/Camais03/camie-tagger-v2) model, exported to ONNX and served through [`ort`](https://github.com/pykeio/ort) (ONNX Runtime) inside the Rust service. The service handles image decoding, preprocessing into NCHW tensors, and inference, with a semaphore limiting how many images run through the model at once.

### Streaming tags over SSE

Tag generation isn't instant, so the result is pushed to the client as it becomes ready instead of making them poll. This is done with Server-Sent Events:

```
GET /images/:imageId/events
```

WebSockets would be overkill here.

### Response format

All regular API responses use a Cloudflare-style envelope:

```json
{
  "ok": true,
  "result": {},
  "errors": []
}
```

This is applied globally by [`ResponseSerializerInterceptor`](libs/response/src/response.interceptor.ts). SSE endpoints are skipped, since they stream raw events rather than wrapped JSON.

## Tech stack

- **NestJS 11** on Fastify
- **Drizzle ORM** + **PostgreSQL**
- **better-auth** for authentication (with passkey support)
- **S3-compatible storage** (Cloudflare R2) via the AWS SDK
- **Rust** + **axum** + **ort** for the thumbnail / tagging microservice

## Project structure

```
backend/
  src/                     NestJS application
    anime/
    characters/
    gallery/
    images/                upload + SSE event stream
    tags/
    users/
    common/
    openapi/
    app.module.ts
    main.ts
  libs/                    shared workspace libraries
    better-auth/           auth setup
    db/                    Drizzle schema, migrations, module
    events/                SSE event bus
    ml-client/             HTTP client for the Rust service
    r2/                    object storage
    response/              response envelope interceptor
    task-queue/            background job queue
    lru-cache/
    types/
    utils/
```

The Rust microservice lives in [`ml/`](../ml) at the repository root.

## Setup

```bash
pnpm install
```

Copy `.env` and fill in the database URL, storage credentials, and the ML service URL/token.

```bash
# development
pnpm run start:dev

# production
pnpm run build
pnpm run start:prod
```

Database migrations:

```bash
pnpm run migrate:generate   # generate from schema changes
pnpm run migrate:migrate    # apply
```

## Credits

Tag detection is powered by the [Camie Tagger v2](https://huggingface.co/Camais03/camie-tagger-v2) model by [Camais03](https://huggingface.co/Camais03). Thanks for making it available.
