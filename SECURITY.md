# Security Hardening and Deployment Checklist

This project includes application-level safeguards and a production deployment checklist for the remaining cloud controls. Review each item before the production release.

## Application safeguards already in place

1. Secrets Manager
   - Secrets are read from environment variables, not committed into source files.
   - Example values are documented in `.env.example`.

2. Encryption in Transit
   - HTTPS/TLS is required in production.
   - Use a certificate on the load balancer or reverse proxy and force secure traffic.

3. VPC
   - Not implemented in this repo itself; must be configured in the deployment environment.

4. Security Groups / Firewalls
   - Not implemented in this repo itself; must be configured in the cloud provider.

5. Database Least Privilege
   - Not implemented in this repo itself; must be configured in MongoDB access controls.

6. Encryption at Rest
   - Not implemented in this repo itself; must be configured in the cloud database and storage layer.

7. Load Balancer (Reverse Proxy)
   - Not implemented in this repo itself; must be configured in the hosting platform.

8. Input Validation & Sanitization
   - Backend validation is implemented for auth and exam submission inputs.
   - `express-mongo-sanitize` and `xss-clean` are enabled in `backend/app.js`.

9. Secure Authentication (AuthN)
   - JWTs are issued as secure HTTP-only cookies.
   - Session lifetime is set to 8 hours.
   - MFA should be added through an identity provider for production use.

10. Role-Based Access Control (RBAC)
   - Protected routes enforce role checks for `student`, `analyst`, `reviewer`, and `admin`.

11. CORS Hardening
   - A strict allowlist of frontend origins is enforced in `backend/app.js`.

12. Security Headers
   - `helmet` is enabled with HSTS, frame guard, no-sniff, CSP defaults, and XSS filtering.

13. Rate Limiting
   - Express rate limiting is enabled on the `/api` routes.

14. WAF
   - Not implemented in this repo itself; must be configured at the edge or cloud firewall layer.

15. DDoS Protection
   - Not implemented in this repo itself; must be configured through a CDN or managed edge service.

16. SSH/Access Bastion Host
   - Not implemented in this repo itself; must be configured in the infrastructure layer.

17. Dependency Scanning (SCA)
   - Recommended to add `npm audit`, GitHub Dependabot, or an equivalent CI step.

18. Container/Server Hardening
   - Not implemented in this repo itself; must be configured in the deployment environment.

19. Centralized Logging (SIEM)
   - Recommended to forward logs to a central platform for retention and analysis.

20. Anomalous Activity Alerts
   - Recommended to configure monitors for repeated failed logins, admin actions, and large exports.

## Production launch checklist

- Set runtime environment variables from `.env.example` in the production host.
- Configure a real HTTPS frontend and backend domain.
- Use a managed database and private network architecture.
- Put the backend behind a load balancer or reverse proxy.
- Restrict inbound ports to only the required public entry points.
- Run dependency scanning in CI/CD before deployment.
- Enable centralized logging and alerting before launch.
- Require MFA for admin/reviewer accounts in the hosting or identity provider.
- Live student video is peer-to-peer, is not recorded, and is only visible when a reviewer joins. Add a privacy notice and obtain consent before enabling camera access in production.
- Tab/focus and screenshot-shortcut checks are best-effort browser signals, not reliable proof of misconduct or protection against screenshots, alternate devices, or modified clients.
- Run one backend process until active proctoring sessions are moved to shared storage and Socket.IO is configured with a multi-process adapter.

## Notes

This project is a good app-level foundation, but cloud networking and identity controls must be configured outside the application code to achieve a production-grade security posture.
