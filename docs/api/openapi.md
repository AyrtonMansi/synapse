# Synapse API OpenAPI Specification

## OpenAPI 3.0.3 Document

```yaml
openapi: 3.0.3
info:
  title: Synapse API
  description: |
    Decentralized compute marketplace for AI inference and distributed computing.
  version: 1.0.0
  contact:
    name: Synapse Support
    email: api@synapse.io
    url: https://synapse.io/support

servers:
  - url: https://api.synapse.io/v1
    description: Production server
  - url: https://api.staging.synapse.io/v1
    description: Staging server

security:
  - bearerAuth: []

paths:
  /tasks:
    post:
      summary: Submit a new task
      operationId: submitTask
      tags:
        - Tasks
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TaskRequest'
      responses:
        '201':
          description: Task created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaskResponse'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    TaskRequest:
      type: object
      required:
        - type
        - input
      properties:
        type:
          type: string
          enum: [inference, training, data_processing, custom]
        model:
          type: string
        input:
          type: object
        requirements:
          type: object
        payment:
          type: object
        timeout:
          type: integer

    TaskResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            task_id:
              type: string
            status:
              type: string
            estimated_cost:
              type: string
```

## Using the OpenAPI Spec

### Generate Client SDKs

```bash
# Generate Python client
openapi-generator-cli generate \
  -i synapse-api.yaml \
  -g python \
  -o synapse-python-client

# Generate TypeScript client
openapi-generator-cli generate \
  -i synapse-api.yaml \
  -g typescript-fetch \
  -o synapse-typescript-client
```

### Interactive Documentation

View interactive API documentation at:
- Swagger UI: https://api.synapse.io/docs
- ReDoc: https://api.synapse.io/redoc

### Postman Collection

Import the OpenAPI spec directly into Postman for testing.
