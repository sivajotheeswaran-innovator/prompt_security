# TrustLayer
Problem: Employees paste sensitive data (Aadhaar, PAN, cards, API keys, customer info) into AI chatbots with no visibility or control.
Solution: A gateway that scans prompts, scores risk, redacts/blocks per policy, forwards only the safe version to Gemini, restores placeholders in the reply, and keeps a privacy-safe audit log.
Users: employees (chat) and a security admin (dashboard/policy). Single role is fine for MVP.
Success = a judge can: register, paste a risky prompt, see highlighted findings + explanation, see the redacted prompt reach Gemini, see the answer restored, and see the event on the dashboard.
Out of scope: file uploads, multi-tenant orgs, email/Slack alerts, browser extension.
