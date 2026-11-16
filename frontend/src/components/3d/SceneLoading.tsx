export default function SceneLoading({ label = 'Building the 3D city…' }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#050b18]/80" role="status" aria-live="polite">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-2 border-cyan-400/20" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-400 motion-reduce:animate-none" />
      </div>
      <p className="text-sm text-cyan-100/80">{label}</p>
    </div>
  )
}
