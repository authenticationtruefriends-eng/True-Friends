export default function Skeleton({ width = "100%", height = "20px", borderRadius = "4px", style = {} }) {
    return (
        <div
            className="skeleton-loader"
            style={{
                width,
                height,
                borderRadius,
                backgroundColor: "#f0f0f0",
                position: "relative",
                overflow: "hidden",
                ...style
            }}
        >
            <style>{`
        .skeleton-loader::after {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          transform: translateX(-100%);
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0,
            rgba(255, 255, 255, 0.2) 20%,
            rgba(255, 255, 255, 0.5) 60%,
            rgba(255, 255, 255, 0)
          );
          animation: shimmer 2s infinite;
          content: '';
        }

        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
        </div>
    );
}
