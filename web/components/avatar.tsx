type AvatarProps = { id: number; size?: number; label: string };

const palettes = [
  ["#f59e6b", "#2d1d18", "#ffe3ca"],
  ["#78a6a3", "#102829", "#d8f2ee"],
  ["#b4a0d7", "#291f3a", "#eee5ff"],
  ["#d9b85f", "#322a13", "#fff0b8"],
  ["#8fa8d9", "#18243c", "#deebff"],
  ["#d88791", "#351c22", "#ffe0e5"],
];

export function Avatar({ id, size = 44, label }: AvatarProps) {
  const [base, ink, light] = palettes[Math.abs(id) % palettes.length];
  const rotation = ((id * 29) % 36) - 18;
  const eyeShift = ((id * 7) % 7) - 3;
  return (
    <svg
      aria-label={label}
      className="avatar"
      role="img"
      viewBox="0 0 64 64"
      width={size}
      height={size}
    >
      <rect width="64" height="64" rx="21" fill={ink} />
      <circle cx="32" cy="33" r="22" fill={base} />
      <path d="M12 31c2-14 10-22 21-22 10 0 18 6 21 17-13-1-25 1-42 5Z" fill={light} opacity=".82" transform={`rotate(${rotation} 32 32)`} />
      <circle cx={24 + eyeShift} cy="34" r="2.4" fill={ink} />
      <circle cx={40 + eyeShift} cy="34" r="2.4" fill={ink} />
      <path d={id % 2 ? "M25 45c4 3 10 3 14 0" : "M26 45h12"} stroke={ink} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

