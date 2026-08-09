# Security policy

## Supported versions

Security fixes are provided for the latest released Editra version. Integrators should pin an exact version and runtime-integrity manifest, monitor release notices, and upgrade promptly. Pre-release branches and modified distributions are not covered by this policy.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting for `editra-js/Editra` when it is enabled, or email `editra.dev@gmail.com` with the subject `SECURITY: Editra vulnerability report`.

Include the affected version and configuration, impact, reproduction steps or proof of concept, required preconditions, and a safe contact method. Do not include real customer, payment-card, authentication, or regulated data. The Editra Team will target acknowledgement within three business days, triage within seven business days, and status updates at least every fourteen days. These are response targets, not contractual service levels.

Please allow coordinated remediation and disclosure. The project will request a CVE/GitHub Security Advisory when the issue affects a released version and meets vulnerability assignment criteria. Credit is offered unless the reporter asks to remain anonymous.

## Handling process

Reports are restricted to maintainers involved in triage. The team records severity using CVSS, affected versions, exploitability, ownership, remediation, regression tests, disclosure timing, and CVE/GHSA state. Critical issues may trigger release suspension and credential or artifact rotation.

Confirmed issues receive an accountable owner, regression test, adjacent-variant review, security-gate run, and coordinated disclosure decision. Target remediation after confirmation is 7 days for critical, 30 days for high, 90 days for moderate, and the next planned release for low severity. Exploitation or compensating controls can change a target only through a documented risk decision.

For a qualifying released vulnerability, the project requests a GitHub Security Advisory/CVE and publishes a new immutable version with upgrade or mitigation guidance. Published package versions and tags are never overwritten or moved.

## Incident response

The response process is to contain affected publication, preserve evidence, determine affected versions and integrations, develop and independently review a private fix, run the full security gate, publish a new immutable artifact, coordinate notification, monitor recovery, and record corrective actions. Integrators remain responsible for their production containment, regulator/acquirer notification, customer communication, continuity, and evidence-retention duties.

## Scope boundary

This policy covers the Editra source and official package artifacts. Host application authorization, server-side output handling, deployment CSP, custom plugins, imported files, and infrastructure remain the integrator's responsibility.
