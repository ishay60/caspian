# Stage 1: Build the React frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend that also serves the built frontend
FROM python:3.11-slim
WORKDIR /app

# Install the package (core + LLM extras)
COPY pyproject.toml ./
COPY src/ ./src/
RUN pip install --no-cache-dir -e ".[llm]"

# Copy the built frontend so the FastAPI app can serve it as static files
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8080

CMD ["uvicorn", "caspian.api:app", "--host", "0.0.0.0", "--port", "8080"]
