# Multi-stage Dockerfile for SolFoundry Email Notification Service.
# Stage 1: Dependencies
FROM python:3.11-slim AS dependencies

WORKDIR /build

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim AS runtime

LABEL org.opencontainers.image.source="https://github.com/SolFoundry/solfoundry"
LABEL org.opencontainers.image.description="SolFoundry Email Notification Service"

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    useradd --create-home --shell /bin/bash solfoundry

USER solfoundry
WORKDIR /home/solfoundry/app

COPY --from=dependencies --chown=solfoundry:solfoundry /opt/venv /opt/venv
COPY --chown=solfoundry:solfoundry app/ ./app/

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/home/solfoundry/app

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8100/api/notifications/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]