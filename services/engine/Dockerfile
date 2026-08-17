FROM python:3.11-slim

WORKDIR /app

# System deps kept minimal; sxtwl ships manylinux wheels so no compiler needed.
COPY requirements.txt requirements-dev.txt ./
ARG INSTALL_DEV=false
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$INSTALL_DEV" = "true" ]; then pip install --no-cache-dir -r requirements-dev.txt; fi
# PyTorch CPU-only wheel (smaller, no CUDA) for §4.4-EXT category-M DL models.
RUN pip install --no-cache-dir torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu

COPY app ./app

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
