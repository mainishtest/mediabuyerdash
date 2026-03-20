export const metadata = {
  title: "Terms of Service – Media Buying Dashboard",
  description: "Terms of service for mediabuyerdash.com",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-slate-300">
      <h1 className="mb-2 text-3xl font-bold text-white">Terms of Service</h1>
      <p className="mb-10 text-sm text-slate-500">
        Last updated: March 17, 2026
      </p>

      <Section title="1. Acceptance of Terms">
        <p>
          By accessing or using mediabuyerdash.com (the &ldquo;Service&rdquo;),
          you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;).
          If you do not agree, do not use the Service. These Terms apply to all
          users, including individuals accessing the Service on behalf of an
          organisation.
        </p>
      </Section>

      <Section title="2. Description of Service">
        <p>
          Media Buying Dashboard provides a software-as-a-service platform for
          media buyers to connect advertising accounts, view performance data,
          and manage campaigns. Features include dashboard reporting, creative
          analysis, and integrations with third-party advertising platforms such
          as Meta / Facebook Ads.
        </p>
      </Section>

      <Section title="3. Accounts">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            You must provide accurate information when creating an account and
            keep it up to date.
          </li>
          <li>
            You are responsible for all activity that occurs under your account
            and for maintaining the confidentiality of your credentials.
          </li>
          <li>
            You must notify us immediately at{" "}
            <a
              href="mailto:support@mediabuyerdash.com"
              className="text-emerald-400 underline hover:text-emerald-300"
            >
              support@mediabuyerdash.com
            </a>{" "}
            if you suspect any unauthorised access to your account.
          </li>
          <li>
            You must be at least 18 years old and have the legal authority to
            enter into these Terms.
          </li>
        </ul>
      </Section>

      <Section title="4. Acceptable Use">
        <p className="mb-3">You agree not to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Use the Service for any unlawful purpose or in violation of any
            applicable laws or regulations.
          </li>
          <li>
            Violate the terms of service of any connected third-party platform
            (including Meta&rsquo;s Platform Terms).
          </li>
          <li>
            Attempt to gain unauthorised access to any part of the Service or
            its infrastructure.
          </li>
          <li>
            Reverse engineer, decompile, or disassemble any part of the Service.
          </li>
          <li>
            Use the Service to transmit spam, malware, or other harmful content.
          </li>
          <li>
            Resell or sublicense access to the Service without our written
            permission.
          </li>
        </ul>
      </Section>

      <Section title="5. Third-Party Integrations">
        <p>
          The Service allows you to connect third-party advertising platforms.
          By connecting an integration, you authorise us to access and retrieve
          data from those platforms on your behalf using the permissions you
          grant. Your use of any third-party platform is governed by that
          platform&rsquo;s own terms and policies. We are not responsible for
          the availability or accuracy of third-party data or services.
        </p>
      </Section>

      <Section title="6. Intellectual Property">
        <p>
          All software, design, and content comprising the Service are owned by
          or licensed to Media Buying Dashboard and are protected by applicable
          intellectual property laws. You are granted a limited, non-exclusive,
          non-transferable licence to use the Service solely for your internal
          business purposes. You retain ownership of all data you import or
          generate through the Service.
        </p>
      </Section>

      <Section title="7. Data and Privacy">
        <p>
          Our collection and use of personal information is described in our{" "}
          <a
            href="/privacy"
            className="text-emerald-400 underline hover:text-emerald-300"
          >
            Privacy Policy
          </a>
          , which is incorporated into these Terms by reference.
        </p>
      </Section>

      <Section title="8. Disclaimers">
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; without warranties of any kind, express or implied,
          including but not limited to warranties of merchantability, fitness for
          a particular purpose, or non-infringement. We do not warrant that the
          Service will be uninterrupted, error-free, or that any data retrieved
          from third-party platforms will be accurate or complete.
        </p>
      </Section>

      <Section title="9. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, Media Buying Dashboard and its
          officers, employees, and affiliates shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages,
          including loss of profits, data, or goodwill, arising out of or in
          connection with your use of the Service, even if advised of the
          possibility of such damages. Our total aggregate liability to you for
          any claims arising under these Terms shall not exceed the amount you
          paid us in the twelve months preceding the claim.
        </p>
      </Section>

      <Section title="10. Indemnification">
        <p>
          You agree to indemnify and hold harmless Media Buying Dashboard and its
          affiliates from any claims, damages, or expenses (including reasonable
          legal fees) arising from your use of the Service, your violation of
          these Terms, or your violation of any third-party rights.
        </p>
      </Section>

      <Section title="11. Modifications to the Service and Terms">
        <p>
          We reserve the right to modify or discontinue the Service at any time
          with reasonable notice. We may also update these Terms from time to
          time. Continued use of the Service after changes take effect
          constitutes acceptance of the revised Terms. We will update the
          &ldquo;Last updated&rdquo; date at the top of this page when changes
          are made.
        </p>
      </Section>

      <Section title="12. Termination">
        <p>
          We may suspend or terminate your account at any time if you breach
          these Terms or for any other reason with reasonable notice. You may
          terminate your account at any time by contacting us. Upon termination,
          your right to use the Service ceases immediately.
        </p>
      </Section>

      <Section title="13. Governing Law">
        <p>
          These Terms shall be governed by and construed in accordance with
          applicable law. Any disputes arising under these Terms shall be subject
          to the exclusive jurisdiction of the competent courts in the applicable
          jurisdiction.
        </p>
      </Section>

      <Section title="14. Contact">
        <p>Questions about these Terms should be sent to:</p>
        <p className="mt-3">
          <strong className="text-slate-200">Media Buying Dashboard</strong>
          <br />
          <a
            href="mailto:support@mediabuyerdash.com"
            className="text-emerald-400 underline hover:text-emerald-300"
          >
            support@mediabuyerdash.com
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
