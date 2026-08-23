"use client";

import { useState } from "react";

const DEMO_SRC = "/videos/leadnet-demo.mp4";

export function LeadNetDemoVideo() {
  const [playing, setPlaying] = useState(false);

  return (
    <figure className="mx-auto w-full max-w-[20rem] sm:max-w-[22.5rem]">
      <div className="overflow-hidden rounded-2xl border-2 border-accent/50 bg-oled shadow-[0_0_40px_rgba(34,211,238,0.12)]">
        <div className="relative aspect-[9/16] w-full bg-oled">
          <video
            src={DEMO_SRC}
            controls={playing}
            playsInline
            preload="none"
            className="absolute inset-0 h-full w-full object-contain bg-oled"
            onPlay={() => setPlaying(true)}
          />
          {playing ? null : (
            <button
              type="button"
              onClick={(event) => {
                const video = event.currentTarget
                  .previousElementSibling as HTMLVideoElement | null;
                setPlaying(true);
                void video?.play();
              }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-oled/25"
              aria-label="Play LeadNet demo"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-oled shadow-[0_0_24px_rgba(34,211,238,0.45)] sm:h-20 sm:w-20">
                <svg
                  viewBox="0 0 24 24"
                  className="ml-1 h-8 w-8 fill-current sm:h-9 sm:w-9"
                  aria-hidden
                >
                  <path d="M8 5.5v13l12-6.5-12-6.5Z" />
                </svg>
              </span>
            </button>
          )}
        </div>
      </div>
    </figure>
  );
}
