# Live Data Setup with AWS

This guide walks you through wiring the JobDock app to the live AWS stack so the UI reads and writes real data instead of the in-browser mocks.

---

## 1. Sync AWS outputs into `.env`

Every CDK deploy emits stack outputs (API Gateway URL, Cognito IDs, etc.). Instead of copying them by hand, run the helper script:

```bash
# Default: env=dev, region=us-east-1, writes .env + backend/.env
npm run sync:aws:env -- --env=dev --region=us-east-1

# Optional flags
#   --stack=JobDockStack-prod        # Custom stack name
#   --frontend=.env.local            # Frontend env target
#   --backend=backend/.env.prod      # Backend env target
#   --dry-run                        # Preview without writing files
```

The script uses the AWS SDK (so make sure `aws configure` is complete) and writes:

- Frontend `.env` → `VITE_API_URL`, Cognito IDs, bucket name, etc.
- Backend `.env` → database secret ARN, endpoint, Cognito IDs, bucket, tenant defaults.

> Tip: rerun the script after every `cdk deploy` so both apps stay in sync.

---

## 2. Flip the app to “Live · AWS”

Once the env files exist, restart `npm run dev`. At the top of every authenticated page you’ll now see a **Data Source** indicator:

- **Live · AWS** — hitting API Gateway + Aurora via Lambda
- **Mock · Local** — using deterministic in-memory data

Use the **Use live AWS data** button (or set `VITE_USE_MOCK_DATA=false`) to tell the stores/components to hit the live API. The toggle stores your preference in `localStorage` and reloads the app so all modules pick up the change.

---

## 3. Apply migrations + seed data

1. `cd backend && npm install`
2. Make sure the SSH tunnel to Aurora is open (DB is private), then export a `DATABASE_URL` that targets `localhost:5432` through the tunnel. Example:
   ```powershell
   $env:DATABASE_URL = "postgresql://dbadmin:<PASSWORD>@localhost:5432/jobdock?schema=public"
   ```
3. Generate the Prisma client (needed for both Lambdas and the seed script): `npm run prisma:generate`
4. Apply the tracked migrations to Aurora: `npm run prisma:deploy`
5. Seed baseline tenant/user/service/contact data so the UI has something to render: `npm run prisma:seed`
6. Deploy Lambdas with CDK (`cd infrastructure && npm run deploy:dev`) when you need the latest code in AWS.

Once the env files + database are ready, all feature stores (`contacts`, `quotes`, `invoices`, `jobs`, `services`) automatically switch from `mockServices` to the live Axios-backed services whenever the Data Source indicator is set to **Live · AWS**.

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `sync:aws:env` fails with “stack not found” | Check `--env`/`--stack` values and that CDK deployed successfully. |
| Live mode still shows localhost URL | Run `npm run sync:aws:env` again or manually set `VITE_API_URL`. |
| 401 redirect loop | Ensure Cognito user pool + app client IDs match the deployed stack. |
| Database errors | Verify `DATABASE_SECRET_ARN` grants Lambda access and migrations ran. |

Need extra help? See `AWS_SETUP_GUIDE.md` for full infrastructure steps or ping the Data Source indicator hint inside the app for quick reminders.

