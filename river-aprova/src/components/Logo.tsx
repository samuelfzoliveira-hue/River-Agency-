export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`text-xl font-bold tracking-tight text-navy ${className}`}>
      River <span className="text-sky">Aprova</span>
    </span>
  );
}
