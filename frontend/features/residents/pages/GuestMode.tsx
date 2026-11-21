import { ArrowLeft, Camera, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import heroCoastal from '@/features/residents/assets/hero-coastal.jpg';
import { useAppPreferences } from '@/lib/preferences';

const GuestMode = () => {
  const navigate = useNavigate();
  const { translate } = useAppPreferences();

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#e7f8fb] text-[#101924] lg:grid lg:h-screen lg:min-h-0 lg:grid-cols-[44%_56%]">
      <section className="relative isolate flex h-[35dvh] min-h-[290px] min-[380px]:min-h-0 flex-col overflow-hidden bg-[#087f72] px-6 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-white sm:px-10 sm:pb-8 sm:pt-10 lg:h-screen lg:min-h-0 lg:rounded-r-[42px] lg:px-[clamp(36px,4.5vw,64px)] lg:py-[clamp(20px,3vh,32px)]">
        <img
          src={heroCoastal}
          alt="Fishing boats along the coast of Barangay Purisima"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(4,104,92,0.84)_0%,rgba(2,106,94,0.76)_54%,rgba(0,128,119,0.72)_100%)]" />

        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
            <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] border-2 border-white bg-white/10 sm:h-[68px] sm:w-[68px] lg:h-[52px] lg:w-[52px]">
              <img
                src="/assets/branding/cora-logo.png"
                alt="CORA logo"
                className="h-full w-full scale-[1.08] object-cover"
              />
            </div>
            <div className="min-w-0 leading-[1.1]">
              <p className="text-[22px] font-extrabold tracking-[-0.04em] sm:text-[32px] lg:text-[26px]">CORA</p>
              <p className="mt-0.5 truncate text-xs font-semibold sm:text-lg lg:text-[14px]">Community Report System</p>
              <p className="mt-0.5 truncate text-[9px] font-medium text-white/90 sm:text-xs lg:text-[10px]">
                Barangay Purisima, Tago, Surigao del Sur
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[#087765] shadow-sm lg:hidden">
            <UserRound className="h-4 w-4" strokeWidth={2.2} />
            <span className="whitespace-nowrap text-xs font-bold">Guest Mode</span>
          </div>
        </div>

        <div className="mt-5 max-w-[460px] sm:mt-14 lg:mt-[10vh]">
          <h1 className="max-w-[320px] text-[27px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[44px] lg:max-w-none lg:text-[clamp(30px,2.8vw,42px)]">
            {translate('Report a Specific Barangay Concern')}
          </h1>
          <p className="mt-3 max-w-[410px] text-[13px] font-medium leading-[1.5] text-white/90 sm:mt-4 sm:text-lg lg:text-[clamp(14px,1.25vw,18px)]">
            {translate('Report community issues in Barangay Purisima.')}
          </p>
          <span className="mt-3 block h-1.5 w-16 rounded-full bg-[#b9fff0] sm:mt-5 sm:w-24" />
        </div>
      </section>

      <section className="relative flex min-h-[65dvh] items-start justify-center bg-[linear-gradient(180deg,#e3f8fa_0%,#f0fcfd_100%)] px-6 pb-10 pt-6 sm:px-10 sm:pb-12 sm:pt-8 lg:h-screen lg:min-h-0 lg:items-center lg:px-[5vw] lg:pb-7 lg:pt-16">
        <div className="absolute right-5 top-5 hidden items-center gap-2 rounded-full bg-[#dff8f2] px-4 py-2.5 text-[#087765] sm:right-9 sm:top-6 lg:right-[4vw] lg:top-5 lg:flex">
          <UserRound className="h-[18px] w-[18px] text-[#102836]" strokeWidth={2.2} />
          <span className="text-xs font-bold sm:text-sm">Guest Mode</span>
        </div>

        <div className="w-full max-w-[520px] lg:max-w-[560px]">
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="mb-8 hidden items-center gap-2 text-muted-foreground transition-colors hover:text-foreground lg:flex"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Sign In Page</span>
          </button>

          <div className="w-full rounded-[22px] border border-white/80 bg-[linear-gradient(145deg,#ffffff_0%,#f8fcff_100%)] px-5 py-5 text-center shadow-[0_12px_28px_rgba(19,91,101,0.14)] sm:rounded-[24px] sm:px-8 sm:py-9">
            <div className="mx-auto flex h-[84px] w-[84px] items-center justify-center rounded-[22px] bg-[#d4f7f1] text-[#06735f] sm:h-[104px] sm:w-[104px] sm:rounded-[26px]">
              <Camera className="h-14 w-14 sm:h-[60px] sm:w-[60px]" strokeWidth={2.25} />
            </div>

            <h2 className="mt-3 text-[26px] font-extrabold leading-[1.15] tracking-[-0.04em] text-[#10213b] sm:mt-4 sm:text-[32px]">
              Report an Issue
            </h2>
            <p className="mx-auto mt-1 max-w-[440px] text-[14px] font-medium leading-[1.4] text-[#65758d] sm:mt-2.5 sm:text-base">
              Capture a photo of a community concern
              <br className="hidden sm:block" /> in Barangay Purisima.
            </p>

            <button
              type="button"
              onClick={() => navigate('/report-issue?mode=guest')}
              className="mt-5 flex h-11 w-full items-center justify-center gap-3 rounded-[15px] bg-[linear-gradient(100deg,#078a73_0%,#007b67_100%)] px-5 text-base font-extrabold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#087d6e]/25 active:translate-y-0 sm:mt-6 sm:h-14 sm:text-lg"
            >
              <Camera className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.1} />
              Capture Photo
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default GuestMode;
