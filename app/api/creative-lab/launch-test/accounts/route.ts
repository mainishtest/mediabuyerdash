// Loads available Meta ad accounts for the launch test form.

import { NextResponse } from "next/server";
import { prisma }       from "../../../../../lib/db";

export async function GET() {
  const connection = await prisma.metaConnection.findFirst({
    where: { connectionStatus: "active" },
    include: {
      selectedAccounts: {
        include: {
          accessibleAdAccount: {
            select: {
              id: true,
              externalAdAccountId: true,
              accountName: true,
            },
          },
        },
      },
    },
  });

  if (!connection) {
    return NextResponse.json({ ok: false, error: "No active Meta connection", accounts: [] });
  }

  const accounts = connection.selectedAccounts.map((s) => ({
    id:                  s.accessibleAdAccount.id,
    externalAdAccountId: s.accessibleAdAccount.externalAdAccountId,
    accountName:         s.accessibleAdAccount.accountName,
  }));

  return NextResponse.json({ ok: true, accounts });
}
