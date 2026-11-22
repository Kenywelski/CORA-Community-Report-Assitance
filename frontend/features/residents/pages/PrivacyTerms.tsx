import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routePaths';

const PrivacyTerms = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [accepted, setAccepted] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? ROUTES.auth;

  const handleContinue = () => {
    if (!accepted) return;
    navigate(from, { replace: true, state: { termsAccepted: true } });
  };

  return (
    <main className="min-h-screen bg-[#eef3f2] px-0 py-0 sm:px-4 sm:py-6">
      <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col overflow-hidden bg-white sm:min-h-[780px] sm:rounded-[34px] sm:border-[5px] sm:border-[#202a29] sm:shadow-2xl">
        <header className="flex h-16 shrink-0 items-center border-b border-[#e4e8e7] px-4">
          <button
            type="button"
            onClick={() => navigate(from)}
            className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[#1f2937] transition-colors hover:bg-[#edf7f5]"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <h1 className="flex-1 pr-9 text-center text-base font-bold text-[#26313a]">
            Privacy Policy &amp; Terms
          </h1>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-3 pt-5 sm:px-6">
          <div className="mb-4 text-center">
            <img
              src="/assets/branding/cora-logo.png"
              alt="CORA"
              className="mx-auto mb-1 h-12 w-12 object-contain"
            />
            <h2 className="text-[25px] font-extrabold leading-tight text-[#167568]">
              Privacy Policy &amp; Terms
            </h2>
            <p className="mx-auto mt-2 max-w-[330px] text-xs leading-5 text-[#4f5b66]">
              Please read the Privacy Policy and Terms &amp; Conditions carefully before using CORA. By continuing, you agree to both.
            </p>
          </div>

          <div className="space-y-4 rounded-xl border border-[#dfe7e5] bg-[#edf7f5] px-4 py-4 text-[#26313a]">
            <article>
              <p className="mb-1 text-xs font-semibold text-[#167568]">Last updated: January 15, 2025</p>
              <h3 className="text-base font-bold">Privacy Policy</h3>
              <p className="mt-1 text-xs leading-[1.35]">
                Learn how CORA collects, uses, and protects your personal information when you use our app.
              </p>
              <h4 className="mt-2 text-sm font-bold">1. Introduction</h4>
              <p className="text-xs leading-[1.35]">
                This Privacy Policy explains how CORA (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) collects, uses, discloses, and protects your information when you use the CORA mobile application (&quot;the App&quot;).
              </p>
              <h4 className="mt-2 text-sm font-bold">2. Information We Collect</h4>
              <p className="text-xs leading-[1.35]">
                We may collect information you provide directly to us, such as your account details (e.g., name, email address), and information we collect automatically, such as app usage data, device information, and log data.
              </p>
              <h4 className="mt-2 text-sm font-bold">3. How We Use Your Information</h4>
              <p className="text-xs leading-[1.35]">
                We use your information to provide and improve the App, manage your account, personalize your experience, and ensure the security and proper functioning of our services.
              </p>
            </article>

            <article className="border-t border-[#d5dfdd] pt-3">
              <h3 className="text-base font-bold">Terms &amp; Conditions</h3>
              <p className="mt-1 text-xs leading-[1.35]">
                Please read the terms and conditions carefully before using CORA.
              </p>
              <h4 className="mt-2 text-sm font-bold">1. Acceptance of Terms</h4>
              <p className="text-xs leading-[1.35]">
                These Terms and Conditions (&quot;Terms&quot;) govern your use of the CORA mobile application (&quot;the App&quot;). By accessing or using the App, you agree to be bound by these Terms.
              </p>
              <h4 className="mt-2 text-sm font-bold">2. Use of the App</h4>
              <p className="text-xs leading-[1.35]">
                You may use CORA only for lawful purposes and in accordance with these Terms. You agree not to misuse the App, interfere with its operation, or attempt to gain unauthorized access to our systems or other users&apos; accounts.
              </p>
              <h4 className="mt-2 text-sm font-bold">3. Account and Security</h4>
              <p className="text-xs leading-[1.35]">
                To access certain features, you may need to create an account. You are responsible for keeping your account information accurate and for all activities that occur under your account.
              </p>
            </article>
          </div>
        </div>

        <footer className="shrink-0 border-t border-[#edf0ef] bg-white px-5 pb-5 pt-3 sm:px-6">
          <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-[#4f5b66]">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#167568]"
            />
            <span>I have read the Privacy Policy and agree to the Terms &amp; Conditions.</span>
          </label>
          <button
            type="button"
            disabled={!accepted}
            onClick={handleContinue}
            className="mt-3 h-12 w-full rounded-lg bg-[#167568] text-base font-bold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            Accept and Continue
          </button>
        </footer>
      </section>
    </main>
  );
};

export default PrivacyTerms;
