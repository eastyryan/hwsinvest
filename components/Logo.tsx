// Self-contained brand mark — a purple rounded tile with a yellow shield and
// dollar glyph, echoing the design thumbnail. Drop a real HWS seal into
// /public and swap this for an <img> if you'd prefer the official mark.
export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="100" height="100" rx="22" fill="#4B2E83" />
      <path
        d="M50 22 L74 33 V52 c0 23 -16 35 -24 41 c-8 -6 -24 -18 -24 -41 V33 Z"
        fill="#FFC72C"
      />
      <text
        x="50"
        y="68"
        fontFamily="Georgia, serif"
        fontSize="46"
        fontWeight="600"
        fill="#4B2E83"
        textAnchor="middle"
      >
        $
      </text>
    </svg>
  );
}
