"use client";

interface CommentContentProps {
  content: string;
}

export function CommentContent({ content }: CommentContentProps) {
  // Parse content and highlight mentions
  const parts = content.split(/(@[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);

  return (
    <p className="whitespace-pre-wrap text-sm">
      {parts.map((part, index) => {
        // Check if this part is a mention
        if (part.match(/^@[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
          return (
            <span
              key={index}
              className="font-semibold text-primary bg-primary/10 px-1 rounded"
            >
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}
