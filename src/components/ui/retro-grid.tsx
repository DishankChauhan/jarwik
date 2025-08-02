import { cn } from "@/lib/utils";

export function RetroGrid({
  className,
  angle = 65,
}: {
  className?: string;
  angle?: number;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden opacity-30",
        className,
      )}
      style={{ 
        perspective: "200px",
        "--grid-angle": `${angle}deg` 
      } as React.CSSProperties}
    >
      {/* Grid */}
      <div 
        className="absolute inset-0"
        style={{ 
          transform: `rotateX(${angle}deg)` 
        }}
      >
        <div
          className="animate-grid absolute inset-0 bg-repeat"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(249, 115, 22, 0.3) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(249, 115, 22, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
            height: "300vh",
            width: "600vw",
            marginLeft: "-50%",
            transformOrigin: "100% 0 0",
          }}
        />
      </div>

      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
    </div>
  );
}
