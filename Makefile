.PHONY: run-dev login-aws-dev

AWS_PROFILE := amplify-policy-075701661574

run-dev:
	@echo "Checking AWS credentials..."
	@if ! aws sts get-caller-identity --profile $(AWS_PROFILE) > /dev/null 2>&1; then \
		echo "Credentials expired or missing. Logging in..."; \
		$(MAKE) login-aws-dev; \
	fi
	@echo "Starting Amplify Sandbox and Next.js Dev Server..."
	npx ampx sandbox --profile $(AWS_PROFILE) & pnpm run dev
login-aws-dev:
	@echo "Logging in to AWS Amplify..."
	aws sso login --profile $(AWS_PROFILE)
