
export default function Logo({ size = 'md', onClick }) {
  // Configured distinct sizes while keeping the aggressive racing style consistent
  const sizeClasses =
    size === 'sm'
      ? 'text-xl tracking-tight'
      : size === 'lg'
        ? 'text-6xl sm:text-7xl tracking-tighter'
        : 'text-3xl tracking-tight';
  return (
    <span
      onClick={onClick}
      className={`${sizeClasses} font-black italic uppercase cursor-pointer active:opacity-80 select-none inline-flex items-center`}
    >
      {/* "F1" is set to clean white */}
      <span className="text-white">F1</span>

      {/* "PITWALL" with custom multi-layered red glow effect */}
      <span
        className="text-[#ff0700] ml-2 drop-shadow-[0_0_15px_rgba(255,7,0,0.6)]"
        style={{
          textShadow: '0 0 10px rgba(255, 7, 0, 0.4), 0 0 30px rgba(255, 7, 0, 0.4)'
        }}
      >
        PITWALL
      </span>
    </span>
  );
}