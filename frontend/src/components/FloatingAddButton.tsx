interface Props {
  onClick: () => void;
}

export function FloatingAddButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label="Quick intake"
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-2xl font-bold text-black shadow-lg shadow-black/50 transition hover:scale-105 active:scale-95"
    >
      +
    </button>
  );
}
