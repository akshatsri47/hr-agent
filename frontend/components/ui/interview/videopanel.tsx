// components/ui/interview/VideoPanel.tsx
import React from "react";

interface VideoPanelProps {
  camStream:    MediaStream | null
  screenStream: MediaStream | null
  startCam:     () => Promise<void>
  startScreen:  () => Promise<void>
  // ← allow the “| null” that your hook produces
  camRef:       React.RefObject<HTMLVideoElement | null>
  screenRef:    React.RefObject<HTMLVideoElement | null>
}

export const VideoPanel: React.FC<VideoPanelProps> = ({
  camStream,
  screenStream,
  startCam,
  startScreen,
  camRef,
  screenRef,
}) => {
  const panels = [
    { label: "Camera", stream: camStream, onClick: startCam, color: "blue" },
    { label: "Screen", stream: screenStream, onClick: startScreen, color: "green" },
  ];

  return (
    <div className="grid md:grid-cols-2 grid-cols-1 gap-6 mb-6">
      {panels.map(({ label, stream, onClick, color }) => (
        <div key={label} className="p-4 bg-white border rounded-lg shadow-lg">
          <button
            onClick={onClick}
            disabled={!!stream}
            className={`
              mb-3 px-4 py-2
              bg-${color}-600 hover:bg-${color}-700
              text-white rounded
              focus:outline-none focus:ring-2 focus:ring-${color}-400
              transition
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {stream ? `${label} Active` : `Start ${label}`}
          </button>
          <video
            ref={label === "Camera" ? camRef : screenRef}
            autoPlay
            muted
            className="w-full h-40 bg-black rounded"
          />
        </div>
      ))}
    </div>
  );
};
