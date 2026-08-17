# Tianming Lottery Analyzer — dev/CI entrypoints
ENGINE_IMG = tianming-engine-dev
DATA = $(CURDIR)/data/thai.xlsx

.PHONY: test test-engine build-engine up down import web-build

## Build the engine image with dev deps (pytest etc.)
build-engine:
	docker build --build-arg INSTALL_DEV=true -t $(ENGINE_IMG) services/engine

## Run the full engine test suite (golden + schools + backtest + api)
test-engine: build-engine
	docker run --rm \
	  -v "$(CURDIR)/services/engine:/app" \
	  -v "$(DATA):/data/thai.xlsx:ro" \
	  -e TIANMING_DATA_XLSX=/data/thai.xlsx \
	  -w /app $(ENGINE_IMG) pytest -q

## CI entrypoint
test: test-engine

## Bring the whole stack up (postgres + engine + web)
up:
	docker compose up --build

down:
	docker compose down

## Import Excel -> Postgres (run after `up`)
import:
	cd packages/db && npm install && npm run generate && npm run migrate:dev && DATA_XLSX=../../data/thai.xlsx npm run import

web-build:
	cd apps/web && npm install && npm run build
