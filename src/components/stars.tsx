/** Note sur 5 affichée en étoiles (★★★☆☆). */
export function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} sur 5`} className="whitespace-nowrap text-amber-500">
      {"★".repeat(value)}
      <span className="text-muted-foreground/40">{"★".repeat(5 - value)}</span>
    </span>
  );
}
