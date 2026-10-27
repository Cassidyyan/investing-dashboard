// Shared SVG renderer keeps both allocation views smooth at every pixel density.
export const allocationColors = [
  "#51c7aa",
  "#9a6ae8",
  "#79b8ee",
  "#f3b779",
  "#ec94ac",
  "#a9b5bc",
  "#b0c77a",
  "#cd9bd6",
  "#64aaa2",
  "#b6a18a",
];
export function AllocationPie({
  slices,
  label,
}: {
  slices: { label: string; percent: number }[];
  label: string;
}) {
  let start = 0;
  return (
    <svg
      className="holdings-pie"
      viewBox="0 0 200 200"
      role="img"
      shapeRendering="geometricPrecision"
      aria-label={label}
    >
      {slices.length === 1 ? (
        <circle cx="100" cy="100" r="98" fill={allocationColors[0]}>
          <title>{`${slices[0].label}: 100%`}</title>
        </circle>
      ) : (
        slices.map((slice, i) => {
          const angle = (start / 100) * Math.PI * 2 - Math.PI / 2;
          start += slice.percent;
          const end = (start / 100) * Math.PI * 2 - Math.PI / 2;
          const point = (a: number) =>
            `${100 + 98 * Math.cos(a)} ${100 + 98 * Math.sin(a)}`;
          const path = `M 100 100 L ${point(angle)} A 98 98 0 ${slice.percent > 50 ? 1 : 0} 1 ${point(end)} Z`;
          const color = allocationColors[i % allocationColors.length];
          return (
            <path
              key={slice.label}
              d={path}
              fill={color}
              stroke={color}
              strokeWidth="0.25"
              strokeLinejoin="round"
            >
              <title>{`${slice.label}: ${slice.percent.toFixed(1)}%`}</title>
            </path>
          );
        })
      )}
    </svg>
  );
}
