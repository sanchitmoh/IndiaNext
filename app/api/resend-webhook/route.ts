import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// Resend webhook secret (optional, for signature verification)
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  // Read raw body for signature verification
  const rawBody = await req.text();
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (_err) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Signature verification
  const signature = req.headers.get('x-resend-signature');
  if (RESEND_WEBHOOK_SECRET && signature) {
    const expected = crypto
      .createHmac('sha256', RESEND_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    if (signature !== expected) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  // Supported event types: delivered, opened, bounced
  const { type, data } = event;
  if (!type || !data || !data.messageId) {
    return NextResponse.json({ error: 'Missing event type or messageId' }, { status: 400 });
  }

  // Find CampaignRecipient by messageId
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { messageId: data.messageId },
  });
  if (!recipient) {
    return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
  }

  // Update status and timestamps
  const update: any = {};
  if (type === 'delivered') {
    update.status = 'DELIVERED';
    update.deliveredAt = new Date();
  } else if (type === 'opened') {
    update.status = 'OPENED';

    update.openedAt = new Date();
  } else if (type === 'bounced') {
    update.status = 'BOUNCED';
    update.error = data.error || 'Bounced';
  } else {
    return NextResponse.json({ error: 'Unsupported event type' }, { status: 400 });
  }

  await prisma.campaignRecipient.update({
    where: { messageId: data.messageId },
    data: update,
  });

  // Optionally update campaign stats (denormalized)
  // TODO: Add aggregate update if needed

  return NextResponse.json({ success: true });
}
