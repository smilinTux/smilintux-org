FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir ".[dev]" && pip install --no-cache-dir uvicorn[standard]

COPY skills_registry/ ./skills_registry/

ENV REGISTRY_DB=/var/lib/skills-registry/registry.db
ENV REGISTRY_PACKAGES_DIR=/var/lib/skills-registry/packages
ENV PORT=8080

VOLUME ["/var/lib/skills-registry"]

EXPOSE 8080

CMD ["uvicorn", "skills_registry.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
