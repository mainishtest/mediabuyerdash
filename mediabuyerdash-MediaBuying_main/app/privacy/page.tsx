export const metadata = {
  title: "Privacy Policy – Media Buying Dashboard",
  description: "Privacy policy for mediabuyerdash.com",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-slate-300">
      <h1 className="mb-2 text-3xl font-bold text-white">Privacy Policy</h1>
      <p className="mb-10 text-sm text-slate-500">
        Last updated: March 17, 2026
      </p>

      <Section title="1. Overview">
        <p>
          Media Buying Dashboard (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or
          &ldquo;us&rdquo;) operates mediabuyerdash.com (the &ldquo;Service&rdquo;).
          This Privacy Policy explains how we collect, use, and protect information
          about you when you use our Service.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <p className="mb-3">We collect the following categories of information:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-slate-200">Account information</strong> — name
            and email address provided during registration.
          </li>
          <li>
            <strong className="text-slate-200">Advertising data</strong> — ad
            account IDs, campaign performance metrics, and spend data retrieved
            from connected advertising platforms (e.g. Meta / Facebook Ads) via
            their official APIs, solely on your behalf.
          </li>
          <li>
            <strong className="text-slate-200">OAuth tokens</strong> — access
            tokens issued by third-party platforms when you connect an integration.
            These are stored encrypted and used only to fetch your data.
          </li>
          <li>
            <strong className="text-slate-200">Usage data</strong> — pages
            visited, features used, and error logs, collected automatically to
            improve the Service.
          </li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Information">
        <ul className="list-disc pl-6 space-y-2">
          <li>To provide, operate, and maintain the Service.</li>
          <li>
            To retrieve advertising data from connected platforms on your behalf
            and display it within your dashboard.
          </li>
          <li>To authenticate your identity and secure your account.</li>
          <li>
            To send transactional emails (e.g. password reset, account
            notifications). We do not send marketing email without consent.
          </li>
          <li>To diagnose bugs and improve the Service.</li>
        </ul>
      </Section>

      <Section title="4. Meta / Facebook Platform Data">
        <p className="mb-3">
          When you connect a Meta ad account, we request the{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-xs text-emerald-400">
            ads_read
          </code>{" "}
          and{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-xs text-emerald-400">
            business_management
          </code>{" "}
          permissions via the Meta Marketing API. We use this access exclusively
          to:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Display your campaign and ad-set performance data.</li>
          <li>Sync spend and delivery metrics to your dashboard.</li>
        </ul>
        <p className="mt-3">
          We do not sell, share, or use Meta platform data for advertising or
          training AI models. Data obtained through the Meta API is used only to
          operate features you explicitly request within the Service, consistent
          with{" "}
          <a
            href="https://developers.facebook.com/terms/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 underline hover:text-emerald-300"
          >
            Meta&rsquo;s Platform Terms
          </a>
          .
        </p>
      </Section>

      <Section title="5. Data Sharing">
        <p>
          We do not sell your personal information. We may share data with:
        </p>
        <ul className="mt-3 list-disc pl-6 space-y-2">
          <li>
            <strong className="text-slate-200">Service providers</strong> — such
            as our database host (Supabase) and infrastructure providers, under
            data processing agreements.
          </li>
          <li>
            <strong className="text-slate-200">Legal obligations</strong> — if
            required by applicable law or a valid legal process.
          </li>
        </ul>
      </Section>

      <Section title="6. Data Retention">
        <p>
          We retain your account data for as long as your account is active.
          OAuth access tokens are deleted when you disconnect an integration. You
          may request deletion of your account and associated data at any time by
          contacting us.
        </p>
      </Section>

      <Section title="7. Security">
        <p>
          We use industry-standard measures including TLS in transit and
          encryption at rest for sensitive credentials. No system is completely
          secure; please use a strong, unique password and notify us immediately
          of any suspected unauthorized access.
        </p>
      </Section>

      <Section title="8. Your Rights">
        <p>
          Depending on your jurisdiction, you may have the right to access,
          correct, or delete your personal data, or to restrict or object to its
          processing. To exercise these rights, contact us at the address below.
        </p>
      </Section>

      <Section title="9. Cookies">
        <p>
          We use session cookies required for authentication and basic Service
          functionality. We do not use third-party advertising or tracking
          cookies.
        </p>
      </Section>

      <Section title="10. Children">
        <p>
          The Service is not directed to children under 13 and we do not
          knowingly collect data from anyone under 13.
        </p>
      </Section>

      <Section title="11. Changes to This Policy">
        <p>
          We may update this policy from time to time. We will notify you of
          material changes by updating the &ldquo;Last updated&rdquo; date above
          and, where appropriate, by email.
        </p>
      </Section>

      <Section title="12. Contact Us">
        <p>
          Questions or requests regarding this Privacy Policy can be sent to:
        </p>
        <p className="mt-3">
          <strong className="text-slate-200">Media Buying Dashboard</strong>
          <br />
          <a
            href="mailto:privacy@mediabuyerdash.com"
            className="text-emerald-400 underline hover:text-emerald-300"
          >
            privacy@mediabuyerdash.com
          </a>
          <br />
          mediabuyerdash.com
        </p>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>
      <div className="leading-relaxed text-slate-400">{children}</div>
    </section>
  );
}
