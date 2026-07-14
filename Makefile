.DEFAULT_GOAL := help

BUN ?= bun
NPM ?= npm

.PHONY: help install start example test test-watch lint lint-fix build docs docs-clean check pack clean

help: ## Show available targets
	@awk 'BEGIN { FS = ":.*## " } /^[a-zA-Z0-9_-]+:.*## / { printf "%-14s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install dependencies with Bun
	$(BUN) install

start: ## Open the interactive configuration UI
	$(BUN) run start

example: ## Render the bundled Copilot payload example
	$(BUN) run example

test: ## Run the test suite
	$(BUN) test

test-watch: ## Run tests in watch mode
	$(BUN) test --watch

lint: ## Run TypeScript and ESLint checks
	$(BUN) run lint

lint-fix: ## Apply intentional ESLint fixes
	$(BUN) run lint:fix

build: ## Build the Node.js distribution bundle
	$(BUN) run build

docs: ## Generate TypeDoc documentation
	$(BUN) run docs

docs-clean: ## Remove generated TypeDoc documentation
	$(BUN) run docs:clean

check: lint test build ## Run all required pre-handoff checks

pack: build ## Inspect the npm package without creating a tarball
	$(NPM) pack --dry-run

clean: ## Remove generated output
	rm -rf dist typedoc coverage
