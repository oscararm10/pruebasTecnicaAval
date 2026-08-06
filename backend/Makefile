# Compilar TypeScript e instalar deps de producción en el artefacto SAM
build-AvalFunction:
	npm ci
	npm run build
	cp -R dist $(ARTIFACTS_DIR)/
	cp package.json package-lock.json $(ARTIFACTS_DIR)/ 2>/dev/null || cp package.json $(ARTIFACTS_DIR)/
	cd $(ARTIFACTS_DIR) && npm install --omit=dev
