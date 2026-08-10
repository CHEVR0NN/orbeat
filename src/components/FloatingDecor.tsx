import { Rocket, Orbit, MoonStar, Sparkles, Globe, Satellite, Star } from "lucide-react";
import "./FloatingDecor.css";

const ICONS = [
  { Icon: Rocket, position: "decor-1", color: "var(--accent-cyan)" },
  { Icon: Orbit, position: "decor-2", color: "var(--accent-pink)" },
  { Icon: MoonStar, position: "decor-3", color: "var(--accent-yellow)" },
  { Icon: Sparkles, position: "decor-4", color: "var(--accent-cyan)" },
  { Icon: Globe, position: "decor-5", color: "var(--accent-pink)" },
  { Icon: Satellite, position: "decor-6", color: "var(--accent-yellow)" },
  { Icon: Star, position: "decor-7", color: "var(--accent-cyan)" },
];

export default function FloatingDecor() {
  return (
    <div className="floating-decor" aria-hidden="true">
      {ICONS.map(({ Icon, position, color }) => (
        <Icon key={position} className={`floating-decor-icon ${position}`} style={{ color }} />
      ))}
    </div>
  );
}
