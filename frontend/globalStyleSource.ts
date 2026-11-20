const globalStyleSource = String.raw`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

:root.dark {
  color-scheme: dark;
}

* {
  scrollbar-color: rgb(71 85 105 / 0.58) transparent;
  scrollbar-width: thin;
}

*::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  min-height: 48px;
  border-radius: 999px;
  border: 0;
  background: rgb(71 85 105 / 0.58);
}

*::-webkit-scrollbar-thumb:hover {
  background: rgb(51 65 85 / 0.78);
}

*::-webkit-scrollbar-button,
*::-webkit-scrollbar-button:single-button,
*::-webkit-scrollbar-button:vertical:decrement,
*::-webkit-scrollbar-button:vertical:increment,
*::-webkit-scrollbar-button:horizontal:decrement,
*::-webkit-scrollbar-button:horizontal:increment {
  display: none;
  width: 0;
  height: 0;
}

*::-webkit-scrollbar-corner {
  background: transparent;
}

@media (min-width: 1024px) {
  #root:has(.desktop-sidebar) {
    padding-left: 17rem;
    transition: padding-left 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  #root:has(.desktop-sidebar[data-collapsed="true"]) {
    padding-left: 6rem;
  }

  #root:has(.desktop-sidebar) [class~="lg:pt-14"] {
    padding-top: 0;
  }
}

.sidebar-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.sidebar-scroll::-webkit-scrollbar {
  display: none;
}

.announcement-dialog-scroll {
  scrollbar-color: rgb(71 85 105 / 0.58) transparent;
  scrollbar-width: thin;
}

.announcement-dialog-scroll::-webkit-scrollbar {
  width: 4px;
}

.announcement-dialog-scroll::-webkit-scrollbar-track {
  margin-block: 16px;
  background: transparent;
}

.announcement-dialog-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgb(71 85 105 / 0.58);
}

.announcement-dialog-scroll::-webkit-scrollbar-thumb:hover {
  background: rgb(51 65 85 / 0.78);
}

.announcement-dialog-scroll::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}

.announcement-dialog-scroll > button {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  outline: none;
}

.announcement-dialog-scroll > button:focus,
.announcement-dialog-scroll > button:focus-visible {
  box-shadow: none;
  outline: none;
}

/* Leaflet map styles - imported dynamically but needs base z-index */
.leaflet-container {
  z-index: 1;
  font-family: inherit;
}

.leaflet-pane {
  z-index: 1;
}

.leaflet-top,
.leaflet-bottom {
  z-index: 2;
}

@layer base {
  :root {
    /* Coastal-inspired palette for Barangay Purisima, Tago */
    --background: 180 20% 98%;
    --foreground: 200 50% 10%;

    --card: 0 0% 100%;
    --card-foreground: 200 50% 10%;

    --popover: 0 0% 100%;
    --popover-foreground: 200 50% 10%;

    /* Deep teal - trust & nature */
    --primary: 174 62% 28%;
    --primary-foreground: 0 0% 100%;

    /* Light teal background */
    --secondary: 174 30% 94%;
    --secondary-foreground: 174 62% 28%;

    --muted: 180 15% 95%;
    --muted-foreground: 200 20% 45%;

    /* Warm coral accent - community warmth */
    --accent: 16 85% 58%;
    --accent-foreground: 0 0% 100%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    /* Emergency red-orange */
    --emergency: 12 90% 52%;
    --emergency-foreground: 0 0% 100%;

    /* Success green */
    --success: 152 60% 42%;
    --success-foreground: 0 0% 100%;

    /* Warning amber */
    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 10%;

    --border: 180 15% 90%;
    --input: 180 15% 90%;
    --ring: 174 62% 28%;

    --radius: 1rem;

    /* Gradients */
    --gradient-primary: linear-gradient(135deg, hsl(174 62% 28%) 0%, hsl(180 55% 22%) 100%);
    --gradient-hero: linear-gradient(180deg, hsl(174 62% 28%) 0%, hsl(180 55% 35%) 50%, hsl(174 40% 45%) 100%);
    --gradient-card: linear-gradient(145deg, hsl(0 0% 100%) 0%, hsl(180 20% 98%) 100%);
    --gradient-accent: linear-gradient(135deg, hsl(16 85% 58%) 0%, hsl(25 90% 55%) 100%);

    /* Shadows */
    --shadow-sm: 0 1px 2px 0 hsl(200 50% 10% / 0.05);
    --shadow-md: 0 4px 6px -1px hsl(200 50% 10% / 0.08), 0 2px 4px -2px hsl(200 50% 10% / 0.05);
    --shadow-lg: 0 10px 15px -3px hsl(200 50% 10% / 0.08), 0 4px 6px -4px hsl(200 50% 10% / 0.05);
    --shadow-xl: 0 20px 25px -5px hsl(200 50% 10% / 0.1), 0 8px 10px -6px hsl(200 50% 10% / 0.05);
    --shadow-glow: 0 0 20px hsl(174 62% 28% / 0.3);

    --sidebar-background: 0 0% 98%;
    --sidebar-foreground: 240 5.3% 26.1%;
    --sidebar-primary: 240 5.9% 10%;
    --sidebar-primary-foreground: 0 0% 98%;
    --sidebar-accent: 240 4.8% 95.9%;
    --sidebar-accent-foreground: 240 5.9% 10%;
    --sidebar-border: 220 13% 91%;
    --sidebar-ring: 217.2 91.2% 59.8%;
  }

  .dark {
    --background: 200 50% 6%;
    --foreground: 180 20% 98%;

    --card: 200 45% 10%;
    --card-foreground: 180 20% 98%;

    --popover: 200 45% 10%;
    --popover-foreground: 180 20% 98%;

    --primary: 174 55% 45%;
    --primary-foreground: 0 0% 100%;

    --secondary: 200 40% 15%;
    --secondary-foreground: 174 55% 45%;

    --muted: 200 35% 15%;
    --muted-foreground: 180 15% 65%;

    --accent: 16 80% 55%;
    --accent-foreground: 0 0% 100%;

    --destructive: 0 70% 50%;
    --destructive-foreground: 0 0% 100%;

    --emergency: 12 85% 50%;
    --emergency-foreground: 0 0% 100%;

    --success: 152 55% 45%;
    --success-foreground: 0 0% 100%;

    --warning: 38 88% 48%;
    --warning-foreground: 0 0% 10%;

    --border: 200 35% 18%;
    --input: 200 35% 18%;
    --ring: 174 55% 45%;

    --gradient-primary: linear-gradient(135deg, hsl(174 55% 35%) 0%, hsl(180 50% 28%) 100%);
    --gradient-hero: linear-gradient(180deg, hsl(200 50% 8%) 0%, hsl(174 45% 18%) 100%);
    --gradient-card: linear-gradient(145deg, hsl(200 45% 12%) 0%, hsl(200 40% 10%) 100%);

    --sidebar-background: 240 5.9% 10%;
    --sidebar-foreground: 240 4.8% 95.9%;
    --sidebar-primary: 224.3 76.3% 48%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 240 3.7% 15.9%;
    --sidebar-accent-foreground: 240 4.8% 95.9%;
    --sidebar-border: 240 3.7% 15.9%;
    --sidebar-ring: 217.2 91.2% 59.8%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground font-sans antialiased;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  }

  h1, h2, h3, h4, h5, h6 {
    @apply font-semibold tracking-tight;
  }
}

@layer components {
  .glass-card {
    @apply bg-card/80 backdrop-blur-md border border-border/40;
    box-shadow: var(--shadow-lg);
  }

.service-card {
    @apply relative overflow-hidden rounded-2xl p-4 transition-all duration-300;
    background: var(--gradient-card);
    box-shadow: var(--shadow-md);
  }

  .service-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-xl);
  }

  /* Responsive container */
  .app-container {
    @apply max-w-md mx-auto;
  }

  @media (min-width: 768px) {
    .app-container {
      @apply max-w-2xl;
    }
  }

  @media (min-width: 1024px) {
    .app-container {
      @apply max-w-5xl;
    }
  }

  @media (min-width: 1280px) {
    .app-container {
      @apply max-w-6xl;
    }
  }

  .hero-gradient {
    background: var(--gradient-hero);
  }

  .accent-gradient {
    background: var(--gradient-accent);
  }

  .primary-gradient {
    background: var(--gradient-primary);
  }

  .text-gradient {
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .admin-action-edit {
    border: 1px solid hsl(var(--foreground) / 0.18) !important;
    background-color: hsl(var(--muted) / 0.45) !important;
    color: hsl(var(--foreground)) !important;
    box-shadow: none !important;
  }

  .admin-action-delete {
    border: 1px solid hsl(var(--destructive) / 0.36) !important;
    background-color: hsl(var(--destructive) / 0.08) !important;
    color: hsl(var(--destructive)) !important;
    box-shadow: none !important;
  }

  .admin-action-edit[aria-label],
  .admin-action-delete[aria-label] {
    width: 34px !important;
    min-width: 34px !important;
    height: 34px !important;
    padding: 0 !important;
    border-radius: 10px !important;
    transition: none !important;
  }

  .admin-action-edit[aria-label] > svg,
  .admin-action-delete[aria-label] > svg {
    width: 14px !important;
    height: 14px !important;
    stroke-width: 2.3;
  }

  .admin-layout .admin-action-edit.admin-action-edit:hover {
    border-color: hsl(var(--foreground) / 0.18) !important;
    background-color: hsl(var(--muted) / 0.45) !important;
    color: hsl(var(--foreground)) !important;
    opacity: 1 !important;
    filter: none !important;
    transform: none !important;
    box-shadow: none !important;
  }

  .admin-layout .admin-action-delete.admin-action-delete:hover {
    border-color: hsl(var(--destructive) / 0.36) !important;
    background-color: hsl(var(--destructive) / 0.08) !important;
    color: hsl(var(--destructive)) !important;
    opacity: 1 !important;
    filter: none !important;
    transform: none !important;
    box-shadow: none !important;
  }

  .admin-layout .admin-action-edit.admin-action-edit:hover > svg,
  .admin-layout .admin-action-delete.admin-action-delete:hover > svg {
    color: currentColor !important;
    stroke: currentColor !important;
  }

  .dark .admin-layout .admin-action-edit,
  .dark .admin-layout .admin-action-edit:hover {
    border-color: #29444e !important;
    background-color: #10232b !important;
    color: #dce7eb !important;
    box-shadow: none !important;
  }

  .dark .admin-layout .admin-action-delete,
  .dark .admin-layout .admin-action-delete:hover {
    border-color: #6a3540 !important;
    background-color: #2b1d24 !important;
    color: #f08b9c !important;
    box-shadow: none !important;
  }

  .dark .admin-layout .admin-action-edit:hover > svg,
  .dark .admin-layout .admin-action-delete:hover > svg {
    color: currentColor !important;
    stroke: currentColor !important;
  }

  .admin-action-edit:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--foreground) / 0.3) !important;
  }

  .admin-action-delete:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--destructive) / 0.35) !important;
  }
}

@layer utilities {
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out forwards;
  }

  .animate-slide-up {
    animation: slideUp 0.5s ease-out forwards;
  }

  .animate-scale-in {
    animation: scaleIn 0.3s ease-out forwards;
  }

  .animate-pulse-soft {
    animation: pulseSoft 2s ease-in-out infinite;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes pulseSoft {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }
}

/*
 * Compatibility layer for older resident screens that still use fixed light
 * palette utilities. Semantic Tailwind colors already follow the theme; these
 * rules bring the remaining page shells, cards, dialogs, and chatbot surfaces
 * into the same dark-mode system without changing brand/action colors.
 */
.dark body,
.dark [class~="bg-[#F8FAFC]"],
.dark [class~="bg-[#F6FAFB]"],
.dark [class~="bg-[#F5FAFB]"],
.dark [class*="bg-[radial-gradient"] {
  background: hsl(var(--background)) !important;
}

.dark :where(div, section, article, main, aside, form, nav, header, footer, input, textarea, select)[class~="bg-white"],
.dark [class~="bg-[#F7FAFA]"] {
  background-color: hsl(var(--card)) !important;
}

.dark [class~="bg-[#EAF6F4]"],
.dark [class~="bg-[#EAF7F3]"],
.dark [class~="bg-[#EAF8F4]"],
.dark [class~="bg-[#E8F7F2]"],
.dark [class~="bg-[#E6F7F0]"],
.dark [class~="bg-[#E3F6F0]"],
.dark [class~="bg-[#E2F6EF]"],
.dark [class~="bg-[#EEF7F5]"],
.dark [class~="bg-[#EDF9F5]"] {
  background-color: hsl(var(--primary) / 0.16) !important;
}

.dark [class~="bg-[#DDF4EC]"],
.dark [class~="bg-[#C8ECDF]"],
.dark [class~="bg-[#DCE5EA]"],
.dark [class~="bg-[#D7E1E8]"] {
  background-color: hsl(var(--muted)) !important;
}

.dark [class~="text-[#0B1725]"],
.dark [class~="text-[#0E1F2C]"],
.dark [class~="text-[#102534]"],
.dark [class~="text-[#102536]"],
.dark [class~="text-[#142B38]"],
.dark [class~="text-[#143A38]"],
.dark [class~="text-[#15313D]"],
.dark [class~="text-[#17303E]"],
.dark [class~="text-[#243B49]"],
.dark [class~="text-slate-900"],
.dark [class~="text-slate-800"] {
  color: hsl(var(--foreground)) !important;
}

.dark [class~="text-[#334E60]"],
.dark [class~="text-[#425B6B]"],
.dark [class~="text-[#486278]"],
.dark [class~="text-[#526C7D]"],
.dark [class~="text-[#5D7281]"],
.dark [class~="text-[#617789]"],
.dark [class~="text-[#64748B]"],
.dark [class~="text-slate-600"],
.dark [class~="text-slate-500"] {
  color: hsl(var(--muted-foreground)) !important;
}

.dark [class~="border-[#CBD8E2]"],
.dark [class~="border-[#CDDCE4]"],
.dark [class~="border-[#DCE5EA]"],
.dark [class~="border-[#DCE6EB]"],
.dark [class~="border-[#DCE7EC]"],
.dark [class~="border-[#E0E8ED]"],
.dark [class~="border-[#E1E9ED]"],
.dark [class~="border-[#E2E8F0]"],
.dark [class~="border-[#E3EAEE]"],
.dark [class~="border-[#E5ECEF]"],
.dark [class~="border-[#E6EDF1]"] {
  border-color: hsl(var(--border)) !important;
}

.dark input,
.dark textarea,
.dark select {
  color: hsl(var(--foreground));
}

/* Keep native select menus readable in Chromium/Windows dark mode. */
.dark select {
  color-scheme: dark;
  background-color: hsl(var(--card));
}

.dark select option {
  color: hsl(var(--foreground));
  background-color: hsl(var(--card));
}

.dark select option:disabled {
  color: hsl(var(--muted-foreground));
}

.dark input::placeholder,
.dark textarea::placeholder {
  color: hsl(var(--muted-foreground));
}

.report-issue-map .leaflet-control-zoom.leaflet-bar {
  overflow: hidden;
  border: 0;
  border-radius: 9px;
  box-shadow: 0 2px 8px rgb(15 23 42 / 0.2);
}

.report-issue-map .leaflet-control-zoom.leaflet-bar a {
  width: 30px;
  height: 26px;
  border: 0;
  background-color: #fff;
  font: 700 18px/26px Arial, sans-serif;
  text-align: center;
  transition: background-color 120ms ease;
}

.report-issue-map .leaflet-control-zoom.leaflet-bar a:hover {
  background-color: #f0faf7;
}

.report-issue-map .leaflet-control-zoom.leaflet-bar a:focus-visible {
  position: relative;
  z-index: 1;
  outline: 2px solid #087e70;
  outline-offset: -2px;
}

.report-issue-map .leaflet-control-zoom-in {
  border-bottom: 1px solid #e3ebe8 !important;
  border-radius: 9px 9px 0 0;
  color: #087e70 !important;
}

.report-issue-map .leaflet-control-zoom-out {
  border-radius: 0 0 9px 9px;
  color: #44515c !important;
}
`;

export default globalStyleSource;
