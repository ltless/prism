export function BrandLogo({ size = 44 }: { size?: number }) {
  return (
    <div
      className="bg-main-text rounded-xl flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5 text-primary-foreground"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="7" y="7" width="10" height="10" rx="1" transform="rotate(45 12 12)" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}
