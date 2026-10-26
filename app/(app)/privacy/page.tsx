export const metadata = {
  title: "Privacy Policy",
  description: "What Job Atlas collects, why, and how your account data, cookies, and job preferences are handled.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

const contact = () => (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim() || "the site operator";

function P({ children }: { children: React.ReactNode }) {
  return <div className="panel">{children}</div>;
}

export default function PrivacyPage() {
  return (
    <div className="workspace">
      <section className="results">
        <div className="section-title">
          <div>
            <h2>Privacy Policy</h2>
            <p>Last reviewed: the policy below describes only behavior implemented in this application.</p>
          </div>
        </div>

        <P>
          <h3>What this site is</h3>
          <p>
            Job Atlas aggregates job listings from public job boards and hiring feeds (each source is listed on the{" "}
            <a href="/sources">Sources</a> page) and lets signed-in users save preferences and track applications.
          </p>
        </P>

        <P>
          <h3>Data we collect</h3>
          <p>
            <b>Account data.</b> When you sign in with Google we receive your email address, name, and profile picture
            from Google. When you sign in by email we process the address you type to send a one-time sign-in link.
          </p>
          <p>
            <b>Profile and preference data.</b> If you use them, we store your saved search filters, manual and excluded
            keywords, source ranking, and uploaded resumes. Resumes are parsed on our server to extract keywords for job
            matching; the extracted keywords are stored with your profile.
          </p>
          <p>
            <b>Activity data.</b> The job status you set (listed, applied, cancelled, ignored) and the time you set it,
            so your pipeline persists between visits.
          </p>
          <p>
            <b>Job listings.</b> Titles, companies, locations, tags, descriptions, and links fetched from connected
            third-party feeds. This data is about employers, not about you.
          </p>
        </P>

        <P>
          <h3>Why we use it</h3>
          <p>
            To sign you in and keep you signed in, to filter and rank listings against your preferences, and to remember
            your job pipeline. We do not run analytics, advertising, or cross-site tracking.
          </p>
        </P>

        <P>
          <h3>Cookies and browser storage</h3>
          <p>
            <b>Cookies.</b> A signed session cookie keeps you logged in for up to seven days, and a short-lived cookie
            protects the Google sign-in handshake. Both are required for the site to function; there are no tracking
            cookies.
          </p>
          <p>
            <b>Browser storage.</b> Your theme preference (light/dark) is stored in local storage. Scroll position and a
            sign-in prompt dismissal flag are stored in session storage and cleared when the tab closes.
          </p>
        </P>

        <P>
          <h3>Third-party services</h3>
          <p>
            <b>Google</b> provides sign-in (OAuth and One Tap); Google processes your Google account data under its own
            privacy policy. <b>Email delivery</b> (currently Resend/Brevo, configured by the operator) receives your
            email address solely to deliver sign-in links. <b>Job boards</b> supply listing content; clicking a
            job&apos;s external apply link takes you to that site, which has its own policies.
          </p>
        </P>

        <P>
          <h3>Sharing</h3>
          <p>
            We do not sell or share your data with third parties beyond the service providers above, each used only for
            the function described.
          </p>
        </P>

        <P>
          <h3>Retention and deletion</h3>
          <p>
            Sign-in tokens expire within minutes and session cookies within seven days. Profile data, preferences,
            resumes, and job statuses are kept while your account is active. To request deletion of your account data,
            contact the operator below.
          </p>
        </P>

        <P>
          <h3>Security</h3>
          <p>
            Session cookies are signed and HttpOnly, sign-in links are single-use and time-limited, and the site sends
            standard browser security headers. No system is perfectly secure; use a strong Google account.
          </p>
        </P>

        <P>
          <h3>Contact</h3>
          <p>
            Questions about this policy or requests about your data: <a href={`mailto:${contact()}`}>{contact()}</a>.
          </p>
        </P>
      </section>
    </div>
  );
}
