.PHONY: test

# Run the plenary.nvim test suite.
# Requires: nvim 0.7+ on PATH.
# plenary.nvim is auto-bootstrapped into /tmp/plenary.nvim if not found.
test:
	nvim --headless -u tests/minimal_init.lua \
	  -c "PlenaryBustedDirectory tests/spec/ {minimal_init = 'tests/minimal_init.lua'}" \
	  -c "qa"
