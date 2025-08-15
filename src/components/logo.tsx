// To use your own logo, replace the content of the <svg>
// with the code for your own SVG file.

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width="100"
      height="100"
      fill="currentColor"
    >
      <path d="M50,5A45,45,0,1,0,95,50,45,45,0,0,0,50,5Zm0,82A37,37,0,1,1,87,50,37,37,0,0,1,50,87Z" />
      <path d="M50,23.5a26.5,26.5,0,1,0,26.5,26.5A26.5,26.5,0,0,0,50,23.5Zm0,45A18.5,18.5,0,1,1,68.5,50,18.5,18.5,0,0,1,50,68.5Z" />
    </svg>
  );
}
