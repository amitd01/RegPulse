.PHONY: help jira-status jira-transitions jira-move jira-comment jira-done jira-progress

help:
	@echo "Jira Commands:"
	@echo "  make jira-status ISSUE=RP-2              Get issue status"
	@echo "  make jira-transitions ISSUE=RP-2        List available transitions"
	@echo "  make jira-move ISSUE=RP-2 STATUS=Done   Move issue to status"
	@echo "  make jira-comment ISSUE=RP-2 MSG='...'  Add comment to issue"
	@echo "  make jira-done ISSUE=RP-2 MSG='...'     Move to Done with comment"
	@echo "  make jira-progress ISSUE=RP-2 MSG='...' Move to In Progress with comment"

# Jira integration
jira-status:
	@./scripts/jira.sh status $(ISSUE)

jira-transitions:
	@./scripts/jira.sh transitions $(ISSUE)

jira-move:
	@./scripts/jira.sh move $(ISSUE) "$(STATUS)"

jira-comment:
	@./scripts/jira.sh comment $(ISSUE) "$(MSG)"

jira-done:
	@./scripts/jira.sh update $(ISSUE) "Done" "$(MSG)"

jira-progress:
	@./scripts/jira.sh update $(ISSUE) "In Progress" "$(MSG)"
