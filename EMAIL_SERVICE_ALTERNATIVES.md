# Email Service Alternatives to Resend

## 🎯 Quick Answer

If you want to switch from Resend with **minimal code changes** (just environment variables), here are your best options:

---

## 1. ✅ **Plunk** (Easiest Migration - 95% Compatible)

### Why Choose Plunk?

- API is nearly identical to Resend
- Free tier: 3,000 emails/month
- Simple migration: mostly env changes

### Setup:

```env
# .env
PLUNK_API_KEY="pk_xxxxxxxxxxxxx"
EMAIL_FROM="hackathon@indianexthackthon.online"
```

### Code Changes Required:

**Minimal** - Just replace Resend initialization:

```typescript
// Before (Resend)
const resend = new Resend(process.env.RESEND_API_KEY);

// After (Plunk)
const plunk = new Plunk(process.env.PLUNK_API_KEY);

// API calls remain the same
await plunk.emails.send({
  from: 'hackathon@indianexthackthon.online',
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Hello World</p>',
});
```

**Migration Effort**: 🟢 Low (1-2 hours)

---

## 2. ✅ **SendGrid** (Most Popular)

### Why Choose SendGrid?

- Industry standard, very reliable
- Free tier: 100 emails/day (3,000/month)
- Excellent deliverability
- Great documentation

### Setup:

```env
# .env
SENDGRID_API_KEY="SG.xxxxxxxxxxxxx"
EMAIL_FROM="hackathon@indianexthackthon.online"
```

### Code Changes Required:

**Moderate** - Different API structure:

```typescript
// Install: npm install @sendgrid/mail
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

await sgMail.send({
  from: 'hackathon@indianexthackthon.online',
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Hello World</p>',
});
```

**Migration Effort**: 🟡 Medium (3-4 hours)

---

## 3. ✅ **Mailgun** (Developer-Friendly)

### Why Choose Mailgun?

- Developer-focused
- Free tier: 5,000 emails/month (first 3 months)
- Good API documentation
- Flexible pricing

### Setup:

```env
# .env
MAILGUN_API_KEY="key-xxxxxxxxxxxxx"
MAILGUN_DOMAIN="mg.indianexthackthon.online"
EMAIL_FROM="hackathon@indianexthackthon.online"
```

### Code Changes Required:

**Moderate** - Different API:

```typescript
// Install: npm install mailgun.js form-data
import formData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY!,
});

await mg.messages.create(process.env.MAILGUN_DOMAIN!, {
  from: 'hackathon@indianexthackthon.online',
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Hello World</p>',
});
```

**Migration Effort**: 🟡 Medium (3-4 hours)

---

## 4. ✅ **Postmark** (Transactional Focus)

### Why Choose Postmark?

- Excellent for transactional emails
- Fast delivery
- Great analytics
- Free tier: 100 emails/month

### Setup:

```env
# .env
POSTMARK_API_KEY="xxxxxxxxxxxxx"
EMAIL_FROM="hackathon@indianexthackthon.online"
```

### Code Changes Required:

**Moderate** - Different API:

```typescript
// Install: npm install postmark
import postmark from 'postmark';

const client = new postmark.ServerClient(process.env.POSTMARK_API_KEY!);

await client.sendEmail({
  From: 'hackathon@indianexthackthon.online',
  To: 'user@example.com',
  Subject: 'Hello',
  HtmlBody: '<p>Hello World</p>',
});
```

**Migration Effort**: 🟡 Medium (3-4 hours)

---

## 5. ✅ **Amazon SES** (Cheapest at Scale)

### Why Choose Amazon SES?

- Extremely cheap: $0.10 per 1,000 emails
- Unlimited scale
- AWS integration
- Best for high volume

### Setup:

```env
# .env
AWS_ACCESS_KEY_ID="AKIAXXXXXXXXXXXXX"
AWS_SECRET_ACCESS_KEY="xxxxxxxxxxxxx"
AWS_REGION="us-east-1"
EMAIL_FROM="hackathon@indianexthackthon.online"
```

### Code Changes Required:

**Significant** - AWS SDK:

```typescript
// Install: npm install @aws-sdk/client-ses
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

await ses.send(
  new SendEmailCommand({
    Source: 'hackathon@indianexthackthon.online',
    Destination: { ToAddresses: ['user@example.com'] },
    Message: {
      Subject: { Data: 'Hello' },
      Body: { Html: { Data: '<p>Hello World</p>' } },
    },
  })
);
```

**Migration Effort**: 🔴 High (6-8 hours)

---

## 6. ✅ **Brevo (formerly Sendinblue)** (All-in-One)

### Why Choose Brevo?

- Free tier: 300 emails/day (9,000/month)
- Marketing + Transactional
- SMS included
- Good UI

### Setup:

```env
# .env
BREVO_API_KEY="xkeysib-xxxxxxxxxxxxx"
EMAIL_FROM="hackathon@indianexthackthon.online"
```

### Code Changes Required:

**Moderate**:

```typescript
// Install: npm install @sendinblue/client
import SibApiV3Sdk from '@sendinblue/client';

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY!);

await apiInstance.sendTransacEmail({
  sender: { email: 'hackathon@indianexthackthon.online' },
  to: [{ email: 'user@example.com' }],
  subject: 'Hello',
  htmlContent: '<p>Hello World</p>',
});
```

**Migration Effort**: 🟡 Medium (3-4 hours)

---

## 📊 Comparison Table

| Service        | Free Tier     | Migration Effort | API Similarity | Best For        |
| -------------- | ------------- | ---------------- | -------------- | --------------- |
| **Plunk**      | 3,000/month   | 🟢 Low           | 95%            | Quick migration |
| **SendGrid**   | 3,000/month   | 🟡 Medium        | 60%            | Reliability     |
| **Mailgun**    | 5,000/month\* | 🟡 Medium        | 65%            | Developers      |
| **Postmark**   | 100/month     | 🟡 Medium        | 60%            | Transactional   |
| **Amazon SES** | Pay-as-go     | 🔴 High          | 30%            | High volume     |
| **Brevo**      | 9,000/month   | 🟡 Medium        | 55%            | Marketing too   |

\*First 3 months only

---

## 🎯 **Recommendation for Your Project**

### For Immediate Switch (Today):

**Use Plunk** - Most similar API, minimal code changes

### For Long-term (Production):

**Use SendGrid** - Most reliable, industry standard

### For Budget (High Volume):

**Use Amazon SES** - Cheapest at scale

---

## 🚀 Quick Migration Guide (Plunk)

### Step 1: Sign up for Plunk

1. Go to https://useplunk.com
2. Create account
3. Verify your domain
4. Get API key

### Step 2: Update Environment Variables

```env
# Add to .env
PLUNK_API_KEY="pk_xxxxxxxxxxxxx"

# Keep existing (for fallback)
RESEND_API_KEY="re_xxxxxxxxxxxxx"
```

### Step 3: Update Code (One File)

```typescript
// lib/email.ts
function getEmailClient() {
  // Try Plunk first, fallback to Resend
  if (process.env.PLUNK_API_KEY) {
    return new Plunk(process.env.PLUNK_API_KEY);
  }
  return new Resend(process.env.RESEND_API_KEY);
}
```

### Step 4: Test

```bash
# Send test email
npm run test:email
```

### Step 5: Deploy

```bash
# Update Vercel env vars
vercel env add PLUNK_API_KEY

# Deploy
vercel --prod
```

---

## ⚠️ Important Notes

### Domain Verification Required

All services require you to verify your domain:

- Add DNS records (SPF, DKIM, DMARC)
- Verify ownership
- Wait for propagation (can take 24-48 hours)

### Current Domain

Your domain: `indianexthackthon.online`

- Already verified with Resend
- Need to re-verify with new service
- Keep Resend active during transition

### Webhook URLs

If using webhooks for delivery tracking:

- Update webhook URLs in new service
- Current: `/api/resend-webhook`
- May need to create new endpoint for different service

---

## 💡 Pro Tips

1. **Test in Development First**
   - Use test API keys
   - Send to your own email
   - Verify formatting

2. **Keep Resend as Fallback**
   - Don't remove Resend immediately
   - Use dual-provider setup
   - Switch gradually

3. **Monitor Deliverability**
   - Check spam rates
   - Monitor bounce rates
   - Track open rates

4. **Update Email Templates**
   - Some services have different HTML rendering
   - Test all email templates
   - Check mobile rendering

---

## 📞 Need Help?

If you need help migrating, I can:

1. Create a multi-provider email wrapper
2. Update all email sending code
3. Set up fallback logic
4. Test the migration

Just let me know which service you want to use!
