export function CardSkeleton() {
  return <div className="animate-pulse bg-gray-200 rounded-xl h-32 w-full" />;
}

export function ChartSkeleton() {
  return <div className="animate-pulse bg-gray-200 rounded-xl h-48 w-full" />;
}

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse bg-gray-200 rounded h-4"
          style={{ width: `${100 - index * 15}%` }}
        />
      ))}
    </div>
  );
}
