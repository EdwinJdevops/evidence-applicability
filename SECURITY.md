# Security boundaries

This local CLI reads two caller-selected manifest files. It never invokes infrastructure tools, accesses a network, evaluates commands, or echoes manifest values. Use ordinary local files and avoid special devices or pipes. Keep raw plans, variable values, state, identity credentials and production artifacts out of the repository.

Both inputs are untrusted assertions. A digest string can be fabricated, copied or replayed. The CLI does not read the underlying artifacts, canonicalize inputs, validate a signature, authenticate an issuer, validate review freshness, or detect a change after the target snapshot. A scope match depends on the caller's namespace and completeness. Even matching digests can omit relevant variables, state or external conditions.

For deployment use, a future verifier would need independently collected artifact and target measurements, a trusted signer policy and explicit binding of signer, operation, scope, plan, inputs, state and validity interval. It would also need revocation or replay handling and a freshness check coordinated with execution. Keep authoritative approval and locking in the deployment system. Do not wire the CLI's exit codes to deployment permission.

Report a potential security issue through GitHub private vulnerability reporting if available. Avoid sharing live secrets or sensitive artifacts in any report.
