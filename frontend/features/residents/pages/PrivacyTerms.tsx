import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routePaths';
import legalContent from './PrivacyTermsContent.md?raw';

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

          <div className="rounded-xl border border-[#dfe7e5] bg-[#edf7f5] px-4 py-4 text-[#26313a]">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h3 className="mb-3 mt-4 border-t border-[#d5dfdd] pt-3 text-base font-bold text-[#167568] first:mt-0 first:border-0 first:pt-0">
                    {children}
                  </h3>
                ),
                h2: ({ children }) => (
                  <h4 className="mb-1 mt-3 text-sm font-bold text-[#167568]">{children}</h4>
                ),
                p: ({ children }) => (
                  <p className="my-1.5 text-xs leading-[1.4]">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="my-1.5 list-disc space-y-0.5 pl-4 text-xs leading-[1.4]">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-1.5 list-decimal space-y-0.5 pl-4 text-xs leading-[1.4]">{children}</ol>
                ),
                li: ({ children }) => <li className="pl-0.5">{children}</li>,
                hr: () => <hr className="my-3 border-[#d5dfdd]" />,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              }}
            >
              {legalContent}
            </ReactMarkdown>
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
