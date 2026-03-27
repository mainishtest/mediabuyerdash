import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../../../lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const client = await prisma.clientAccount.findUnique({
    where: { id: params.clientId },
    select: {
      defaultAdAccountId: true, defaultPageId: true, defaultPixelId: true, defaultDestinationUrl: true,
      defaultDailyBudget: true, defaultObjective: true, defaultOptGoal: true,
      defaultTargetCountries: true, defaultAgeMin: true, defaultAgeMax: true,
      defaultGender: true, defaultUtmSource: true, defaultUtmMedium: true,
      defaultUtmCampaign: true, defaultUtmContent: true, defaultUtmTerm: true,
    },
  });
  return NextResponse.json({ ok: true, defaults: client });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const body = await req.json();
  await prisma.clientAccount.update({
    where: { id: params.clientId },
    data: {
      defaultAdAccountId:    body.defaultAdAccountId    || null,
      defaultPageId:         body.defaultPageId         || null,
      defaultPixelId:        body.defaultPixelId        || null,
      defaultDestinationUrl: body.defaultDestinationUrl || null,
      defaultDailyBudget:    body.defaultDailyBudget    ? parseFloat(body.defaultDailyBudget) : null,
      defaultObjective:      body.defaultObjective      || null,
      defaultOptGoal:        body.defaultOptGoal        || null,
      defaultTargetCountries: body.defaultTargetCountries || null,
      defaultAgeMin:         body.defaultAgeMin         ? parseInt(body.defaultAgeMin) : null,
      defaultAgeMax:         body.defaultAgeMax         ? parseInt(body.defaultAgeMax) : null,
      defaultGender:         body.defaultGender != null ? parseInt(body.defaultGender) : null,
      defaultUtmSource:      body.defaultUtmSource      || null,
      defaultUtmMedium:      body.defaultUtmMedium      || null,
      defaultUtmCampaign:    body.defaultUtmCampaign    || null,
      defaultUtmContent:     body.defaultUtmContent     || null,
      defaultUtmTerm:        body.defaultUtmTerm        || null,
    },
  });
  return NextResponse.json({ ok: true });
}
