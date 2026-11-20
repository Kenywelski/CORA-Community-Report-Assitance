import { Camera, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import heroCoastal from '@/features/residents/assets/hero-coastal.jpg';
import { useAppPreferences } from '@/lib/preferences';

const GuestMode = () => {
  const navigate = useNavigate();
  const { translate } = useAppPreferences();

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8fbfc] text-[#101924] lg:grid lg:h-screen lg:min-h-0 lg:grid-cols-[44%_56%]">
      <section className="relative isolate min-h-[48vh] overflow-hidden bg-[#087f72] px-6 py-7 text-white sm:px-10 sm:py-10 lg:flex lg:h-screen lg:min-h-0 lg:flex-col lg:rounded-r-[42px] lg:px-[clamp(36px,4.5vw,64px)] lg:py-[clamp(20px,3vh,32px)]">
        <img
          src={heroCoastal}
          alt="Fishing boats along the coast of Barangay Purisima"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(4,104,92,0.93)_0%,rgba(2,106,94,0.86)_54%,rgba(0,128,119,0.78)_100%)]" />

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white/10 sm:h-[68px] sm:w-[68px] lg:h-[52px] lg:w-[52px]">
            <img
              src="/assets/branding/cora-logo.png"
              alt="CORA logo"
              className="h-full w-full scale-[1.08] object-cover"
            />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-[28px] font-extrabold tracking-[-0.04em] sm:text-[32px] lg:text-[26px]">CORA</p>
            <p className="mt-0.5 text-sm font-semibold sm:text-lg lg:text-[14px]">Community Report System</p>
            <p className="mt-0.5 text-[11px] font-medium text-white/90 sm:text-xs lg:text-[10px]">
              Barangay Purisima, Tago, Surigao del Sur
            </p>
          </div>
        </div>

        <div className="mt-12 max-w-[460px] sm:mt-14 lg:mt-[10vh]">
          <h1 className="text-[36px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[44px] lg:text-[clamp(30px,2.8vw,42px)]">
            {translate('Report a Specific Barangay Concern')}
          </h1>
          <p className="mt-4 max-w-[410px] text-sm font-medium leading-relaxed text-white/90 sm:text-lg lg:text-[clamp(14px,1.25vw,18px)]">
            {translate('Report garbage, road damage, streetlights, drainage, or other problems in Barangay Purisima.')}
          </p>
          <span className="mt-5 block h-1.5 w-20 rounded-full bg-[#53e1ca] sm:w-24" />
        </div>
      </section>

      <section className="relative flex min-h-[52vh] items-center justify-center px-5 pb-12 pt-24 sm:px-10 sm:pb-16 sm:pt-28 lg:h-screen lg:min-h-0 lg:px-[5vw] lg:pb-7 lg:pt-16">
        <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full bg-[#dff8f2] px-4 py-2.5 text-[#087765] sm:right-9 sm:top-6 lg:right-[4vw] lg:top-5">
          <UserRound className="h-[18px] w-[18px] text-[#102836]" strokeWidth={2.2} />
          <span className="text-xs font-bold sm:text-sm">Guest Mode</span>
        </div>

        <div className="w-full max-w-[520px] rounded-[24px] border border-[#dce5e9] bg-white px-6 py-8 text-center shadow-[0_14px_30px_rgba(30,65,79,0.11)] sm:px-8 sm:py-9 xl:max-w-[560px]">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[24px] bg-[#e1faf4] text-[#066b5d] sm:h-[104px] sm:w-[104px] sm:rounded-[26px]">
            <Camera className="h-14 w-14 sm:h-[60px] sm:w-[60px]" strokeWidth={2.25} />
          </div>

          <h2 className="mt-4 text-[28px] font-extrabold tracking-[-0.04em] text-[#101924] sm:text-[32px]">
            Report an Issue
          </h2>
          <p className="mx-auto mt-2.5 max-w-[440px] text-sm font-semibold leading-relaxed text-[#617487] sm:text-base">
            Capture a photo of a community concern
            <br className="hidden sm:block" /> in Barangay Purisima.
          </p>

          <button
            type="button"
            onClick={() => navigate('/report-issue?mode=guest')}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2.5 rounded-[16px] bg-[linear-gradient(90deg,#087d6e_0%,#05816f_100%)] px-5 text-base font-extrabold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#087d6e]/25 active:translate-y-0 sm:h-14 sm:text-lg"
          >
            <Camera className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.1} />
            Capture Photo
          </button>
        </div>
      </section>
    </main>
  );
};

export default GuestMode;
